import type { AdvisoryLanguage, AdvisoryReadingLevel } from "./types";

export const MAX_UPLOAD_BYTES = 500_000;
export const MAX_REMOTE_FETCH_BYTES = 2 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 1_000_000;

export const HF_AQI_DATASET = {
  repo: "AdityaaXD/AQI-Of-India",
  url: "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India",
  minDate: "2015-01-01",
  maxDate: "2020-07-01",
  defaultDate: "2019-11-03",
  comparisonDate: "2019-11-06",
  defaultCity: "Delhi",
} as const;

export const ADVISORY_LANGUAGES: ReadonlyArray<{
  code: AdvisoryLanguage;
  label: string;
  englishName: string;
}> = [
  { code: "en", label: "English", englishName: "English" },
  { code: "hi", label: "हिंदी (Hindi)", englishName: "Hindi (हिंदी)" },
  { code: "mr", label: "मराठी (Marathi)", englishName: "Marathi (मराठी)" },
  { code: "bn", label: "বাংলা (Bengali)", englishName: "Bengali (বাংলা)" },
  { code: "ta", label: "தமிழ் (Tamil)", englishName: "Tamil (தமிழ்)" },
  { code: "es", label: "Español (Spanish)", englishName: "Spanish (Español)" },
];

export const ADVISORY_READING_LEVELS: ReadonlyArray<AdvisoryReadingLevel> = [
  "Grade 5 (Plain Language)",
  "Grade 8 (Standard)",
  "Technical / Specialist",
];

export function getAqiSeverityBadgeClass(severity: string): string {
  switch (severity) {
    case "HAZARDOUS":
      return "text-red-800 bg-red-50 border-red-200";
    case "VERY_UNHEALTHY":
      return "text-purple-800 bg-purple-50 border-purple-200";
    case "UNHEALTHY":
      return "text-amber-800 bg-amber-50 border-amber-200";
    case "UNHEALTHY_SENSITIVE":
      return "text-orange-800 bg-orange-50 border-orange-200";
    default:
      return "text-emerald-800 bg-emerald-50 border-emerald-200";
  }
}

export function getNumericAqiBadgeClass(aqi: number): string {
  if (aqi > 400) return "text-red-800 bg-red-50 border-red-200";
  if (aqi > 300) return "text-purple-800 bg-purple-50 border-purple-200";
  if (aqi > 200) return "text-amber-800 bg-amber-50 border-amber-200";
  if (aqi > 100) return "text-orange-800 bg-orange-50 border-orange-200";
  return "text-emerald-800 bg-emerald-50 border-emerald-200";
}
