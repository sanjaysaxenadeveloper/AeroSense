import type { AnalysisResult, RawDataRow } from "./types";

/**
 * Validates model-returned row citations against actual indexed rows,
 * with deterministic fallback matching by station name when needed.
 */
export function sanitizeRowCitations(
  rowIds: string[] | undefined,
  validRowIds: Set<string>,
  indexedRows: RawDataRow[],
  fallbackLocation?: string
): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const id of rowIds || []) {
    if (validRowIds.has(id) && !seen.has(id)) {
      seen.add(id);
      valid.push(id);
    }
  }
  if (valid.length > 0) return valid;

  if (fallbackLocation) {
    const lower = fallbackLocation.toLowerCase().trim();
    const matched = indexedRows.find((r) => {
      const st = (r.station_id || "").toLowerCase().trim();
      return st.length > 0 && (st.includes(lower) || lower.includes(st));
    });
    if (matched) return [matched.row_id];
  }

  return [];
}

/**
 * Computes deterministic station-by-station PM2.5 deltas between two monitoring briefs.
 */
export function computeStationDeltas(
  currentRows: RawDataRow[] = [],
  previousRows: RawDataRow[] = []
): string[] {
  const prevByStation = new Map<string, RawDataRow>();
  for (const r of previousRows) {
    const key = (r.station_id || "").toLowerCase().trim();
    if (key && !prevByStation.has(key)) {
      prevByStation.set(key, r);
    }
  }

  const deltas: string[] = [];
  for (const currRow of currentRows) {
    const key = (currRow.station_id || "").toLowerCase().trim();
    if (!key) continue;
    const prevRow = prevByStation.get(key);
    if (prevRow && currRow.pm2_5 != null && prevRow.pm2_5 != null) {
      const diff = Math.round((currRow.pm2_5 - prevRow.pm2_5) * 10) / 10;
      const sign = diff > 0 ? `+${diff}` : `${diff}`;
      deltas.push(
        `${currRow.station_id}: PM2.5 ${prevRow.pm2_5} -> ${currRow.pm2_5} ug/m3 (${sign})${
          currRow.notes ? ` [${currRow.notes}]` : ""
        }`
      );
    } else if (!prevRow) {
      deltas.push(
        `${currRow.station_id}: New station in current brief (PM2.5: ${currRow.pm2_5 ?? "Missing"})`
      );
    } else if (prevRow.pm2_5 == null && currRow.pm2_5 != null) {
      deltas.push(
        `${currRow.station_id}: Sensor recovered from gap (now PM2.5 ${currRow.pm2_5} ug/m3)`
      );
    }
  }

  return deltas;
}

/**
 * Serializes indexed rows into compact token-efficient prompt lines.
 */
export function buildCompactPromptRows(rows: RawDataRow[], maxRows: number = 60): string {
  return rows
    .slice(0, maxRows)
    .map((r) => {
      const parts = [
        `[${r.row_id}]`,
        `Station:"${r.station_id || "Unknown"}"`,
        `Time:"${r.timestamp || "N/A"}"`,
        `PM2.5:${r.pm2_5 != null ? r.pm2_5 : "MISSING"}`,
        `PM10:${r.pm10 != null ? r.pm10 : "MISSING"}`,
        `AQI:${r.aqi != null ? r.aqi : "MISSING"}`,
      ];
      if (r.no2 != null) parts.push(`NO2:${r.no2}`);
      if (r.notes) parts.push(`Note:"${r.notes}"`);
      if (r.is_flagged) parts.push(`FLAG:${r.flag_reason || "Gap"}`);
      return parts.join(" | ");
    })
    .join("\n");
}

/**
 * Strips verbose raw_text and caps row arrays before transmitting or persisting briefs,
 * dramatically reducing HTTP payload size and localStorage footprint.
 */
export function toCompactAnalysisPayload(
  analysis: AnalysisResult,
  includeRows: boolean = true
): AnalysisResult {
  return {
    ...analysis,
    hotspots: analysis.hotspots.slice(0, 30),
    general_trends: analysis.general_trends.slice(0, 20),
    indexed_rows: includeRows
      ? analysis.indexed_rows.slice(0, 120).map((r) => ({
          row_id: r.row_id,
          timestamp: r.timestamp,
          station_id: r.station_id,
          pm2_5: r.pm2_5,
          pm10: r.pm10,
          aqi: r.aqi,
          no2: r.no2,
          so2: r.so2,
          notes: r.notes,
          is_flagged: r.is_flagged,
          flag_reason: r.flag_reason,
        }))
      : [],
  };
}

/**
 * Neutralizes CSV spreadsheet formula injection (CWE-1236) and escapes quotes.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '""';
  let str = String(value).replace(/\r?\n/g, " ");
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/**
 * Builds a clean, formula-safe CSV string of normalized sensor rows.
 */
export function buildNormalizedAuditCsv(rows: RawDataRow[]): string {
  const header = [
    "row_id",
    "station_id",
    "timestamp",
    "pm2_5_ug_m3",
    "pm10_ug_m3",
    "no2_ug_m3",
    "so2_ug_m3",
    "estimated_aqi",
    "is_flagged",
    "flag_reason",
    "notes",
  ].join(",");

  const body = rows.map((r) =>
    [
      sanitizeCsvCell(r.row_id),
      sanitizeCsvCell(r.station_id ?? ""),
      sanitizeCsvCell(r.timestamp ?? ""),
      sanitizeCsvCell(r.pm2_5 ?? ""),
      sanitizeCsvCell(r.pm10 ?? ""),
      sanitizeCsvCell(r.no2 ?? ""),
      sanitizeCsvCell(r.so2 ?? ""),
      sanitizeCsvCell(r.aqi ?? ""),
      sanitizeCsvCell(r.is_flagged ? "FLAGGED" : "VERIFIED"),
      sanitizeCsvCell(r.flag_reason ?? ""),
      sanitizeCsvCell(r.notes ?? ""),
    ].join(",")
  );

  return [header, ...body].join("\n");
}

/**
 * Computes concise plain-language readability telemetry for generated citizen advisories.
 */
export function computeAdvisoryReadability(text: string): {
  wordCount: number;
  sentenceCount: number;
  avgWordsPerSentence: number;
} {
  const trimmed = text.trim();
  if (!trimmed) {
    return { wordCount: 0, sentenceCount: 0, avgWordsPerSentence: 0 };
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  const sentences = trimmed
    .split(/[.!?।\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const sentenceCount = Math.max(1, sentences.length);
  return {
    wordCount: words.length,
    sentenceCount,
    avgWordsPerSentence: Math.round((words.length / sentenceCount) * 10) / 10,
  };
}
