import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import {
  AnalysisResult,
  AdvisoryLanguage,
  AdvisoryReadingLevel,
  DualAudienceAdvisory,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      analysis,
      language = "en",
      readingLevel = "Grade 5 (Plain Language)",
    }: {
      analysis: AnalysisResult;
      language: AdvisoryLanguage;
      readingLevel: AdvisoryReadingLevel;
    } = body;

    if (!analysis) {
      return NextResponse.json({ error: "Analysis data is required." }, { status: 400 });
    }

    const languageNames: Record<AdvisoryLanguage, string> = {
      en: "English",
      hi: "Hindi (हिंदी)",
      mr: "Marathi (मराठी)",
      bn: "Bengali (বাংলা)",
      ta: "Tamil (தமிழ்)",
      es: "Spanish (Español)",
    };

    const targetLang = languageNames[language] || "English";

    const readingGuidance =
      readingLevel === "Grade 5 (Plain Language)"
        ? "Use short sentences (under 15 words), warm everyday vocabulary a 10-year-old can understand, and zero medical or regulatory jargon."
        : readingLevel === "Grade 8 (Standard)"
        ? "Use clear, accessible public health journalism language suitable for general families and community noticeboards."
        : "Use precise clinical and environmental health terminology suitable for physicians, school nurses, and safety officers.";

    const systemInstruction = `You are a Multilingual Public Health Communications Director and Civic Intelligence Officer.
Your objective is to generate two distinct, publication-ready air quality documents from verified monitoring data:

DOCUMENT 1: INTERNAL TECHNICAL BRIEFING NOTE (For City Commissioners, Ward Engineers, and Health Officers)
- Reading Level: Professional / Technical.
- Focus: Quantitative exposure thresholds (e.g. 24h WHO/CPCB limits), statutory breaches, telemetry network reliability (including flagged sensor gaps), and cross-departmental coordination requirements.
- Must remain in professional English regardless of citizen language choice.

DOCUMENT 2: CITIZEN ADVISORY (For the General Public & Vulnerable Groups)
- Target Language: ${targetLang}. Every string inside citizen_advisory MUST be written naturally in ${targetLang}.
- Reading Level: ${readingLevel}. ${readingGuidance}
- CRITICAL HEALTH SAFEGUARDS (MUST INCLUDE ALL 4 DEDICATED SECTIONS WITH EXTRA CARE FOR SENSITIVE GROUPS):
  1. Children & Schools (outdoor recess, morning sports, school commute warnings, indoor alternatives)
  2. Elderly & Chronic Illness (heart/asthma/COPD precautions, staying indoors, keeping rescue inhalers & medication handy, avoiding early morning cold-air exposure)
  3. Outdoor Workers & Commuters (well-fitted N95/KN95 masking, hydration, pacing strenuous physical activity during peak hours)
  4. General Public (indoor air hygiene, ventilation timing, avoiding biomass/trash burning)
  5. Clear, actionable Do's and Don'ts.

Output format must be strictly valid JSON:
{
  "reading_level": "${readingLevel}",
  "language": "${language}",
  "internal_briefing_note": {
    "executive_overview": "Concise high-level technical summary in English",
    "statutory_threshold_breaches": ["Specific pollutant breaches vs CPCB/WHO standards in English"],
    "sensor_network_integrity": "Summary of active vs dropped or uncalibrated nodes in English",
    "inter_agency_action_items": ["Action item for Transport / Sanitation / Health / Schools in English"]
  },
  "citizen_advisory": {
    "headline": "Impactful headline in ${targetLang}",
    "alert_summary": "Alert summary in ${targetLang} calibrated to ${readingLevel}",
    "sensitive_group_care": [
      {
        "group_name": "Children & Schools",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation 1 in ${targetLang}", "Recommendation 2 in ${targetLang}"]
      },
      {
        "group_name": "Elderly & Chronic Illness",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation 1 in ${targetLang}", "Recommendation 2 in ${targetLang}"]
      },
      {
        "group_name": "Outdoor Workers & Commuters",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation 1 in ${targetLang}", "Recommendation 2 in ${targetLang}"]
      },
      {
        "group_name": "General Public",
        "caution_level": "High Alert | Moderate Caution | Standard",
        "recommendations": ["Recommendation 1 in ${targetLang}", "Recommendation 2 in ${targetLang}"]
      }
    ],
    "dos_and_donts": {
      "dos": ["Do item 1 in ${targetLang}", "Do item 2 in ${targetLang}", "Do item 3 in ${targetLang}"],
      "donts": ["Don't item 1 in ${targetLang}", "Don't item 2 in ${targetLang}", "Don't item 3 in ${targetLang}"]
    }
  }
}`;

    const prompt = `Produce the dual-audience briefing materials for this situation:
Brief Title: ${analysis.brief_title}
Overall Air Quality: ${analysis.overall_aqi_category}
Summary: ${analysis.summary}
Active Hotspots: ${analysis.hotspots
      .map((h) => `${h.location_name}: ${h.peak_value} (${h.severity}, cause: ${h.likely_cause})`)
      .join("; ")}
Sensor Health: ${analysis.data_health.missing_or_corrupt_count} out of ${
      analysis.data_health.total_readings
    } stations reporting data gaps (${analysis.data_health.unreliable_readings
      .map((u) => `${u.station}: ${u.issue}`)
      .join("; ") || "None"}).

Generate the Internal Technical Note (English) and the Citizen Advisory (${targetLang}) at ${readingLevel}. Return valid JSON only.`;

    const aiResponse = await generateStructuredJson<DualAudienceAdvisory>(
      prompt,
      systemInstruction,
      "gemini-3.1-flash-lite"
    );

    return NextResponse.json({
      ...aiResponse,
      language,
      reading_level: readingLevel,
    });
  } catch (error: unknown) {
    console.error("Advisory API Error:", error);
    const status =
      typeof (error as { status?: number })?.status === "number"
        ? (error as { status: number }).status
        : 500;
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status });
  }
}
