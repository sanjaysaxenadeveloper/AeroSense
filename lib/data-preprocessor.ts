import Papa from "papaparse";
import { RawDataRow, DataAuditReport } from "./types";

/**
 * Pre-processes messy air quality inputs:
 * - Parses CSV, TSV, or whitespace-delimited tables
 * - Standardizes column names (timestamp, station, pm2.5, pm10, aqi, no2)
 * - Assigns deterministic IDs (ROW_001, ROW_002...)
 * - Flags missing, corrupt, or out-of-bounds readings for traceability
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
        unreliable_readings: [],
      },
    };
  }

  // Parse using PapaParse with automatic delimiter detection
  const parseResult = Papa.parse<Record<string, string>>(trimmed, {
    header: true,
    skipEmptyLines: "greedy",
    dynamicTyping: false,
  });

  let rawRows: Record<string, string>[] = [];

  if (parseResult.data && parseResult.data.length > 0) {
    rawRows = parseResult.data;
  } else {
    // Fallback: split by newlines and try manual column split
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length > 1) {
      const headers = lines[0].split(/[,\t;|]/).map((h) => h.trim());
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/[,\t;|]/).map((p) => p.trim());
        const rowObj: Record<string, string> = {};
        headers.forEach((h, idx) => {
          rowObj[h] = parts[idx] ?? "";
        });
        rawRows.push(rowObj);
      }
    }
  }

  const detectedUnits = new Set<string>();
  const unreliable: { row_id: string; station: string; issue: string }[] = [];
  const indexedRows: RawDataRow[] = [];

  rawRows.forEach((row, index) => {
    const rowId = `ROW_${String(index + 1).padStart(3, "0")}`;
    const keys = Object.keys(row);

    // Fuzzy matching for columns
    const findVal = (patterns: RegExp[]): string | undefined => {
      for (const pattern of patterns) {
        const matchKey = keys.find((k) => pattern.test(k.toLowerCase().trim()));
        if (matchKey && row[matchKey] !== undefined) {
          return String(row[matchKey]).trim();
        }
      }
      return undefined;
    };

    const rawTime = findVal([/time/i, /date/i, /hour/i]) ?? "N/A";
    const rawStation = findVal([/station/i, /location/i, /site/i, /ward/i, /area/i]) ?? `Station_${index + 1}`;
    
    const rawPm25 = findVal([/pm2\.?5/i, /pm_25/i, /fine_particulate/i]);
    const rawPm10 = findVal([/pm10/i, /pm_10/i, /coarse_particulate/i]);
    const rawAqi = findVal([/aqi/i, /air_quality_index/i, /index/i]);
    const rawNo2 = findVal([/no2/i, /nitrogen/i]);
    const rawTemp = findVal([/temp/i, /temperature/i]);
    const rawHumidity = findVal([/humid/i, /rh/i]);

    // Check for explicit unit mentions in headers or values
    keys.forEach((k) => {
      if (/µg\/m3|ug\/m3|ppm|ppb|mg\/m3/i.test(k)) {
        const matched = k.match(/µg\/m3|ug\/m3|ppm|ppb|mg\/m3/i);
        if (matched) detectedUnits.add(matched[0]);
      }
    });

    // Helper to sanitize numeric values
    const parseNumeric = (val: string | undefined): { num: number | null; issue?: string } => {
      if (!val || val === "" || /^(null|none|nan|n\/a|na|\?+|-999|-)$/i.test(val)) {
        return { num: null, issue: "Missing / Null sensor reading" };
      }
      // Extract numbers even if unit is concatenated (e.g. "145 ug/m3")
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
        return { num, issue: `Unrealistic negative pollutant reading (${num})` };
      }
      return { num };
    };

    const parsedPm25 = parseNumeric(rawPm25);
    const parsedPm10 = parseNumeric(rawPm10);
    const parsedAqi = parseNumeric(rawAqi);
    const parsedNo2 = parseNumeric(rawNo2);

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
    }

    if (parsedAqi.issue && !parsedPm25.num) {
      isFlagged = true;
      flagReasons.push(`AQI & PM2.5 both unavailable`);
    }

    if (isFlagged) {
      unreliable.push({
        row_id: rowId,
        station: rawStation,
        issue: flagReasons.join("; "),
      });
    }

    // Estimate AQI if missing but PM2.5 is available (approx standard breakpoints)
    let calculatedAqi = parsedAqi.num;
    if (calculatedAqi === null && parsedPm25.num !== null) {
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
      temp: parseNumeric(rawTemp).num,
      humidity: parseNumeric(rawHumidity).num,
      unit_pm: "µg/m³",
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
      unreliable_readings: unreliable,
    },
  };
}
