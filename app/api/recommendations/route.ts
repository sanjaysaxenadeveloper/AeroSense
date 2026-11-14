import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { AnalysisResult, RoleRecommendations } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      analysis,
      focusQuestion,
    }: { analysis: AnalysisResult; focusQuestion?: string } = body;

    if (!analysis || !analysis.hotspots) {
      return NextResponse.json(
        { error: "Valid analysis result is required to generate recommendations." },
        { status: 400 }
      );
    }

    const validRowIds = new Set((analysis.indexed_rows || []).map((r) => r.row_id));

    const systemInstruction = `You are an Urban Environmental Policy Specialist & Municipal Incident Commander for AeroSense.
Your objective is to translate air quality findings and hotspot alerts into actionable, prioritized interventions suited to who is asking.

ROLES AND SPECIFIC REMITS:
1. WARD OFFICER (Municipal Authority):
   - Authority over municipal resources: Anti-smog guns, mechanized road sweeping, traffic police coordination, construction dust halt orders, solid waste burning enforcement, sensor maintenance dispatch for flagged/offline nodes.
   - Immediate vs 24-hr containment actions.
2. HOUSING SOCIETY (Residents Welfare Association / Gated Community):
   - Jurisdiction over apartment complexes: Banning or throttling Diesel Generator (DG) power backups, pausing outdoor landscaping/leaf blowers, scheduling window closures, setting up community clean air refuge rooms, advising domestic staff/security guards.
3. SCHOOL PRINCIPAL (Educational Institutions):
   - Duty of care for pediatric health: Mandatory cancellation of outdoor sports/assemblies, sealing classroom windows / running HEPA purifiers, dispatching advisory notifications to parents of asthmatic children, regulating school bus idling, shifting PE indoors.

REQUIREMENTS:
- Each persona must have 3-4 distinct, prioritized, highly realistic actions tailored specifically to their jurisdiction (never give municipal enforcement orders to a school, or school assembly orders to a ward officer).
- Each action must cite the specific hotspot and valid evidence row IDs (from the dataset) that triggered it.
- Assign an explicit urgency: "IMMEDIATE (0-4h)", "24-HOUR", or "PLANNED POLICY".
${focusQuestion ? `- Address the user's specific operational question where relevant: "${focusQuestion}"` : ""}

Output format must be strictly valid JSON matching:
{
  "ward_officer": [
    {
      "id": "WO_1",
      "action_title": "Action title",
      "description": "Specific tactical action",
      "urgency": "IMMEDIATE (0-4h) | 24-HOUR | PLANNED POLICY",
      "target_location": "Targeted Ward / Corridor",
      "expected_impact": "Quantifiable reduction expectation",
      "triggered_by_hotspot": "Hotspot name or location",
      "evidence_rows": ["ROW_001"]
    }
  ],
  "housing_society": [...],
  "school_principal": [...]
}`;

    const prompt = `Formulate targeted civic interventions for this situation:
Overall AQI Category: ${analysis.overall_aqi_category}
Regional Summary: ${analysis.summary}
${focusQuestion ? `Specific Stakeholder Question / Focus: ${focusQuestion}\n` : ""}
ACTIVE HOTSPOTS TO MITIGATE:
${analysis.hotspots
  .map(
    (h) =>
      `- [${h.id}] Location: ${h.location_name} | Pollutant: ${h.pollutant_of_concern} | Peak: ${
        h.peak_value
      } | Severity: ${h.severity} | Evidence Rows: ${h.evidence_rows.join(", ")} | Likely Cause: ${h.likely_cause}`
  )
  .join("\n")}

AUDIT STATUS:
Total Stations Monitored: ${analysis.data_health.total_readings}
Unreliable Stations: ${analysis.data_health.missing_or_corrupt_count} (${analysis.data_health.unreliable_readings
      .map((u) => `${u.row_id}: ${u.station}`)
      .join(", ") || "None"})

Generate prioritized action matrices for Ward Officers, Housing Societies, and School Principals. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<RoleRecommendations>(
      prompt,
      systemInstruction,
      "gemini-3.1-flash-lite"
    );

    const sanitizeActions = (actions: RoleRecommendations["ward_officer"] = []) =>
      actions.map((a) => ({
        ...a,
        evidence_rows:
          validRowIds.size > 0
            ? (a.evidence_rows || []).filter((id) => validRowIds.has(id))
            : a.evidence_rows || [],
      }));

    return NextResponse.json({
      ward_officer: sanitizeActions(aiResponse.ward_officer),
      housing_society: sanitizeActions(aiResponse.housing_society),
      school_principal: sanitizeActions(aiResponse.school_principal),
    });
  } catch (error: unknown) {
    console.error("Recommendations API Error:", error);
    const status =
      typeof (error as { status?: number })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
