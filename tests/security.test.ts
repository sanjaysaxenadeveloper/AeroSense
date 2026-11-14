import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isBlockedHostname,
  validatePublicDatasetUrl,
  isValidIsoDate,
  isAllowedDatasetMimeType,
} from "../lib/dataset-utils.ts";
import { checkRateLimit, getClientIdentifier } from "../lib/rate-limiter.ts";
import type { NextRequest } from "next/server";

describe("dataset SSRF, MIME, and date security guards", () => {
  it("blocks localhost, RFC1918 private IPs, link-local metadata, IPv4-mapped IPv6, and .internal hosts", () => {
    const blockedHosts = [
      "localhost",
      "127.0.0.1",
      "0.0.0.0",
      "10.0.1.5",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "169.254.169.254",
      "[::1]",
      "::",
      "[::ffff:127.0.0.1]",
      "fe80::1",
      "fd12:3456:789a::1",
      "metadata.google.internal",
      "service.local",
      "2130706433",
    ];
    for (const host of blockedHosts) {
      assert.equal(isBlockedHostname(host), true, `Expected ${host} to be blocked`);
    }

    assert.equal(isBlockedHostname("huggingface.co"), false);
    assert.equal(isBlockedHostname("raw.githubusercontent.com"), false);
  });

  it("rejects non-HTTPS URLs, URLs with credentials, non-443 ports, and malformed URLs", () => {
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

  it("extracts client identifier from x-forwarded-for or x-real-ip headers", () => {
    const reqWithForwarded = {
      headers: new Headers({ "x-forwarded-for": "203.0.113.10, 10.0.0.1" }),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqWithForwarded), "203.0.113.10");

    const reqWithRealIp = {
      headers: new Headers({ "x-real-ip": "198.51.100.42" }),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqWithRealIp), "198.51.100.42");

    const reqLocal = {
      headers: new Headers(),
    } as unknown as NextRequest;
    assert.equal(getClientIdentifier(reqLocal), "local-client");
  });
});
