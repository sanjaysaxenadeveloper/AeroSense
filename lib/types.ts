export interface RawDataRow {
  row_id: string; // e.g. "ROW_001"
  timestamp?: string;
  station_id?: string;
  location?: string;
  pm2_5?: number | null;
  pm10?: number | null;
  aqi?: number | null;
  no2?: number | null;
  so2?: number | null;
  co?: number | null;
  humidity?: number | null;
  temp?: number | null;
  unit_pm?: string;
  notes?: string;
  is_flagged?: boolean;
  flag_reason?: string;
  raw_text?: string;
}

export interface DataAuditReport {
  total_readings: number;
  valid_readings_count: number;
  missing_or_corrupt_count: number;
  detected_units: string[];
  unit_conversions?: string[];
  unreliable_readings: {
    row_id: string;
    station: string;
    issue: string;
  }[];
}

export interface HotspotFinding {
  id: string;
  location_name: string;
  pollutant_of_concern: string;
  peak_value: string;
  timestamp: string;
  severity: "GOOD" | "MODERATE" | "UNHEALTHY_SENSITIVE" | "UNHEALTHY" | "VERY_UNHEALTHY" | "HAZARDOUS";
  evidence_rows: string[]; // e.g. ["ROW_004", "ROW_007"]
  plain_language_summary: string;
  likely_cause: string;
}

export interface TrendFinding {
  trend_title: string;
  description: string;
  evidence_rows: string[];
}

export interface AnalysisResult {
  id: string;
  brief_timestamp: string;
  brief_title: string;
  summary: string;
  overall_aqi_category: string;
  data_health_summary?: string;
  data_health: DataAuditReport;
  hotspots: HotspotFinding[];
  general_trends: TrendFinding[];
  indexed_rows: RawDataRow[];
}

export interface RoleAction {
  id: string;
  action_title: string;
  description: string;
  urgency: "IMMEDIATE (0-4h)" | "24-HOUR" | "PLANNED POLICY";
  target_location: string;
  expected_impact: string;
  triggered_by_hotspot: string;
  evidence_rows: string[];
}

export interface RoleRecommendations {
  ward_officer: RoleAction[];
  housing_society: RoleAction[];
  school_principal: RoleAction[];
}

export interface BriefComparisonResult {
  previous_brief_date: string;
  current_brief_date: string;
  overall_trend: "IMPROVING" | "DETERIORATING" | "STABLE" | "MIXED";
  aqi_delta_summary: string;
  new_hotspots: string[];
  resolved_hotspots: string[];
  persistent_hotspots: string[];
  intervention_efficacy_assessment: string;
}

export interface CitizenCareInstruction {
  group_name: "Children & Schools" | "Elderly & Chronic Illness" | "Outdoor Workers & Commuters" | "General Public";
  caution_level: "High Alert" | "Moderate Caution" | "Standard";
  recommendations: string[];
}

export type AdvisoryLanguage = "en" | "hi" | "mr" | "bn" | "ta" | "es";
export type AdvisoryReadingLevel =
  | "Grade 5 (Plain Language)"
  | "Grade 8 (Standard)"
  | "Technical / Specialist";

export interface DualAudienceAdvisory {
  reading_level: AdvisoryReadingLevel;
  language: AdvisoryLanguage;
  internal_briefing_note: {
    executive_overview: string;
    statutory_threshold_breaches: string[];
    sensor_network_integrity: string;
    inter_agency_action_items: string[];
  };
  citizen_advisory: {
    headline: string;
    alert_summary: string;
    sensitive_group_care: CitizenCareInstruction[];
    dos_and_donts: {
      dos: string[];
      donts: string[];
    };
  };
}
