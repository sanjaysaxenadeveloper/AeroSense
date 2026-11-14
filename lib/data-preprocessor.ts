import Papa from "papaparse";
import type { RawDataRow, DataAuditReport } from "./types";

const UNIT_REGEX = /µg\/m[³3]|ug\/m[³3^]?|mcg\/m[³3]|mg\/m[³3^]?|ppm|ppb/gi;
const MISSING_MARKER_RE =
  /^(null|none|nan|n\/a|na|\?+|-999|-9999|-|--|err|error|offline|bdl|unavailable)$/i;
const NUMBER_EXTRACT_RE = /-?\d+(\.\d+)?/;

interface ResolvedColumns {
  timeKey?: string;
  stationKey?: string;
  pm25Key?: string;
  pm10Key?: string;
  aqiKey?: string;
  no2Key?: string;
  so2Key?: string;
  tempKey?: string;
  humidityKey?: string;
  notesKey?: string;
  pm25HeaderMg: boolean;
  pm10HeaderMg: boolean;
  headerUnits: string[];
}

function findHeaderKey(keys: string[], patterns: RegExp[]): string | undefined {
  for (const pattern of patterns) {
    const match = keys.find((k) => pattern.test(k.toLowerCase().trim()));
    if (match) return match;
  }
  return undefined;
}

function resolveColumns(keys: string[]): ResolvedColumns {
  const pm25Key = findHeaderKey(keys, [/pm2\.?5/i, /pm_25/i, /fine_particulate/i, /pm25/i]);
  const pm10Key = findHeaderKey(keys, [/pm10/i, /pm_10/i, /coarse_particulate/i]);

  const isMgHeader = (header?: string) => {
    if (!header) return false;
    const h = header.toLowerCase();
    return /mg\/m[³3^]?/.test(h) && !/ug|µg|mcg/.test(h);
  };

  const headerUnits: string[] = [];
  for (const k of keys) {
    const matches = k.match(UNIT_REGEX);
    if (matches) headerUnits.push(...matches);
  }

  return {
    timeKey: findHeaderKey(keys, [/time/i, /date/i, /hour/i, /recorded/i, /ts/i]),
    stationKey: findHeaderKey(keys, [
      /station/i,
      /location/i,
      /site/i,
      /ward/i,
      /area/i,
      /zone/i,
      /sensor/i,
      /city/i,
      /district/i,
    ]),
    pm25Key,
    pm10Key,
    aqiKey: findHeaderKey(keys, [/aqi/i, /air_quality_index/i, /index/i]),
    no2Key: findHeaderKey(keys, [/no2/i, /nitrogen/i]),
    so2Key: findHeaderKey(keys, [/so2/i, /sulfur/i, /sulphur/i]),
    tempKey: findHeaderKey(keys, [/temp/i, /temperature/i]),
    humidityKey: findHeaderKey(keys, [/humid/i, /rh/i]),
    notesKey: findHeaderKey(keys, [/note/i, /remark/i, /comment/i, /status/i, /cause/i]),
    pm25HeaderMg: isMgHeader(pm25Key),
    pm10HeaderMg: isMgHeader(pm10Key),
    headerUnits,
  };
}

function parseParticulateCell(
  rawVal: string | undefined,
  headerIsMg: boolean,
  label: string,
  unitConversions: Set<string>
): { num: number | null; issue?: string; convertedFromMg?: boolean } {
  const val = rawVal?.trim();
  if (!val || MISSING_MARKER_RE.test(val)) {
    return { num: null, issue: "Missing / Null sensor reading" };
  }

  const cleaned = val.replace(/,/g, "");
  const numMatch = cleaned.match(NUMBER_EXTRACT_RE);
  if (!numMatch) {
    return { num: null, issue: `Corrupted text reading: "${val}"` };
  }

  let num = parseFloat(numMatch[0]);
  if (Number.isNaN(num)) {
    return { num: null, issue: `Invalid numeric value: "${val}"` };
  }
  if (num < 0) {
    return { num, issue: `Unrealistic negative reading (${num})` };
  }

  const cellLower = val.toLowerCase();
  const hasCellMg = /mg\/m[³3^]?/.test(cellLower) && !/ug|µg|mcg/.test(cellLower);
  const hasCellUg = /ug|µg|mcg/.test(cellLower);
  if (hasCellMg || (!hasCellUg && headerIsMg)) {
    const original = num;
    num = Math.round(num * 1000 * 10) / 10;
    unitConversions.add(`${label} normalized from mg/m³ (${original}) to µg/m³ (${num})`);
    return { num, convertedFromMg: true };
  }

  return { num };
}

function parseNumericCell(rawVal: string | undefined): { num: number | null; issue?: string } {
  const val = rawVal?.trim();
  if (!val || MISSING_MARKER_RE.test(val)) {
    return { num: null, issue: "Missing / Null sensor reading" };
  }

  const cleaned = val.replace(/,/g, "");
  const numMatch = cleaned.match(NUMBER_EXTRACT_RE);
  if (!numMatch) {
    return { num: null, issue: `Corrupted text reading: "${val}"` };
  }

  const num = parseFloat(numMatch[0]);
  if (Number.isNaN(num)) {
    return { num: null, issue: `Invalid numeric value: "${val}"` };
  }
  if (num < 0) {
    return { num, issue: `Unrealistic negative reading (${num})` };
  }
  return { num };
}

/**
 * Estimates CPCB India AQI sub-index from PM2.5 (µg/m³) when AQI is omitted.
 */
export function estimateAqiFromPm25(pm: number): number {
  if (pm <= 30) return Math.round(pm * (50 / 30));
  if (pm <= 60) return Math.round(50 + ((pm - 30) * 50) / 30);
  if (pm <= 90) return Math.round(100 + ((pm - 60) * 100) / 30);
  if (pm <= 120) return Math.round(200 + ((pm - 90) * 100) / 30);
  if (pm <= 250) return Math.round(300 + ((pm - 120) * 100) / 130);
  return Math.min(500, Math.round(400 + ((pm - 250) * 100) / 130));
}

/**
 * Normalizes messy tabular inputs (JSON arrays, CSV, TSV, Markdown tables, multi-space text).
 */
function parseMessyTable(trimmed: string): Record<string, string>[] {
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "object") {
        return parsed.map((item) => {
          const rec: Record<string, string> = {};
          for (const [k, v] of Object.entries(item as Record<string, unknown>)) {
            rec[k] = v === null || v === undefined ? "" : String(v);
          }
          return rec;
        });
      }
    } catch {
      // Fall through to delimited parser
    }
  }

  let lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  lines = lines.filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(l));
  if (lines.length === 0) return [];

  const looksLikeDelimitedHeader = (line: string) =>
    /[,\t;|]/.test(line) || /\s{2,}/.test(line);

  while (lines.length > 1 && !looksLikeDelimitedHeader(lines[0])) {
    lines.shift();
  }

  if (lines[0].startsWith("|") && lines[0].endsWith("|")) {
    lines = lines.map((l) => l.replace(/^\|/, "").replace(/\|$/, "").trim());
  }

  const normalizedBlock = lines.join("\n");
  const parseResult = Papa.parse<Record<string, string>>(normalizedBlock, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
    delimitersToGuess: [",", "\t", "|", ";"],
  });

  if (
    parseResult.data &&
    parseResult.data.length > 0 &&
    Object.keys(parseResult.data[0]).length > 1
  ) {
    return parseResult.data;
  }

  if (lines.length > 1) {
    const splitLine = (line: string) =>
      /[,\t;|]/.test(line)
        ? line.split(/[,\t;|]/).map((p) => p.trim())
        : line.split(/\s{2,}/).map((p) => p.trim());

    const headers = splitLine(lines[0]);
    if (headers.length > 1) {
      const rows: Record<string, string>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = splitLine(lines[i]);
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx] ?? "";
        });
        rows.push(rowObj);
      }
      return rows;
    }
  }

  return parseResult.data || [];
}

/**
 * Deterministic civic air quality preprocessor:
 * - Parses CSV, TSV, Markdown/pipe tables, multi-space exports, and JSON arrays
 * - Caches header-to-field mappings per table shape for O(1) column lookup
 * - Standardizes units (mg/m³ -> µg/m³), estimates missing AQI, and assigns [ROW_XXX] IDs
 */
export function preprocessRawAirQualityData(rawInput: string): {
  indexedRows: RawDataRow[];
  preliminaryAudit: DataAuditReport;
} {
  const trimmed = rawInput.replace(/^\uFEFF/, "").trim();
  if (!trimmed) {
    return {
      indexedRows: [],
      preliminaryAudit: {
        total_readings: 0,
        valid_readings_count: 0,
        missing_or_corrupt_count: 0,
        detected_units: [],
        unit_conversions: [],
        unreliable_readings: [],
      },
    };
  }

  const rawRows = parseMessyTable(trimmed);
  const detectedUnits = new Set<string>();
  const unitConversions = new Set<string>();
  const unreliable: { row_id: string; station: string; issue: string }[] = [];
  const indexedRows: RawDataRow[] = [];
  const seenStationTime = new Set<string>();
  const columnCache = new Map<string, ResolvedColumns>();

  rawRows.forEach((row, index) => {
    const keys = Object.keys(row);
    const sig = keys.join("|");
    let cols = columnCache.get(sig);
    if (!cols) {
      cols = resolveColumns(keys);
      columnCache.set(sig, cols);
      cols.headerUnits.forEach((u) => detectedUnits.add(u));
    }

    const rowId = `ROW_${String(index + 1).padStart(3, "0")}`;
    const rawTime =
      cols.timeKey && row[cols.timeKey]?.trim() ? row[cols.timeKey].trim() : "N/A";
    const rawStation =
      cols.stationKey && row[cols.stationKey]?.trim()
        ? row[cols.stationKey].trim()
        : `Station_${index + 1}`;

    for (const val of Object.values(row)) {
      if (!val) continue;
      const matches = String(val).match(UNIT_REGEX);
      if (matches) matches.forEach((m) => detectedUnits.add(m));
    }

    const parsedPm25 = parseParticulateCell(
      cols.pm25Key ? row[cols.pm25Key] : undefined,
      cols.pm25HeaderMg,
      "PM2.5",
      unitConversions
    );
    const parsedPm10 = parseParticulateCell(
      cols.pm10Key ? row[cols.pm10Key] : undefined,
      cols.pm10HeaderMg,
      "PM10",
      unitConversions
    );
    const parsedAqi = parseNumericCell(cols.aqiKey ? row[cols.aqiKey] : undefined);
    const parsedNo2 = parseNumericCell(cols.no2Key ? row[cols.no2Key] : undefined);
    const parsedSo2 = parseNumericCell(cols.so2Key ? row[cols.so2Key] : undefined);

    let isFlagged = false;
    const flagReasons: string[] = [];

    if (parsedPm25.issue) {
      isFlagged = true;
      flagReasons.push(`PM2.5: ${parsedPm25.issue}`);
    } else if (parsedPm25.num !== null && parsedPm25.num > 900) {
      isFlagged = true;
      flagReasons.push(`PM2.5 extreme outlier (>900 µg/m³): possible sensor calibration fault`);
    }

    if (parsedPm10.issue) {
      isFlagged = true;
      flagReasons.push(`PM10: ${parsedPm10.issue}`);
    } else if (parsedPm10.num !== null && parsedPm10.num > 1500) {
      isFlagged = true;
      flagReasons.push(`PM10 extreme outlier (>1500 µg/m³)`);
    }

    if (parsedAqi.issue && parsedPm25.num === null) {
      isFlagged = true;
      flagReasons.push("AQI & PM2.5 both unavailable");
    } else if (parsedAqi.num !== null && parsedAqi.num > 500) {
      isFlagged = true;
      flagReasons.push(`AQI exceeds standard 500 scale (${parsedAqi.num})`);
    }

    if (parsedPm25.convertedFromMg || parsedPm10.convertedFromMg) {
      flagReasons.push("Unit normalized (mg/m³ → µg/m³)");
    }

    if (rawTime === "N/A") {
      isFlagged = true;
      flagReasons.push("Missing timestamp");
    }

    const dedupeKey = `${rawStation.toLowerCase()}|${rawTime.toLowerCase()}`;
    if (rawTime !== "N/A" && seenStationTime.has(dedupeKey)) {
      isFlagged = true;
      flagReasons.push("Duplicate station + timestamp entry");
    }
    seenStationTime.add(dedupeKey);

    if (isFlagged) {
      unreliable.push({
        row_id: rowId,
        station: rawStation,
        issue: flagReasons.join("; "),
      });
    }

    const calculatedAqi =
      parsedAqi.num !== null && parsedAqi.num >= 0
        ? parsedAqi.num
        : parsedPm25.num !== null && parsedPm25.num >= 0
        ? estimateAqiFromPm25(parsedPm25.num)
        : null;

    const noteVal = cols.notesKey ? row[cols.notesKey]?.trim() : "";

    indexedRows.push({
      row_id: rowId,
      timestamp: rawTime,
      station_id: rawStation,
      location: rawStation,
      pm2_5: parsedPm25.num,
      pm10: parsedPm10.num,
      aqi: calculatedAqi,
      no2: parsedNo2.num,
      so2: parsedSo2.num,
      temp: parseNumericCell(cols.tempKey ? row[cols.tempKey] : undefined).num,
      humidity: parseNumericCell(cols.humidityKey ? row[cols.humidityKey] : undefined).num,
      unit_pm: "µg/m³",
      notes: noteVal || undefined,
      is_flagged: isFlagged,
      flag_reason: flagReasons.join("; "),
      raw_text: Object.entries(row)
        .map(([k, v]) => `${k}:${v}`)
        .join(" | "),
    });
  });

  return {
    indexedRows,
    preliminaryAudit: {
      total_readings: indexedRows.length,
      valid_readings_count: indexedRows.filter((r) => !r.is_flagged).length,
      missing_or_corrupt_count: unreliable.length,
      detected_units: Array.from(detectedUnits),
      unit_conversions: Array.from(unitConversions),
      unreliable_readings: unreliable,
    },
  };
}
