import type { NextRequest } from "next/server";
import type {
  AdvisoryLanguage,
  AdvisoryReadingLevel,
  AnalysisResult,
} from "./types";

export const MAX_JSON_BODY_BYTES = 1_000_000;
export const MAX_UPLOAD_BYTES = 500_000;

export class AppHttpError extends Error {
  status: number;

  constructor(message: string, status: number = 400) {
    super(message);
    this.name = "AppHttpError";
    this.status = status;
  }
}

export function getHttpErrorDetails(error: unknown): { status: number; message: string } {
  if (error instanceof AppHttpError) {
    return { status: error.status, message: error.message };
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
  ) {
    const status = (error as { status: number }).status;
    const message =
      error instanceof Error && error.message ? error.message : "Request failed.";
    return { status, message };
  }
  return {
    status: 500,
    message: error instanceof Error ? error.message : "Internal server error",
  };
}

export function sanitizeText(value: unknown, maxLength: number): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
}

export async function parseJsonBody<T>(req: NextRequest): Promise<T> {
  const contentLengthHeader = req.headers?.get("content-length");
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_JSON_BODY_BYTES) {
      throw new AppHttpError("Request payload exceeds maximum allowed size (1 MB).", 413);
    }
  }

  try {
    const body = (await req.json()) as unknown;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AppHttpError("Request body must be a JSON object.", 400);
    }
    return body as T;
  } catch (err) {
    if (err instanceof AppHttpError) throw err;
    throw new AppHttpError("Malformed JSON request body.", 400);
  }
}

const VALID_LANGUAGES = new Set<AdvisoryLanguage>(["en", "hi", "mr", "bn", "ta", "es"]);
const VALID_READING_LEVELS = new Set<AdvisoryReadingLevel>([
  "Grade 5 (Plain Language)",
  "Grade 8 (Standard)",
  "Technical / Specialist",
]);

function boundAnalysisPayload(analysis: AnalysisResult): AnalysisResult {
  return {
    ...analysis,
    hotspots: (analysis.hotspots || []).slice(0, 50),
    general_trends: (analysis.general_trends || []).slice(0, 30),
    indexed_rows: Array.isArray(analysis.indexed_rows)
      ? analysis.indexed_rows.slice(0, 250)
      : [],
  };
}

export function validateAnalyzePayload(body: Record<string, unknown>): {
  rawText: string;
  briefTitle: string;
} {
  const rawText = typeof body.rawText === "string" ? body.rawText : "";
  if (!rawText.trim()) {
    throw new AppHttpError("No raw data provided.", 400);
  }
  if (rawText.length > MAX_UPLOAD_BYTES) {
    throw new AppHttpError(
      "Input exceeds 500 KB limit. Please upload or slice a smaller station window.",
      400
    );
  }
  const cleanRaw = rawText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const briefTitle = sanitizeText(body.briefTitle, 160);
  return { rawText: cleanRaw, briefTitle };
}

export function validateRecommendationsPayload(body: Record<string, unknown>): {
  analysis: AnalysisResult;
  focusQuestion: string;
} {
  const analysis = body.analysis as AnalysisResult | undefined;
  if (!analysis || typeof analysis !== "object" || !Array.isArray(analysis.hotspots)) {
    throw new AppHttpError(
      "Valid analysis result is required to generate recommendations.",
      400
    );
  }
  const focusQuestion = sanitizeText(body.focusQuestion, 300);
  return { analysis: boundAnalysisPayload(analysis), focusQuestion };
}

export function validateComparePayload(body: Record<string, unknown>): {
  currentBrief: AnalysisResult;
  previousBrief: AnalysisResult;
} {
  const currentBrief = body.currentBrief as AnalysisResult | undefined;
  const previousBrief = body.previousBrief as AnalysisResult | undefined;
  if (
    !currentBrief ||
    !previousBrief ||
    typeof currentBrief !== "object" ||
    typeof previousBrief !== "object"
  ) {
    throw new AppHttpError(
      "Both currentBrief and previousBrief are required for comparison.",
      400
    );
  }
  return {
    currentBrief: boundAnalysisPayload(currentBrief),
    previousBrief: boundAnalysisPayload(previousBrief),
  };
}

export function validateAdvisoryPayload(body: Record<string, unknown>): {
  analysis: AnalysisResult;
  language: AdvisoryLanguage;
  readingLevel: AdvisoryReadingLevel;
} {
  const analysis = body.analysis as AnalysisResult | undefined;
  if (!analysis || typeof analysis !== "object" || !Array.isArray(analysis.hotspots)) {
    throw new AppHttpError("Analysis data is required.", 400);
  }
  const rawLang = typeof body.language === "string" ? (body.language as AdvisoryLanguage) : "en";
  const rawLevel =
    typeof body.readingLevel === "string"
      ? (body.readingLevel as AdvisoryReadingLevel)
      : "Grade 5 (Plain Language)";

  if (!VALID_LANGUAGES.has(rawLang)) {
    throw new AppHttpError(
      "Unsupported advisory language. Allowed codes: en, hi, mr, bn, ta, es.",
      400
    );
  }
  if (!VALID_READING_LEVELS.has(rawLevel)) {
    throw new AppHttpError("Unsupported reading level selected.", 400);
  }

  return {
    analysis: boundAnalysisPayload(analysis),
    language: rawLang,
    readingLevel: rawLevel,
  };
}
