import Papa from "papaparse";
import type { RawDataRow, DataAuditReport } from "./types";

/**
 * Normalizes messy tabular lines before parsing:
 * - Strips leading comment/title preamble lines before the header row
 * - Converts Markdown tables (| col1 | col2 |) and removes separator rows (|---|---|)
 * - Supports JSON arrays, CSV, TSV, semicolon/pipe-delimited, and multi-space tables
 */
function parseMessyTable(trimmed: string): Record<string, string>[] {
  // 1. JSON array support
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
      // fall through to delimited parser
    }
  }

  // Filter blank lines and comment lines (# ...)
  let lines = trimmed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  // Strip Markdown table separator rows like |---|---|---| or ---|---
  lines = lines.filter((l) => !/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(l));

  if (lines.length === 0) return [];

  // Skip preamble title lines until we hit a line that looks like a header with delimiters or multi-spaces
  const looksLikeDelimitedHeader = (line: string) =>
    /[,\t;|]/.test(line) || /\s{2,}/.test(line);

  while (lines.length > 1 && !looksLikeDelimitedHeader(lines[0])) {
    lines.shift();
  }

  // If Markdown/pipe-bordered rows (| a | b |), trim leading/trailing pipes
  const isPipeBordered = lines[0].startsWith("|") && lines[0].endsWith("|");
  if (isPipeBordered) {
    lines = lines.map((l) => l.replace(/^\|/, "").replace(/\|$/, "").trim());
  }

  const normalizedBlock = lines.join("\n");

  // 2. Try PapaParse for comma, tab, pipe, semicolon
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

  // 3. Fallback: multi-space / whitespace-aligned columns (e.g. copied from PDF/terminal)
  if (lines.length > 1) {
    const splitLine = (line: string) => {
      if (/[,\t;|]/.test(line)) {
        return line.split(/[,\t;|]/).map((p) => p.trim());
      }
      return line.split(/\s{2,}/).map((p) => p.trim());
    };

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
 * Pre-processes messy air quality inputs:
 * - Parses CSV, TSV, pipe/markdown tables, multi-space tables, or JSON
 * - Standardizes column names and normalizes units (e.g. mg/m³ -> µg/m³)
 * - Assigns deterministic IDs (ROW_001, ROW_002...)
 * - Flags missing, corrupt, negative, or out-of-bounds readings for traceability
 */
export function preprocessRawAirQualityData(rawInput: string): {
  indexedRows: RawDataRow[];
  preliminaryAudit: DataAuditReport;
} {
  const trimmed = rawInput.trim();
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

  rawRows.forEach((row, index) => {
    const rowId = `ROW_${String(index + 1).padStart(3, "0")}`;
    const keys = Object.keys(row);

    // Fuzzy matching for columns, returning both matched header and cell value
    const findField = (
      patterns: RegExp[]
    ): { header?: string; value?: string } => {
      for (const pattern of patterns) {
        const matchKey = keys.find((k) => pattern.test(k.toLowerCase().trim()));
        if (matchKey && row[matchKey] !== undefined) {
          return { header: matchKey, value: String(row[matchKey]).trim() };
        }
      }
      return {};
    };

    const timeField = findField([/time/i, /date/i, /hour/i, /recorded/i, /ts/i]);
    const stationField = findField([
      /station/i,
      /location/i,
      /site/i,
      /ward/i,
      /area/i,
      /zone/i,
      /sensor/i,
      /city/i,
      /district/i,
    ]);
    const pm25Field = findField([/pm2\.?5/i, /pm_25/i, /fine_particulate/i, /pm25/i]);
    const pm10Field = findField([/pm10/i, /pm_10/i, /coarse_particulate/i]);
    const aqiField = findField([/aqi/i, /air_quality_index/i, /index/i]);
    const no2Field = findField([/no2/i, /nitrogen/i]);
    const so2Field = findField([/so2/i, /sulfur/i, /sulphur/i]);
    const tempField = findField([/temp/i, /temperature/i]);
    const humidityField = findField([/humid/i, /rh/i]);
    const notesField = findField([/note/i, /remark/i, /comment/i, /status/i, /cause/i]);

    const rawTime = timeField.value && timeField.value !== "" ? timeField.value : "N/A";
    const rawStation =
      stationField.value && stationField.value !== ""
        ? stationField.value
        : `Station_${index + 1}`;

    // Detect explicit units in headers and cell values
    const unitRegex = /µg\/m[³3]|ug\/m[³3^]?|mcg\/m[³3]|mg\/m[³3^]?|ppm|ppb/gi;
    keys.forEach((k) => {
      const matches = k.match(unitRegex);
      if (matches) matches.forEach((m) => detectedUnits.add(m));
    });
    Object.values(row).forEach((val) => {
      const matches = String(val ?? "").match(unitRegex);
      if (matches) matches.forEach((m) => detectedUnits.add(m));
    });

    // Helper to sanitize numeric values and normalize mg/m³ -> µg/m³ for particulates
    const parseParticulate = (
      field: { header?: string; value?: string },
      label: string
    ): { num: number | null; issue?: string; convertedFromMg?: boolean } => {
      const val = field.value;
      if (
        !val ||
        val === "" ||
        /^(null|none|nan|n\/a|na|\?+|-999|-9999|-|--|err|error|offline|bdl|unavailable)$/i.test(
          val
        )
      ) {
        return { num: null, issue: "Missing / Null sensor reading" };
      }

      const cleaned = val.replace(/,/g, "").trim();
      const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
      if (!numMatch) {
        return { num: null, issue: `Corrupted text reading: "${val}"` };
      }
      let num = parseFloat(numMatch[0]);
      if (isNaN(num)) {
        return { num: null, issue: `Invalid numeric value: "${val}"` };
      }
      if (num < 0) {
        return { num, issue: `Unrealistic negative reading (${num})` };
      }

      const cellLower = val.toLowerCase();
      const headerLower = (field.header || "").toLowerCase();
      const hasCellMg = /mg\/m[³3^]?/.test(cellLower) && !/ug|µg|mcg/.test(cellLower);
      const hasCellUg = /ug|µg|mcg/.test(cellLower);
      const hasHeaderMg = /mg\/m[³3^]?/.test(headerLower) && !/ug|µg|mcg/.test(headerLower);
      const isMgM3 = hasCellMg || (!hasCellUg && hasHeaderMg);
      if (isMgM3) {
        const original = num;
        num = Math.round(num * 1000 * 10) / 10;
        unitConversions.add(`${label} normalized from mg/m³ (${original}) to µg/m³ (${num})`);
        return { num, convertedFromMg: true };
      }

      return { num };
    };

    const parseNumeric = (val: string | undefined): { num: number | null; issue?: string } => {
      if (
        !val ||
        val === "" ||
        /^(null|none|nan|n\/a|na|\?+|-999|-9999|-|--|err|error|offline|unavailable)$/i.test(
          val
        )
      ) {
        return { num: null, issue: "Missing / Null sensor reading" };
      }
      const cleaned = val.replace(/,/g, "").trim();
      const numMatch = cleaned.match(/-?\d+(\.\d+)?/);
      if (!numMatch) {
        return { num: null, issue: `Corrupted text reading: "${val}"` };
      }
      const num = parseFloat(numMatch[0]);
      if (isNaN(num)) {
        return { num: null, issue: `Invalid numeric value: "${val}"` };
      }
      if (num < 0) {
        return { num, issue: `Unrealistic negative reading (${num})` };
      }
      return { num };
    };

    const parsedPm25 = parseParticulate(pm25Field, "PM2.5");
    const parsedPm10 = parseParticulate(pm10Field, "PM10");
    const parsedAqi = parseNumeric(aqiField.value);
    const parsedNo2 = parseNumeric(no2Field.value);
    const parsedSo2 = parseNumeric(so2Field.value);

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
      flagReasons.push(`AQI & PM2.5 both unavailable`);
    } else if (parsedAqi.num !== null && parsedAqi.num > 500) {
      isFlagged = true;
      flagReasons.push(`AQI exceeds standard 500 scale (${parsedAqi.num})`);
    }

    if (parsedPm25.convertedFromMg || parsedPm10.convertedFromMg) {
      flagReasons.push(`Unit normalized (mg/m³ → µg/m³)`);
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

    // Estimate AQI if missing but valid PM2.5 is available (standard breakpoints)
    let calculatedAqi = parsedAqi.num !== null && parsedAqi.num >= 0 ? parsedAqi.num : null;
    if (calculatedAqi === null && parsedPm25.num !== null && parsedPm25.num >= 0) {
      const pm = parsedPm25.num;
      if (pm <= 30) calculatedAqi = Math.round(pm * (50 / 30));
      else if (pm <= 60) calculatedAqi = Math.round(50 + ((pm - 30) * 50) / 30);
      else if (pm <= 90) calculatedAqi = Math.round(100 + ((pm - 60) * 100) / 30);
      else if (pm <= 120) calculatedAqi = Math.round(200 + ((pm - 90) * 100) / 30);
      else if (pm <= 250) calculatedAqi = Math.round(300 + ((pm - 120) * 100) / 130);
      else calculatedAqi = Math.min(500, Math.round(400 + ((pm - 250) * 100) / 130));
    }

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
      temp: parseNumeric(tempField.value).num,
      humidity: parseNumeric(humidityField.value).num,
      unit_pm: "µg/m³",
      notes: notesField.value || undefined,
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
