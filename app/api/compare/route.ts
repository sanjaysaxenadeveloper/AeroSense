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
    const customApiKey = req.headers.get("x-gemini-api-key") || body.customApiKey;

    if (!currentBrief || !previousBrief) {
      return NextResponse.json(
        { error: "Both currentBrief and previousBrief are required for comparison." },
        { status: 400 }
      );
    }

    const systemInstruction = `You are a Municipal Environmental Auditor for AeroSense.
Your task is to conduct a delta analysis between a PREVIOUS air quality brief and a CURRENT air quality brief.

ANALYTICAL OBJECTIVES:
1. QUANTITATIVE DELTA: Determine if overall air quality is IMPROVING, DETERIORATING, STABLE, or MIXED.
2. HOTSPOT DYNAMICS:
   - Identify newly emerged hotspots.
   - Identify resolved or mitigated hotspots.
   - Identify persistent chronic hotspots.
3. INTERVENTION EFFICACY: Provide a data-driven assessment of whether localized municipal or resident interventions (e.g. water sprinklers, traffic diversions, DG restrictions) appear to have yielded measurable relief.

Output format must be strictly valid JSON:
{
  "previous_brief_date": "Timestamp string",
  "current_brief_date": "Timestamp string",
  "overall_trend": "IMPROVING | DETERIORATING | STABLE | MIXED",
  "aqi_delta_summary": "2-3 sentences explaining numeric changes and major shifts",
  "new_hotspots": ["List of new hotspot names"],
  "resolved_hotspots": ["List of locations that dropped below alert thresholds"],
  "persistent_hotspots": ["List of locations remaining hazardous"],
  "intervention_efficacy_assessment": "Critical evaluation of whether local interventions made an observable impact"
}`;

    const prompt = `Compare these two consecutive civic air quality briefs:

PREVIOUS BRIEF (${previousBrief.brief_title} - ${previousBrief.brief_timestamp}):
- Category: ${previousBrief.overall_aqi_category}
- Summary: ${previousBrief.summary}
- Hotspots: ${previousBrief.hotspots.map((h) => `${h.location_name} (${h.peak_value}, ${h.severity})`).join("; ")}

CURRENT BRIEF (${currentBrief.brief_title} - ${currentBrief.brief_timestamp}):
- Category: ${currentBrief.overall_aqi_category}
- Summary: ${currentBrief.summary}
- Hotspots: ${currentBrief.hotspots.map((h) => `${h.location_name} (${h.peak_value}, ${h.severity})`).join("; ")}

Produce the delta comparison report. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<BriefComparisonResult>(
      prompt,
      systemInstruction,
      customApiKey
    );

    return NextResponse.json(aiResponse);
  } catch (error: unknown) {
    console.error("Compare API Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
