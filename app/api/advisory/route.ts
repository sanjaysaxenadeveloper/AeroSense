import { NextRequest, NextResponse } from "next/server";
import { generateStructuredJson } from "@/lib/gemini";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limiter";
import {
  getHttpErrorDetails,
  parseJsonBody,
  validateAdvisoryPayload,
} from "@/lib/validation";
import type {
  AdvisoryLanguage,
  DualAudienceAdvisory,
} from "@/lib/types";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`advisory:${getClientIdentifier(req)}`, 30, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded for advisory generation. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const { analysis, language, readingLevel } = validateAdvisoryPayload(body);

    const languageNames: Record<AdvisoryLanguage, string> = {
      en: "English",
      hi: "Hindi (हिंदी)",
      mr: "Marathi (मराठी)",
      bn: "Bengali (বাংলা)",
      ta: "Tamil (தமிழ்)",
      es: "Spanish (Español)",
    };

    const targetLang = languageNames[language];

    const readingGuidance =
      readingLevel === "Grade 5 (Plain Language)"
        ? "Use short sentences (under 15 words), warm everyday vocabulary a 10-year-old can understand, and zero medical or regulatory jargon."
        : readingLevel === "Grade 8 (Standard)"
        ? "Use clear, accessible public health journalism language suitable for general families and community noticeboards."
        : "Use precise clinical and environmental health terminology suitable for physicians, school nurses, and safety officers.";

    const systemInstruction = `You are a Multilingual Public Health Communications Director and Civic Intelligence Officer.
Generate two distinct, publication-ready air quality documents from verified monitoring data:

DOCUMENT 1: INTERNAL TECHNICAL BRIEFING NOTE (English)
- Focus: Quantitative exposure thresholds (WHO/CPCB), statutory breaches, telemetry integrity, cross-departmental directives.

DOCUMENT 2: CITIZEN ADVISORY (${targetLang}, ${readingLevel})
- Every string inside citizen_advisory MUST be written naturally in ${targetLang}. ${readingGuidance}
- MUST include all 4 dedicated sections:
  1. Children & Schools
  2. Elderly & Chronic Illness
  3. Outdoor Workers & Commuters
  4. General Public
  plus actionable Do's and Don'ts.

Output strictly valid JSON:
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

    const prompt = `Produce dual-audience briefing materials:
Brief Title: ${analysis.brief_title}
Overall Air Quality: ${analysis.overall_aqi_category}
Summary: ${analysis.summary}
Active Hotspots: ${analysis.hotspots
      .slice(0, 10)
      .map((h) => `${h.location_name}: ${h.peak_value} (${h.severity}, cause: ${h.likely_cause})`)
      .join("; ")}
Sensor Health: ${analysis.data_health.missing_or_corrupt_count} of ${
      analysis.data_health.total_readings
    } stations flagged.

Generate the Internal Technical Note (English) and Citizen Advisory (${targetLang}) at ${readingLevel}. Return valid JSON only.`;

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
    const { status, message } = getHttpErrorDetails(error);
    return NextResponse.json({ error: message }, { status });
  }
}
