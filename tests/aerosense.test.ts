import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preprocessRawAirQualityData } from "../lib/data-preprocessor.ts";
import { isBlockedHostname, validatePublicDatasetUrl } from "../lib/dataset-utils.ts";

describe("preprocessRawAirQualityData", () => {
  it("parses messy CSV with preambles, missing markers, negative values, and duplicates", () => {
    const rawCsv = `# Daily Municipal Air Monitoring Log
Station,Timestamp,PM2.5 (ug/m3),PM10 (ug/m3),AQI,Notes
Anand Vihar Ward 12,2019-11-03 08:00,412,530,455,Peak traffic corridor
Bawana Sector 3,2019-11-03 08:00,ERR,310,NA,Sensor optical fault
Okhla Phase II,2019-11-03 08:00,-18,220,,Negative voltage spike
Anand Vihar Ward 12,2019-11-03 08:00,412,530,455,Duplicate packet
Clean Park Station,2019-11-03 08:00,42,68,70,Normal telemetry`;

    const { indexedRows, preliminaryAudit } = preprocessRawAirQualityData(rawCsv);

    assert.equal(indexedRows.length, 5);
    assert.equal(indexedRows[0].row_id, "ROW_001");
    assert.equal(indexedRows[0].is_flagged, false);
    assert.equal(indexedRows[0].pm2_5, 412);

    assert.equal(indexedRows[1].row_id, "ROW_002");
    assert.equal(indexedRows[1].pm2_5, null);
    assert.equal(indexedRows[1].is_flagged, true);

    assert.equal(indexedRows[2].row_id, "ROW_003");
    assert.equal(indexedRows[2].is_flagged, true);
    assert.match(indexedRows[2].flag_reason || "", /negative/i);

    assert.equal(indexedRows[3].row_id, "ROW_004");
    assert.equal(indexedRows[3].is_flagged, true);
    assert.match(indexedRows[3].flag_reason || "", /duplicate/i);

    assert.equal(indexedRows[4].row_id, "ROW_005");
    assert.equal(indexedRows[4].is_flagged, false);

    assert.equal(preliminaryAudit.total_readings, 5);
    assert.equal(preliminaryAudit.valid_readings_count, 2);
    assert.equal(preliminaryAudit.missing_or_corrupt_count, 3);
  });

  it("normalizes mixed mg/m3 and ug/m3 units with cell-level precedence", () => {
    const markdownTable = `| Ward | Date | PM2.5 (ug/m3) | PM10 (mg/m3) |
| --- | --- | --- | --- |
| Ward 04 | 2020-01-12 | 0.25 mg/m3 | 0.42 |
| Ward 09 | 2020-01-12 | 165 | 210 ug/m3 |`;

    const { indexedRows, preliminaryAudit } = preprocessRawAirQualityData(markdownTable);

    assert.equal(indexedRows.length, 2);
    assert.equal(indexedRows[0].pm2_5, 250);
    assert.equal(indexedRows[0].pm10, 420);
    assert.equal(indexedRows[1].pm2_5, 165);
    assert.equal(indexedRows[1].pm10, 210);
    assert.ok((preliminaryAudit.unit_conversions || []).length >= 2);
  });

  it("parses JSON array logs and estimates AQI when omitted", () => {
    const jsonInput = JSON.stringify([
      { station: "Station Alpha", date: "2020-02-01", pm25: 90, pm10: 140 },
      { station: "Station Beta", date: "", pm25: 1200, pm10: 150 },
    ]);

    const { indexedRows } = preprocessRawAirQualityData(jsonInput);

    assert.equal(indexedRows.length, 2);
    assert.equal(indexedRows[0].aqi, 200);
    assert.equal(indexedRows[0].is_flagged, false);
    assert.equal(indexedRows[1].is_flagged, true);
    assert.match(indexedRows[1].flag_reason || "", /outlier/i);
    assert.match(indexedRows[1].flag_reason || "", /timestamp/i);
  });
});

describe("dataset SSRF and URL validation", () => {
  it("blocks private networks, localhost, and cloud metadata endpoints", () => {
    assert.equal(isBlockedHostname("localhost"), true);
    assert.equal(isBlockedHostname("127.0.0.1"), true);
    assert.equal(isBlockedHostname("169.254.169.254"), true);
    assert.equal(isBlockedHostname("10.0.1.5"), true);
    assert.equal(isBlockedHostname("192.168.1.1"), true);
    assert.equal(isBlockedHostname("172.16.0.1"), true);
    assert.equal(isBlockedHostname("[::1]"), true);
    assert.equal(isBlockedHostname("metadata.google.internal"), true);
    assert.equal(isBlockedHostname("huggingface.co"), false);
  });

  it("rejects non-HTTPS URLs and accepts public HTTPS dataset URLs", () => {
    const httpRes = validatePublicDatasetUrl("http://huggingface.co/datasets/AdityaaXD/AQI-Of-India");
    assert.equal(httpRes.valid, false);

    const metaRes = validatePublicDatasetUrl("https://169.254.169.254/latest/meta-data/");
    assert.equal(metaRes.valid, false);

    const hfRes = validatePublicDatasetUrl(
      "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India/resolve/main/city_day.csv"
    );
    assert.equal(hfRes.valid, true);
  });
});
