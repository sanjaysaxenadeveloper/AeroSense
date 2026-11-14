import type { RawDataRow } from "./types";

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
