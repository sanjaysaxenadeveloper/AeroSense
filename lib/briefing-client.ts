import { toCompactAnalysisPayload } from "./briefing-helpers";
import type {
  AdvisoryLanguage,
  AdvisoryReadingLevel,
  AnalysisResult,
  BriefComparisonResult,
  DualAudienceAdvisory,
  RoleRecommendations,
} from "./types";

const SAVED_BRIEFS_KEY = "aerosense_saved_briefs";
const MAX_SAVED_BRIEFS = 5;

async function postJson<TResponse>(url: string, body: unknown, fallbackError: string): Promise<TResponse> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || fallbackError);
  }
  return data as TResponse;
}

export function loadSavedBriefsFromStorage(): AnalysisResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(SAVED_BRIEFS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (b): b is AnalysisResult =>
        Boolean(b && typeof b === "object" && typeof b.id === "string" && typeof b.brief_title === "string")
    );
  } catch {
    return [];
  }
}

export function saveBriefsToStorage(briefs: AnalysisResult[]): void {
  if (typeof window === "undefined") return;
  try {
    const compactList = briefs.slice(0, MAX_SAVED_BRIEFS).map((b) => toCompactAnalysisPayload(b, true));
    window.localStorage.setItem(SAVED_BRIEFS_KEY, JSON.stringify(compactList));
  } catch {
    // Gracefully skip persistence if browser storage quota is restricted
  }
}

export function fetchBriefAnalysis(rawText: string, briefTitle: string): Promise<AnalysisResult> {
  return postJson<AnalysisResult>(
    "/api/analyze",
    { rawText, briefTitle },
    "Analysis request failed."
  );
}

export function fetchRoleRecommendations(
  analysis: AnalysisResult,
  focusQuestion?: string
): Promise<RoleRecommendations> {
  return postJson<RoleRecommendations>(
    "/api/recommendations",
    { analysis: toCompactAnalysisPayload(analysis, true), focusQuestion },
    "Failed to generate role recommendations."
  );
}

export function fetchBriefComparison(
  currentBrief: AnalysisResult,
  previousBrief: AnalysisResult
): Promise<BriefComparisonResult> {
  return postJson<BriefComparisonResult>(
    "/api/compare",
    {
      currentBrief: toCompactAnalysisPayload(currentBrief, true),
      previousBrief: toCompactAnalysisPayload(previousBrief, true),
    },
    "Failed to compare briefs."
  );
}

export function fetchDualAdvisory(
  analysis: AnalysisResult,
  language: AdvisoryLanguage,
  readingLevel: AdvisoryReadingLevel
): Promise<DualAudienceAdvisory> {
  return postJson<DualAudienceAdvisory>(
    "/api/advisory",
    { analysis: toCompactAnalysisPayload(analysis, false), language, readingLevel },
    "Failed to generate advisory."
  );
}

export function fetchHfDatasetCsv(
  city: string,
  date: string,
  maxRows: number = 30
): Promise<{ csvText: string; title: string; sourceUrl: string; rowCount: number }> {
  return postJson(
    "/api/dataset",
    { source: "hf_aqi_india", city, date, maxRows },
    "Failed to fetch baseline dataset from Hugging Face."
  );
}
