import { NextRequest, NextResponse } from "next/server";
import { preprocessRawAirQualityData } from "@/lib/data-preprocessor";
import { generateStructuredJson } from "@/lib/gemini";
import { AnalysisResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { rawText, briefTitle } = body;
    const customApiKey = req.headers.get("x-gemini-api-key") || body.customApiKey;

    if (!rawText || typeof rawText !== "string") {
      return NextResponse.json({ error: "No raw data provided." }, { status: 400 });
    }

    // Step 1: Preprocess, normalize, and tag rows with deterministic IDs
    const { indexedRows, preliminaryAudit } = preprocessRawAirQualityData(rawText);

    if (indexedRows.length === 0) {
      return NextResponse.json(
        { error: "Could not parse any tabular rows from the provided input." },
        { status: 400 }
      );
    }

    // Step 2: Format rows for Gemini with explicit IDs
    const formattedRowsForPrompt = indexedRows
      .map(
        (r) =>
          `[${r.row_id}] Station: "${r.station_id}" | Time: "${r.timestamp}" | PM2.5: ${
            r.pm2_5 !== null ? r.pm2_5 : "MISSING"
          } | PM10: ${r.pm10 !== null ? r.pm10 : "MISSING"} | AQI: ${
            r.aqi !== null ? r.aqi : "MISSING"
          } | NO2: ${r.no2 !== null ? r.no2 : "N/A"} | Flagged: ${r.is_flagged ? `YES (${r.flag_reason})` : "NO"}`
      )
      .join("\n");

    const systemInstruction = `You are the Lead Environmental Data Scientist & Civic Intelligence Analyst for AeroSense Civic Air Quality Studio.
Your task is to analyze raw, messy air quality readings and produce an authoritative, traceable civic intelligence report.

STRICT TRACEABILITY & INTEGRITY RULES:
1. CITATIONS REQUIRED: Every hotspot, peak, trend, and anomaly MUST explicitly include the exact row IDs (e.g. ["ROW_001", "ROW_004"]) where that data appears. Never make an empirical claim without a citation.
2. AUDIT DATA INTEGRITY: You must identify missing readings, telemetry failures, and extreme anomalies, matching the pre-flagged findings.
3. SEVERITY CLASSIFICATION: Use standard AQI brackets:
   - 0-50: GOOD
   - 51-100: MODERATE
   - 101-200: UNHEALTHY_SENSITIVE
   - 201-300: UNHEALTHY
   - 301-400: VERY_UNHEALTHY
   - 401+: HAZARDOUS
4. DO NOT HALLUCINATE: Only describe phenomena that can be substantiated from the row data and station notes.

Produce a strictly valid JSON response adhering to this schema:
{
  "summary": "2-3 concise sentences summarizing overall regional air quality and immediate risks.",
  "overall_aqi_category": "GOOD | MODERATE | UNHEALTHY_SENSITIVE | UNHEALTHY | VERY_UNHEALTHY | HAZARDOUS",
  "data_health_summary": "1-2 sentences summarizing data completeness, sensor dropouts, or corrupted values.",
  "hotspots": [
    {
      "id": "HS_1",
      "location_name": "Station or Ward name",
      "pollutant_of_concern": "PM2.5 / PM10 / NO2",
      "peak_value": "e.g. 520 µg/m³",
      "timestamp": "e.g. 2026-11-14 07:00",
      "severity": "HAZARDOUS | VERY_UNHEALTHY | UNHEALTHY | UNHEALTHY_SENSITIVE | MODERATE | GOOD",
      "evidence_rows": ["ROW_001", "ROW_003"],
      "plain_language_summary": "Clear description of the localized spike",
      "likely_cause": "Traffic congestion / industrial stack / biomass / unpaved dust"
    }
  ],
  "general_trends": [
    {
      "trend_title": "Trend headline",
      "description": "Explanation of temporal or spatial trend",
      "evidence_rows": ["ROW_002", "ROW_005"]
    }
  ]
}`;

    const prompt = `Analyze this civic air quality monitoring dataset:
Brief Title: ${briefTitle || "Ward Monitoring Report"}
Total Monitored Nodes: ${indexedRows.length}

INDEXED DATA READINGS:
${formattedRowsForPrompt}

Audit Findings from Sensor Ingestion:
Total Readings: ${preliminaryAudit.total_readings}
Flagged Unreliable/Missing: ${preliminaryAudit.missing_or_corrupt_count}
Unreliable Nodes: ${JSON.stringify(preliminaryAudit.unreliable_readings)}

Analyze all nodes, identify the top hotspots, establish trends with row citations, and assess data reliability. Return valid JSON only.`;

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
        severity: "GOOD" | "MODERATE" | "UNHEALTHY_SENSITIVE" | "UNHEALTHY" | "VERY_UNHEALTHY" | "HAZARDOUS";
        evidence_rows: string[];
        plain_language_summary: string;
        likely_cause: string;
      }[];
      general_trends: {
        trend_title: string;
        description: string;
        evidence_rows: string[];
      }[];
    }>(prompt, systemInstruction, customApiKey);

    const result: AnalysisResult = {
      id: `brief_${Date.now()}`,
      brief_timestamp: new Date().toISOString(),
      brief_title: briefTitle || "Ward Air Quality Briefing",
      summary: aiResponse.summary,
      overall_aqi_category: aiResponse.overall_aqi_category || "UNHEALTHY",
      data_health: {
        ...preliminaryAudit,
        unreliable_readings: preliminaryAudit.unreliable_readings,
      },
      hotspots: (aiResponse.hotspots || []).map((h, i) => ({
        ...h,
        id: h.id || `HS_${i + 1}`,
      })),
      general_trends: aiResponse.general_trends || [],
      indexed_rows: indexedRows,
    };

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Analysis API Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
