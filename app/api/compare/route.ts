import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { computeStationDeltas } from "@/lib/briefing-helpers";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import {
  getHttpErrorDetails,
  parseJsonBody,
  validateComparePayload,
} from "@/lib/validation";
import type { BriefComparisonResult } from "@/lib/types";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`compare:${getClientIdentifier(req)}`, 25, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for brief comparisons. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const { currentBrief, previousBrief } = validateComparePayload(body);

    const stationDeltas = computeStationDeltas(
      currentBrief.indexed_rows,
      previousBrief.indexed_rows
    );

    const systemInstruction = `You are a Municipal Environmental Auditor for AeroSense.
Conduct a precise delta analysis between a PREVIOUS air quality brief and a CURRENT air quality brief.

ANALYTICAL OBJECTIVES:
1. QUANTITATIVE DELTA: Classify overall_trend as IMPROVING, DETERIORATING, STABLE, or MIXED based on station PM2.5/AQI shifts and hotspot changes.
2. HOTSPOT DYNAMICS: Identify new_hotspots, resolved_hotspots, and persistent_hotspots.
3. INTERVENTION EFFICACY: Evaluate whether local interventions yielded measurable relief.

Output strictly valid JSON:
{
  "previous_brief_date": "Timestamp or title string",
  "current_brief_date": "Timestamp or title string",
  "overall_trend": "IMPROVING | DETERIORATING | STABLE | MIXED",
  "aqi_delta_summary": "2-3 sentences explaining numeric changes, unit shifts, and major changes",
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
${
  stationDeltas.length > 0
    ? stationDeltas.slice(0, 40).join("\n")
    : "Stations differ across briefs; compare regional averages and hotspot severity."
}

Produce the delta comparison report. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<BriefComparisonResult>(
      prompt,
      systemInstruction,
      "gemini-4-hydrogen"
    );

    return NextResponse.json(aiResponse);
  } catch (error: unknown) {
    console.error("Compare API Error:", error);
    const { status, message } = getHttpErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}
