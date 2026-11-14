import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { NextRequest } from "next/server";
import type { AnalysisResult, RawDataRow } from "../lib/types.ts";
import {
  AppHttpError,
  getHttpErrorDetails,
  sanitizeText,
  parseJsonBody,
  validateAnalyzePayload,
  validateRecommendationsPayload,
  validateComparePayload,
  validateAdvisoryPayload,
} from "../lib/validation.ts";
import {
  sanitizeRowCitations,
  computeStationDeltas,
  buildCompactPromptRows,
} from "../lib/briefing-helpers.ts";

const makeRow = (overrides: Partial<RawDataRow> = {}): RawDataRow => ({
  row_id: "ROW_001",
  timestamp: "2019-11-03 08:00",
  station_id: "Anand Vihar",
  pm2_5: 380,
  pm10: 490,
  aqi: 440,
  is_flagged: false,
  raw_text: "Anand Vihar | 380",
  ...overrides,
});

const makeAnalysis = (overrides: Partial<AnalysisResult> = {}): AnalysisResult => ({
  id: "brief_1",
  brief_timestamp: "2026-01-01T00:00:00Z",
  brief_title: "Delhi Corridor Brief",
  summary: "High PM2.5 across east stations.",
  overall_aqi_category: "HAZARDOUS",
  data_health: {
    total_readings: 1,
    valid_readings_count: 1,
    missing_or_corrupt_count: 0,
    detected_units: ["ug/m3"],
    unreliable_readings: [],
  },
  hotspots: [
    {
      id: "hs_1",
      location_name: "Anand Vihar",
      severity: "HAZARDOUS",
      peak_value: 380,
      pollutant_of_concern: "PM2.5",
      timestamp: "2019-11-03 08:00",
      plain_language_summary: "Severe particulate spike.",
      evidence_rows: ["ROW_001"],
    },
  ],
  general_trends: [],
  indexed_rows: [makeRow()],
  ...overrides,
});

describe("request validation and HTTP error mapping", () => {
  it("maps AppHttpError and generic Errors accurately", () => {
    const appErr = new AppHttpError("Rate limit reached", 429);
    assert.deepEqual(getHttpErrorDetails(appErr), {
      status: 429,
      message: "Rate limit reached",
    });

    const plainErr = new Error("Upstream failure");
    assert.deepEqual(getHttpErrorDetails(plainErr), {
      status: 500,
      message: "Upstream failure",
    });
  });

  it("strips control characters and bounds sanitized text length", () => {
    const dirty = "  Ward\u0000 12\u0007 Alert\u001F  ";
    assert.equal(sanitizeText(dirty, 50), "Ward 12 Alert");
    assert.equal(sanitizeText("abcdefghij", 4), "abcd");
    assert.equal(sanitizeText(12345, 20), "");
  });

  it("parseJsonBody rejects malformed JSON and non-object payloads with HTTP 400", async () => {
    const badJsonReq = {
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as NextRequest;
    await assert.rejects(
      () => parseJsonBody(badJsonReq),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    const arrayReq = {
      json: async () => [1, 2, 3],
    } as unknown as NextRequest;
    await assert.rejects(
      () => parseJsonBody(arrayReq),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    const validReq = {
      json: async () => ({ rawText: "Station,PM2.5\nA,40" }),
    } as unknown as NextRequest;
    const parsed = await parseJsonBody<{ rawText: string }>(validReq);
    assert.equal(parsed.rawText, "Station,PM2.5\nA,40");
  });

  it("validates analyze, recommendations, compare, and advisory payloads", () => {
    assert.throws(
      () => validateAnalyzePayload({ rawText: "   " }),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    assert.throws(
      () => validateAnalyzePayload({ rawText: "a".repeat(500_001) }),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    const cleanAnalyze = validateAnalyzePayload({
      rawText: "Station,PM2.5\nA\u0000,45",
      briefTitle: "  Test Brief  ",
    });
    assert.equal(cleanAnalyze.rawText, "Station,PM2.5\nA,45");
    assert.equal(cleanAnalyze.briefTitle, "Test Brief");

    const sampleAnalysis = makeAnalysis();
    const rec = validateRecommendationsPayload({
      analysis: sampleAnalysis,
      focusQuestion: "  Pause school sports? ",
    });
    assert.equal(rec.focusQuestion, "Pause school sports?");

    assert.throws(
      () => validateComparePayload({ currentBrief: sampleAnalysis }),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    const advOk = validateAdvisoryPayload({
      analysis: sampleAnalysis,
      language: "hi",
      readingLevel: "Grade 5 (Plain Language)",
    });
    assert.equal(advOk.language, "hi");

    assert.throws(
      () => validateAdvisoryPayload({ analysis: sampleAnalysis, language: "zz" }),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );

    assert.throws(
      () =>
        validateAdvisoryPayload({
          analysis: sampleAnalysis,
          language: "en",
          readingLevel: "PhD Thesis",
        }),
      (err: unknown) => err instanceof AppHttpError && err.status === 400
    );
  });
});

describe("briefing traceability and delta helpers", () => {
  it("sanitizes row citations, deduplicates IDs, and falls back by station name", () => {
    const rows = [
      makeRow({ row_id: "ROW_001", station_id: "Anand Vihar" }),
      makeRow({ row_id: "ROW_002", station_id: "Rohini" }),
    ];
    const validIds = new Set(rows.map((r) => r.row_id));

    assert.deepEqual(
      sanitizeRowCitations(["ROW_001", "ROW_999", "ROW_001"], validIds, rows),
      ["ROW_001"]
    );
    assert.deepEqual(
      sanitizeRowCitations(["INVALID_ROW"], validIds, rows, "Rohini Sector 16"),
      ["ROW_002"]
    );
    assert.deepEqual(
      sanitizeRowCitations(["INVALID_ROW"], validIds, rows, "Unmatched Station"),
      []
    );
  });

  it("computes deterministic station deltas, new stations, and sensor recoveries", () => {
    const prevRows = [
      makeRow({ row_id: "ROW_001", station_id: "Anand Vihar", pm2_5: 300 }),
      makeRow({ row_id: "ROW_002", station_id: "Bawana", pm2_5: null }),
    ];
    const currRows = [
      makeRow({ row_id: "ROW_001", station_id: "Anand Vihar", pm2_5: 420, notes: "Traffic jam" }),
      makeRow({ row_id: "ROW_002", station_id: "Bawana", pm2_5: 190 }),
      makeRow({ row_id: "ROW_003", station_id: "Dwarka", pm2_5: 95 }),
    ];

    const deltas = computeStationDeltas(currRows, prevRows);
    assert.equal(deltas.length, 3);
    assert.match(deltas[0], /300 -> 420 ug\/m3 \(\+120\) \[Traffic jam\]/);
    assert.match(deltas[1], /recovered from gap \(now PM2\.5 190 ug\/m3\)/);
    assert.match(deltas[2], /Dwarka: New station in current brief/);
  });

  it("formats compact prompt rows within maxRows cap", () => {
    const rows = [
      makeRow({ row_id: "ROW_001", no2: 45, notes: "Peak hour" }),
      makeRow({ row_id: "ROW_002", pm2_5: null, is_flagged: true, flag_reason: "Sensor offline" }),
    ];
    const output = buildCompactPromptRows(rows, 1);
    assert.equal(output.split("\n").length, 1);
    assert.match(output, /\[ROW_001\]/);
    assert.match(output, /NO2:45/);

    const full = buildCompactPromptRows(rows, 10);
    assert.match(full, /PM2\.5:MISSING/);
    assert.match(full, /FLAG:Sensor offline/);
  });
});
