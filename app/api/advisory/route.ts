import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { AnalysisResult, DualAudienceAdvisory } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      analysis,
      language = "en",
      readingLevel = "Grade 5 (Plain Language)",
    }: {
      analysis: AnalysisResult;
      language: "en" | "hi" | "mr" | "bn";
      readingLevel: "Grade 5 (Plain Language)" | "Grade 8 (Standard)" | "Technical / Specialist";
    } = body;
    const customApiKey = req.headers.get("x-gemini-api-key") || body.customApiKey;

    if (!analysis) {
      return NextResponse.json({ error: "Analysis data is required." }, { status: 400 });
    }

    const languageNames: Record<string, string> = {
      en: "English",
      hi: "Hindi (हिंदी)",
      mr: "Marathi (मराठी)",
      bn: "Bengali (বাংলা)",
    };

    const targetLang = languageNames[language] || "English";

    const systemInstruction = `You are a Bilingual Public Health Communications Director and Civic Intelligence Officer.
Your objective is to generate two distinct, publication-ready air quality documents from verified monitoring data:

DOCUMENT 1: INTERNAL TECHNICAL BRIEFING NOTE (For City Commissioners, Ward Engineers, and Health Officers)
- Reading Level: Professional / Technical.
- Focus: Quantitative exposure thresholds (e.g. 24h WHO/CPCB limits), statutory breaches, telemetry network reliability, and cross-departmental coordination requirements.
- Must remain in professional English regardless of citizen language choice.

DOCUMENT 2: CITIZEN ADVISORY (For the General Public & Vulnerable Groups)
- Target Language: ${targetLang}.
- Reading Level: ${readingLevel}. If Grade 5, use simple, friendly, empathetic everyday words; avoid clinical jargon like "respiratory epithelial inflammation" and say "protect tender lungs".
- CRITICAL HEALTH SAFEGUARDS (MUST INCLUDE DEDICATED SECTIONS):
  1. Children & Schools (outdoor recess, morning sports, school commute warnings)
  2. Elderly & Chronic Illness (heart/asthma precautions, staying indoors, keeping rescue inhalers handy)
  3. Outdoor Workers & Commuters (N95 masking, hydration, reducing strenuous physical activity during peak hours)
  4. Clear, actionable Do's and Don'ts.

Output format must be strictly valid JSON:
{
  "reading_level": "${readingLevel}",
  "language": "${language}",
  "internal_briefing_note": {
    "executive_overview": "Concise high-level technical summary",
    "statutory_threshold_breaches": ["Specific pollutant breaches vs CPCB/WHO standards"],
    "sensor_network_integrity": "Summary of active vs dropped or uncalibrated nodes",
    "inter_agency_action_items": ["Action item for Transport / Sanitation / Health"]
  },
  "citizen_advisory": {
    "headline": "Impactful headline in ${targetLang}",
    "alert_summary": "Plain language alert in ${targetLang}",
    "sensitive_group_care": [
      {
        "group_name": "Children & Schools",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation in ${targetLang}"]
      },
      {
        "group_name": "Elderly & Chronic Illness",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation in ${targetLang}"]
      },
      {
        "group_name": "Outdoor Workers & Commuters",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation in ${targetLang}"]
      },
      {
        "group_name": "General Public",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation in ${targetLang}"]
      }
    ],
    "dos_and_donts": {
      "dos": ["Do item 1 in ${targetLang}", "Do item 2 in ${targetLang}"],
      "donts": ["Don't item 1 in ${targetLang}", "Don't item 2 in ${targetLang}"]
    }
  }
}`;

    const prompt = `Produce the dual-audience briefing materials for this situation:
Overall Air Quality: ${analysis.overall_aqi_category}
Summary: ${analysis.summary}
Active Hotspots: ${analysis.hotspots
      .map((h) => `${h.location_name}: ${h.peak_value} (${h.severity})`)
      .join(", ")}
Sensor Health: ${analysis.data_health.missing_or_corrupt_count} out of ${
      analysis.data_health.total_readings
    } stations reporting data gaps.

Generate the Internal Technical Note (English) and the Citizen Advisory (${targetLang}) at ${readingLevel}. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<DualAudienceAdvisory>(
      prompt,
      systemInstruction,
      customApiKey
    );

    return NextResponse.json(aiResponse);
  } catch (error: unknown) {
    console.error("Advisory API Error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
