import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preprocessRawAirQualityData } from "../lib/data-preprocessor.ts";

describe("preprocessRawAirQualityData", () => {
  it("returns empty structures cleanly when given whitespace-only input", () => {
    const { indexedRows, preliminaryAudit } = preprocessRawAirQualityData("   \n\t  ");
    assert.equal(indexedRows.length, 0);
    assert.equal(preliminaryAudit.total_readings, 0);
    assert.equal(preliminaryAudit.valid_readings_count, 0);
    assert.equal(preliminaryAudit.missing_or_corrupt_count, 0);
  });

  it("parses messy CSV with preambles, missing markers, negative values, and duplicates", () => {
    const rawCsv = `# Daily Municipal Air Monitoring Log
Regional Sensor Summary Table
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

  it("parses TSV and semicolon-delimited files including NO2, SO2, Temp, and Humidity", () => {
    const tsvData = `Station\tDate\tPM2.5\tPM10\tNO2\tSO2\tTemp\tHumidity\tRemark
Sector 15\t2020-02-14\t75\t110\t38\t12\t21\t54\tMorning rush`;

    const { indexedRows } = preprocessRawAirQualityData(tsvData);
    assert.equal(indexedRows.length, 1);
    assert.equal(indexedRows[0].station_id, "Sector 15");
    assert.equal(indexedRows[0].no2, 38);
    assert.equal(indexedRows[0].so2, 12);
    assert.equal(indexedRows[0].temp, 21);
    assert.equal(indexedRows[0].humidity, 54);
    assert.equal(indexedRows[0].notes, "Morning rush");
    assert.equal(indexedRows[0].is_flagged, false);

    const semiData = `Site;Time;PM2.5;PM10
South Yard;2020-02-14 09:00;115;180`;
    const semiRes = preprocessRawAirQualityData(semiData);
    assert.equal(semiRes.indexedRows.length, 1);
    assert.equal(semiRes.indexedRows[0].pm2_5, 115);
    assert.equal(semiRes.indexedRows[0].pm10, 180);
  });

  it("parses whitespace-aligned tables copied from terminal/PDF exports", () => {
    const spaceTable = `Station          Timestamp          PM2.5   PM10
North Gate       2020-03-01 07:00   48      88
Industrial East  2020-03-01 07:00   185     290`;

    const { indexedRows } = preprocessRawAirQualityData(spaceTable);
    assert.equal(indexedRows.length, 2);
    assert.equal(indexedRows[0].station_id, "North Gate");
    assert.equal(indexedRows[0].pm2_5, 48);
    assert.equal(indexedRows[1].station_id, "Industrial East");
    assert.equal(indexedRows[1].pm10, 290);
  });

  it("estimates CPCB AQI across all PM2.5 breakpoint tiers when omitted", () => {
    const jsonInput = JSON.stringify([
      { station: "Tier 1", date: "2020-02-01", pm25: 15, pm10: 30 },
      { station: "Tier 2", date: "2020-02-01", pm25: 45, pm10: 70 },
      { station: "Tier 3", date: "2020-02-01", pm25: 90, pm10: 140 },
      { station: "Tier 4", date: "2020-02-01", pm25: 105, pm10: 180 },
      { station: "Tier 5", date: "2020-02-01", pm25: 185, pm10: 260 },
      { station: "Tier 6", date: "2020-02-01", pm25: 380, pm10: 490 },
    ]);

    const { indexedRows } = preprocessRawAirQualityData(jsonInput);
    assert.equal(indexedRows.length, 6);
    assert.equal(indexedRows[0].aqi, 25);
    assert.equal(indexedRows[1].aqi, 75);
    assert.equal(indexedRows[2].aqi, 200);
    assert.equal(indexedRows[3].aqi, 250);
    assert.equal(indexedRows[4].aqi, 350);
    assert.equal(indexedRows[5].aqi, 500);
  });

  it("flags extreme PM2.5, PM10, AQI > 500, corrupted strings, and missing timestamps", () => {
    const csv = `Station,Date,PM2.5,PM10,AQI
Alpha,,1200,1600,550
Beta,2020-04-01,abc,90,110`;

    const { indexedRows } = preprocessRawAirQualityData(csv);
    assert.equal(indexedRows.length, 2);
    assert.equal(indexedRows[0].is_flagged, true);
    assert.match(indexedRows[0].flag_reason || "", /PM2\.5 extreme outlier/i);
    assert.match(indexedRows[0].flag_reason || "", /PM10 extreme outlier/i);
    assert.match(indexedRows[0].flag_reason || "", /AQI exceeds/i);
    assert.match(indexedRows[0].flag_reason || "", /Missing timestamp/i);

    assert.equal(indexedRows[1].is_flagged, true);
    assert.match(indexedRows[1].flag_reason || "", /Corrupted text reading/i);
  });
});
