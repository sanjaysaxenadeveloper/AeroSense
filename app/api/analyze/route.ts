import { NextRequest, NextResponse } from "next/server";
import { preprocessRawAirQualityData } from "@/lib/data-preprocessor";
import { generateStructuredJson } from "@/lib/gemini";
import { AnalysisResult, RawDataRow, DataAuditReport } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, briefTitle } = body;

    if (!rawText || typeof rawText !== "string" || !rawText.trim()) {
      return NextResponse.json({ error: "No raw data provided." }, { status: 400 });
    }

    if (rawText.length > 500_000) {
      return NextResponse.json(
        { error: "Input exceeds 500 KB limit. Please upload or slice a smaller station window." },
        { status: 400 }
      );
    }

    // Step 1: Deterministic preprocessing for CSV, TSV, pipe/markdown, multi-space, and JSON
    let { indexedRows, preliminaryAudit } = preprocessRawAirQualityData(rawText);

    const hasAnyPollutantValue = indexedRows.some(
      (r) => r.pm2_5 !== null || r.pm10 !== null || r.aqi !== null || r.no2 !== null || r.so2 !== null
    );

    // Step 1b: If input is unstructured text or non-standard columns, use Gemini to extract & normalize rows
    if (indexedRows.length === 0 || !hasAnyPollutantValue) {
      const extractionSystem = `You are a Civic Environmental Data Parser.
Extract air quality sensor readings from any messy, erratic, or unstructured text/table into normalized JSON rows.
Rules:
- Assign sequential row_id: "ROW_001", "ROW_002", ...
- Convert mg/m³ particulate values to µg/m³ (multiply by 1000).
- Set missing, "NA", "ERR", "offline", or corrupted values to null and set is_flagged: true with a clear flag_reason.
- Flag negative readings or extreme outliers (PM2.5 > 900).
Return strictly valid JSON:
{
  "detected_units": ["ug/m3"],
  "unit_conversions": ["..."],
  "rows": [
    {
      "row_id": "ROW_001",
      "station_id": "Station or Location name",
      "timestamp": "Timestamp or N/A",
      "pm2_5": 120,
      "pm10": 180,
      "aqi": 210,
      "no2": null,
      "so2": null,
      "notes": "Context note if present",
      "is_flagged": false,
      "flag_reason": ""
    }
  ]
}`;

      const extracted = await generateStructuredJson<{
        detected_units?: string[];
        unit_conversions?: string[];
        rows?: Partial<RawDataRow>[];
      }>(
        `Parse and normalize this raw air quality input:\n\n${rawText}`,
        extractionSystem,
        "gemini-3.1-flash-lite"
      );

      if (extracted.rows && extracted.rows.length > 0) {
        indexedRows = extracted.rows.map((r, idx) => ({
          row_id: r.row_id || `ROW_${String(idx + 1).padStart(3, "0")}`,
          timestamp: r.timestamp || "N/A",
          station_id: r.station_id || `Station_${idx + 1}`,
          location: r.station_id || `Station_${idx + 1}`,
          pm2_5: typeof r.pm2_5 === "number" ? r.pm2_5 : null,
          pm10: typeof r.pm10 === "number" ? r.pm10 : null,
          aqi: typeof r.aqi === "number" ? r.aqi : null,
          no2: typeof r.no2 === "number" ? r.no2 : null,
          so2: typeof r.so2 === "number" ? r.so2 : null,
          unit_pm: "µg/m³",
          notes: r.notes || undefined,
          is_flagged: Boolean(r.is_flagged || (r.pm2_5 == null && r.pm10 == null && r.aqi == null)),
          flag_reason:
            r.flag_reason ||
            (r.pm2_5 == null && r.pm10 == null && r.aqi == null ? "Missing sensor readings" : ""),
        }));

        const unreliable = indexedRows
          .filter((r) => r.is_flagged)
          .map((r) => ({
            row_id: r.row_id,
            station: r.station_id || "Unknown",
            issue: r.flag_reason || "Flagged reading",
          }));

        preliminaryAudit = {
          total_readings: indexedRows.length,
          valid_readings_count: indexedRows.filter((r) => !r.is_flagged).length,
          missing_or_corrupt_count: unreliable.length,
          detected_units: extracted.detected_units || [],
          unit_conversions: extracted.unit_conversions || [],
          unreliable_readings: unreliable,
        } satisfies DataAuditReport;
      }
    }

    if (indexedRows.length === 0) {
      return NextResponse.json(
        { error: "Could not parse any air quality readings from the provided input." },
        { status: 400 }
      );
    }

    const validRowIds = new Set(indexedRows.map((r) => r.row_id));

    // Step 2: Format rows for Gemini with explicit IDs and station notes (cap at 60 rows for prompt reliability)
    const promptRows = indexedRows.slice(0, 60);
    const formattedRowsForPrompt = promptRows
      .map(
        (r) =>
          `[${r.row_id}] Station: "${r.station_id}" | Time: "${r.timestamp}" | PM2.5: ${
            r.pm2_5 !== null && r.pm2_5 !== undefined ? `${r.pm2_5} µg/m³` : "MISSING"
          } | PM10: ${
            r.pm10 !== null && r.pm10 !== undefined ? `${r.pm10} µg/m³` : "MISSING"
          } | AQI: ${r.aqi !== null && r.aqi !== undefined ? r.aqi : "MISSING"} | NO2: ${
            r.no2 !== null && r.no2 !== undefined ? r.no2 : "N/A"
          }${r.notes ? ` | Notes: "${r.notes}"` : ""} | Flagged: ${
            r.is_flagged ? `YES (${r.flag_reason})` : "NO"
          }`
      )
      .join("\n");

    const systemInstruction = `You are the Lead Environmental Data Scientist & Civic Intelligence Analyst for AeroSense Civic Air Quality Studio.
Your task is to analyze raw, messy air quality readings and produce an authoritative, traceable civic intelligence report.

STRICT TRACEABILITY & INTEGRITY RULES:
1. CITATIONS REQUIRED: Every hotspot, peak, trend, and anomaly MUST explicitly include the exact row IDs (e.g. ["ROW_001", "ROW_004"]) from the indexed data where that data appears. Never make an empirical claim without a citation.
2. AUDIT DATA INTEGRITY: Identify missing readings, telemetry failures, unit discrepancies, and extreme anomalies, matching the pre-flagged findings.
3. PLAIN LANGUAGE: Summarize trends and hotspots clearly in plain, accessible language so ward teams, housing societies, and schools can immediately understand the risk.
4. SEVERITY CLASSIFICATION: Use standard AQI brackets:
   - 0-50: GOOD
   - 51-100: MODERATE
   - 101-200: UNHEALTHY_SENSITIVE
   - 201-300: UNHEALTHY
   - 301-400: VERY_UNHEALTHY
   - 401+: HAZARDOUS
5. DO NOT HALLUCINATE: Only describe phenomena that can be substantiated from the row data and station notes.

Produce a strictly valid JSON response adhering to this schema:
{
  "summary": "2-3 concise plain-language sentences summarizing overall regional air quality and immediate risks.",
  "overall_aqi_category": "GOOD | MODERATE | UNHEALTHY_SENSITIVE | UNHEALTHY | VERY_UNHEALTHY | HAZARDOUS",
  "data_health_summary": "1-2 sentences summarizing data completeness, unit normalizations, sensor dropouts, or corrupted values.",
  "hotspots": [
    {
      "id": "HS_1",
      "location_name": "Station or Ward name",
      "pollutant_of_concern": "PM2.5 / PM10 / NO2 / SO2",
      "peak_value": "e.g. 520 µg/m³ (AQI 498)",
      "timestamp": "e.g. 2026-11-14 07:00",
      "severity": "HAZARDOUS | VERY_UNHEALTHY | UNHEALTHY | UNHEALTHY_SENSITIVE | MODERATE | GOOD",
      "evidence_rows": ["ROW_001", "ROW_003"],
      "plain_language_summary": "Clear plain-language description of the localized spike and health impact",
      "likely_cause": "Traffic congestion / industrial stack / biomass / unpaved dust"
    }
  ],
  "general_trends": [
    {
      "trend_title": "Trend headline",
      "description": "Plain-language explanation of temporal or spatial trend",
      "evidence_rows": ["ROW_002", "ROW_005"]
    }
  ]
}`;

    const resolvedTitle =
      typeof briefTitle === "string" && briefTitle.trim()
        ? briefTitle.trim()
        : `Air Quality Brief (${new Date().toLocaleDateString()})`;

    const prompt = `Analyze this civic air quality monitoring dataset:
Brief Title: ${resolvedTitle}
Total Monitored Nodes: ${indexedRows.length}

INDEXED DATA READINGS:
${formattedRowsForPrompt}

Audit Findings from Sensor Ingestion:
Total Readings: ${preliminaryAudit.total_readings}
Flagged Unreliable/Missing: ${preliminaryAudit.missing_or_corrupt_count}
Detected Units: ${preliminaryAudit.detected_units.join(", ") || "Standard"}
Unit Conversions Applied: ${preliminaryAudit.unit_conversions?.join("; ") || "None"}
Unreliable Nodes: ${JSON.stringify(preliminaryAudit.unreliable_readings)}

Analyze all nodes, identify the top hotspots, establish trends with exact [ROW_XXX] citations, and assess data reliability. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<{
      summary: string;
      overall_aqi_category: string;
      data_health_summary: string;
      hotspots: {
        id: string;
        location_name: string;
        pollutant_of_concern: string;
        peak_value: string;
        timestamp: string;
        severity:
          | "GOOD"
          | "MODERATE"
          | "UNHEALTHY_SENSITIVE"
          | "UNHEALTHY"
          | "VERY_UNHEALTHY"
          | "HAZARDOUS";
        evidence_rows: string[];
        plain_language_summary: string;
        likely_cause: string;
      }[];
      general_trends: {
        trend_title: string;
        description: string;
        evidence_rows: string[];
      }[];
    }>(prompt, systemInstruction);

    const sanitizeCitations = (rows?: string[], fallbackLocation?: string): string[] => {
      const valid = (rows || []).filter((id) => validRowIds.has(id));
      if (valid.length > 0) return valid;
      if (fallbackLocation) {
        const lower = fallbackLocation.toLowerCase();
        const matched = indexedRows.find(
          (r) =>
            (r.station_id || "").toLowerCase().includes(lower) ||
            lower.includes((r.station_id || "").toLowerCase())
        );
        if (matched) return [matched.row_id];
      }
      return [];
    };

    const result: AnalysisResult = {
      id: `brief_${Date.now()}`,
      brief_timestamp: new Date().toISOString(),
      brief_title: resolvedTitle,
      summary: aiResponse.summary,
      overall_aqi_category: aiResponse.overall_aqi_category || "UNHEALTHY",
      data_health_summary: aiResponse.data_health_summary,
      data_health: {
        ...preliminaryAudit,
        unreliable_readings: preliminaryAudit.unreliable_readings,
      },
      hotspots: (aiResponse.hotspots || []).map((h, i) => ({
        ...h,
        id: h.id || `HS_${i + 1}`,
        evidence_rows: sanitizeCitations(h.evidence_rows, h.location_name),
      })),
      general_trends: (aiResponse.general_trends || []).map((t) => ({
        ...t,
        evidence_rows: sanitizeCitations(t.evidence_rows),
      })),
      indexed_rows: indexedRows,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Analysis API Error:", error);
    const status =
      typeof (error as { status?: number })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
