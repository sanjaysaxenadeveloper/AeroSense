import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isBlockedIpAddress,
  isBlockedHostname,
  validatePublicDatasetUrl,
  assertPublicResolvableHost,
  isValidIsoDate,
  isAllowedDatasetMimeType,
} from "../lib/dataset-utils.ts";
import { checkRateLimit, getClientIdentifier } from "../lib/rate-limiter.ts";
import { sanitizeCsvCell, buildNormalizedAuditCsv } from "../lib/briefing-helpers.ts";
import type { NextRequest } from "next/server";

describe("dataset SSRF, DNS-rebinding, MIME, and date security guards", () => {
  it("blocks private, loopback, CGNAT, benchmarking, multicast, and IPv4-mapped IPv6 addresses", () => {
    const blockedIps = [
      "127.0.0.1",
      "0.0.0.1",
      "10.0.1.5",
      "100.64.0.1",
      "169.254.169.254",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "198.18.0.1",
      "224.0.0.1",
      "::1",
      "::",
      "::ffff:127.0.0.1",
      "::ffff:169.254.169.254",
      "fe80::1",
      "fd12:3456:789a::1",
      "ff02::1",
    ];
    for (const ip of blockedIps) {
      assert.equal(isBlockedIpAddress(ip), true, `Expected IP ${ip} to be blocked`);
    }

    assert.equal(isBlockedIpAddress("8.8.8.8"), false);
    assert.equal(isBlockedIpAddress("2606:4700:4700::1111"), false);
  });

  it("blocks localhost, internal suffixes, decimals, and metadata hostnames", () => {
    const blockedHosts = [
      "localhost",
      "sub.localhost",
      "metadata.google.internal",
      "service.local",
      "api.internal",
      "2130706433",
    ];
    for (const host of blockedHosts) {
      assert.equal(isBlockedHostname(host), true, `Expected ${host} to be blocked`);
    }

    assert.equal(isBlockedHostname("huggingface.co"), false);
    assert.equal(isBlockedHostname("raw.githubusercontent.com"), false);
  });

  it("rejects non-HTTPS URLs, URLs with credentials, non-443 ports, and private DNS hosts", async () => {
    assert.equal(validatePublicDatasetUrl("").valid, false);
    assert.equal(validatePublicDatasetUrl(null).valid, false);
    assert.equal(validatePublicDatasetUrl("not a url").valid, false);
    assert.equal(
      validatePublicDatasetUrl("http://huggingface.co/datasets/AdityaaXD/AQI-Of-India").valid,
      false
    );
    assert.equal(
      validatePublicDatasetUrl("https://user:secret@huggingface.co/file.csv").valid,
      false
    );
    assert.equal(
      validatePublicDatasetUrl("https://huggingface.co:8443/file.csv").valid,
      false
    );
    assert.equal(
      validatePublicDatasetUrl("https://169.254.169.254/latest/meta-data/").valid,
      false
    );

    const validDefaultPort = validatePublicDatasetUrl(
      "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India/resolve/main/city_day.csv"
    );
    assert.equal(validDefaultPort.valid, true);

    const validExplicit443 = validatePublicDatasetUrl(
      "https://huggingface.co:443/datasets/AdityaaXD/AQI-Of-India/resolve/main/city_day.csv"
    );
    assert.equal(validExplicit443.valid, true);

    await assert.rejects(() => assertPublicResolvableHost("localhost"));
    await assert.rejects(() => assertPublicResolvableHost("127.0.0.1"));
  });

  it("validates ISO observation dates and dataset MIME types", () => {
    assert.equal(isValidIsoDate("2019-11-03"), true);
    assert.equal(isValidIsoDate("2019-11-3"), false);
    assert.equal(isValidIsoDate("11/03/2019"), false);
    assert.equal(isValidIsoDate(undefined), false);

    assert.equal(isAllowedDatasetMimeType(null), true);
    assert.equal(isAllowedDatasetMimeType("text/csv; charset=utf-8"), true);
    assert.equal(isAllowedDatasetMimeType("application/json"), true);
    assert.equal(isAllowedDatasetMimeType("text/tab-separated-values"), true);
    assert.equal(isAllowedDatasetMimeType("text/html; charset=utf-8"), false);
    assert.equal(isAllowedDatasetMimeType("application/x-msdownload"), false);
  });
});

describe("CSV spreadsheet formula injection defense (CWE-1236)", () => {
  it("neutralizes leading formula triggers and escapes embedded quotes", () => {
    assert.equal(sanitizeCsvCell("=CMD('calc')"), "\"'=CMD('calc')\"");
    assert.equal(sanitizeCsvCell("+SUM(A1:A2)"), "\"'+SUM(A1:A2)\"");
    assert.equal(sanitizeCsvCell("-10+20"), "\"'-10+20\"");
    assert.equal(sanitizeCsvCell("@IMPORTXML()"), "\"'@IMPORTXML()\"");
    assert.equal(sanitizeCsvCell('Normal "Station"'), '"Normal ""Station"""');

    const csv = buildNormalizedAuditCsv([
      {
        row_id: "ROW_001",
        station_id: "=HYPERLINK(\"http://evil.example\")",
        timestamp: "2020-01-01",
        pm2_5: 120,
        pm10: 210,
        aqi: 300,
        is_flagged: false,
      },
    ]);
    assert.match(csv, /row_id,station_id,timestamp/);
    assert.match(csv, /"'=HYPERLINK/);
  });
});

describe("sliding-window API rate limiter", () => {
  it("tracks remaining quota accurately and enforces Retry-After when exhausted", () => {
    const key = `test-client-${Date.now()}-${Math.random()}`;
    const first = checkRateLimit(key, 3, 60_000);
    assert.equal(first.allowed, true);
    assert.equal(first.remaining, 2);

    const second = checkRateLimit(key, 3, 60_000);
    assert.equal(second.allowed, true);
    assert.equal(second.remaining, 1);

    const third = checkRateLimit(key, 3, 60_000);
    assert.equal(third.allowed, true);
    assert.equal(third.remaining, 0);

    const blocked = checkRateLimit(key, 3, 60_000);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.remaining, 0);
    assert.ok(blocked.retryAfterSeconds >= 1);
  });

  it("extracts and bounds client identifier from forwarded headers", () => {
    const reqWithForwarded = {
      headers: new Headers({ "x-forwarded-for": "::ffff:203.0.113.10, 10.0.0.1" }),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqWithForwarded), "203.0.113.10");

    const reqOversized = {
      headers: new Headers({ "x-real-ip": "a".repeat(200) }),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqOversized).length, 64);

    const reqLocal = {
      headers: new Headers(),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqLocal), "local-client");
  });
});
