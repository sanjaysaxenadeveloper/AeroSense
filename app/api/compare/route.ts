import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { AnalysisResult, BriefComparisonResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      currentBrief,
      previousBrief,
    }: { currentBrief: AnalysisResult; previousBrief: AnalysisResult } = body;

    if (!currentBrief || !previousBrief) {
      return NextResponse.json(
        { error: "Both currentBrief and previousBrief are required for comparison." },
        { status: 400 }
      );
    }

    // Compute quantitative station-by-station AQI / PM2.5 deltas when stations match
    const prevByStation = new Map(
      (previousBrief.indexed_rows || []).map((r) => [
        (r.station_id || "").toLowerCase().trim(),
        r,
      ])
    );
    const stationDeltas: string[] = [];
    for (const currRow of currentBrief.indexed_rows || []) {
      const key = (currRow.station_id || "").toLowerCase().trim();
      const prevRow = prevByStation.get(key);
      if (prevRow && currRow.pm2_5 != null && prevRow.pm2_5 != null) {
        const diff = Math.round((currRow.pm2_5 - prevRow.pm2_5) * 10) / 10;
        const sign = diff > 0 ? `+${diff}` : `${diff}`;
        stationDeltas.push(
          `${currRow.station_id}: PM2.5 ${prevRow.pm2_5} → ${currRow.pm2_5} µg/m³ (${sign})${
            currRow.notes ? ` [Note: ${currRow.notes}]` : ""
          }`
        );
      } else if (!prevRow) {
        stationDeltas.push(
          `${currRow.station_id}: New station in current brief (PM2.5: ${currRow.pm2_5 ?? "Missing"})`
        );
      } else if (prevRow.pm2_5 == null && currRow.pm2_5 != null) {
        stationDeltas.push(
          `${currRow.station_id}: Sensor recovered from gap (now PM2.5 ${currRow.pm2_5} µg/m³)`
        );
      }
    }

    const systemInstruction = `You are a Municipal Environmental Auditor for AeroSense.
Your task is to conduct a precise delta analysis between a PREVIOUS air quality brief and a CURRENT air quality brief.

ANALYTICAL OBJECTIVES:
1. QUANTITATIVE DELTA: Determine if overall air quality is IMPROVING, DETERIORATING, STABLE, or MIXED based on station-level PM2.5/AQI shifts and hotspot changes.
2. HOTSPOT DYNAMICS:
   - Identify newly emerged hotspots (or stations where telemetry recovered to reveal a hotspot).
   - Identify resolved or significantly mitigated hotspots.
   - Identify persistent chronic hotspots.
3. INTERVENTION EFFICACY: Provide a data-driven assessment of whether localized municipal or resident interventions (e.g. water sprinklers, traffic diversions, DG restrictions, boiler curfews) appear to have yielded measurable relief.

Output format must be strictly valid JSON:
{
  "previous_brief_date": "Timestamp or title string",
  "current_brief_date": "Timestamp or title string",
  "overall_trend": "IMPROVING | DETERIORATING | STABLE | MIXED",
  "aqi_delta_summary": "2-3 sentences explaining numeric changes, percentage/unit shifts, and major changes",
  "new_hotspots": ["List of new hotspot names with brief change detail"],
  "resolved_hotspots": ["List of locations that improved or dropped below critical thresholds"],
  "persistent_hotspots": ["List of locations remaining hazardous or very unhealthy"],
  "intervention_efficacy_assessment": "Critical evaluation of whether local interventions made an observable impact"
}`;

    const prompt = `Compare these two civic air quality briefs:

PREVIOUS BRIEF (${previousBrief.brief_title} - ${previousBrief.brief_timestamp}):
- Category: ${previousBrief.overall_aqi_category}
- Summary: ${previousBrief.summary}
- Hotspots: ${previousBrief.hotspots.map((h) => `${h.location_name} (${h.peak_value}, ${h.severity})`).join("; ")}

CURRENT BRIEF (${currentBrief.brief_title} - ${currentBrief.brief_timestamp}):
- Category: ${currentBrief.overall_aqi_category}
- Summary: ${currentBrief.summary}
- Hotspots: ${currentBrief.hotspots.map((h) => `${h.location_name} (${h.peak_value}, ${h.severity})`).join("; ")}

STATION-BY-STATION NUMERIC DELTAS:
${stationDeltas.length > 0 ? stationDeltas.join("\n") : "Stations differ across briefs; compare regional averages and hotspot severity."}

Produce the delta comparison report. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<BriefComparisonResult>(
      prompt,
      systemInstruction
    );

    return NextResponse.json(aiResponse);
  } catch (error: unknown) {
    console.error("Compare API Error:", error);
    const status =
      typeof (error as { status?: number })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
