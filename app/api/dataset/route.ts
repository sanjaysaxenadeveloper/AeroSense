import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import {
  validatePublicDatasetUrl,
  isValidIsoDate,
  isAllowedDatasetMimeType,
} from "@/lib/dataset-utils";
import {
  AppHttpError,
  getHttpErrorDetails,
  parseJsonBody,
  sanitizeText,
} from "@/lib/validation";
import { checkRateLimit, getClientIdentifier } from "@/lib/rate-limiter";

const HF_BASE = "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India/resolve/main";
const MAX_CUSTOM_URL_BYTES = 2 * 1024 * 1024; // 2 MB cap for external CSV/JSON URLs

interface StationMeta {
  StationId: string;
  StationName: string;
  City: string;
  State: string;
  Status: string;
}

interface StationDayRow {
  StationId: string;
  Date: string;
  "PM2.5": string;
  PM10: string;
  NO2: string;
  SO2: string;
  CO: string;
  AQI: string;
  AQI_Bucket: string;
}

interface CachedHfData {
  fetchedAt: number;
  stationsById: Map<string, StationMeta>;
  rowsByDate: Map<string, StationDayRow[]>;
  cities: string[];
  totalRows: number;
}

let hfCache: CachedHfData | null = null;
let hfInflight: Promise<CachedHfData> | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function readResponseWithByteLimit(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) {
    const text = await res.text();
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw new AppHttpError("Remote file exceeds 2 MB size limit for direct preview.", 400);
    }
    return text;
  }

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new AppHttpError("Remote file exceeds 2 MB size limit for direct preview.", 400);
      }
      chunks.push(value);
    }
  }

  return Buffer.concat(chunks).toString("utf8");
}

async function getHfAqiData(): Promise<CachedHfData> {
  if (hfCache && Date.now() - hfCache.fetchedAt < CACHE_TTL_MS) {
    return hfCache;
  }

  if (hfInflight) {
    return hfInflight;
  }

  hfInflight = (async () => {
    const [stRes, sdRes] = await Promise.all([
      fetch(`${HF_BASE}/stations.csv`, { signal: AbortSignal.timeout(15000) }),
      fetch(`${HF_BASE}/station_day.csv`, { signal: AbortSignal.timeout(25000) }),
    ]);

    if (!stRes.ok || !sdRes.ok) {
      throw new AppHttpError(
        `Failed to fetch Hugging Face dataset (stations: ${stRes.status}, station_day: ${sdRes.status}).`,
        502
      );
    }

    const [stText, sdText] = await Promise.all([stRes.text(), sdRes.text()]);

    const parsedStations = Papa.parse<StationMeta>(stText.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: true,
    });

    const stationsById = new Map<string, StationMeta>();
    const citySet = new Set<string>();
    for (const s of parsedStations.data) {
      if (s.StationId) {
        stationsById.set(s.StationId.trim(), s);
      }
      if (s.City && s.City.trim()) {
        citySet.add(s.City.trim());
      }
    }

    const parsedDays = Papa.parse<StationDayRow>(sdText.replace(/^\uFEFF/, ""), {
      header: true,
      skipEmptyLines: true,
    });

    // O(1) date lookup index eliminates scanning 108,000+ rows per request
    const rowsByDate = new Map<string, StationDayRow[]>();
    for (const row of parsedDays.data) {
      const d = (row.Date || "").trim();
      if (!d) continue;
      let bucket = rowsByDate.get(d);
      if (!bucket) {
        bucket = [];
        rowsByDate.set(d, bucket);
      }
      bucket.push(row);
    }

    hfCache = {
      fetchedAt: Date.now(),
      stationsById,
      rowsByDate,
      cities: Array.from(citySet).sort(),
      totalRows: parsedDays.data.length,
    };

    return hfCache;
  })();

  try {
    return await hfInflight;
  } finally {
    hfInflight = null;
  }
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(`dataset-get:${getClientIdentifier(req)}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many dataset metadata requests. Please wait shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const data = await getHfAqiData();
    return NextResponse.json(
      {
        dataset: "AdityaaXD/AQI-Of-India",
        sourceUrl: "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India",
        cities: data.cities,
        totalStationRows: data.totalRows,
      },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (err: unknown) {
    const { status, message } = getHttpErrorDetails(err);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(`dataset-post:${getClientIdentifier(req)}`, 40, 60_000);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many dataset requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSeconds) } }
    );
  }

  try {
    const body = await parseJsonBody<Record<string, unknown>>(req);
    const source = body.source === "custom_url" ? "custom_url" : "hf_aqi_india";
    const maxRows = Math.min(Math.max(1, Number(body.maxRows) || 25), 50);

    if (source === "custom_url") {
      const validation = validatePublicDatasetUrl(body.url);
      if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 400 });
      }
      const parsedUrl = validation.url;

      const remoteRes = await fetch(parsedUrl.toString(), {
        signal: AbortSignal.timeout(15000),
        redirect: "error",
      });
      if (!remoteRes.ok) {
        return NextResponse.json(
          { error: `Remote dataset returned HTTP ${remoteRes.status}.` },
          { status: 400 }
        );
      }

      if (!isAllowedDatasetMimeType(remoteRes.headers.get("content-type"))) {
        return NextResponse.json(
          { error: "Remote URL must return CSV, TSV, Markdown, plain text, or JSON data." },
          { status: 400 }
        );
      }

      const contentLength = Number(remoteRes.headers.get("content-length") || 0);
      if (contentLength > MAX_CUSTOM_URL_BYTES) {
        return NextResponse.json(
          { error: "Remote file exceeds 2 MB size limit for direct preview." },
          { status: 400 }
        );
      }

      const text = await readResponseWithByteLimit(remoteRes, MAX_CUSTOM_URL_BYTES);
      const trimmed = text.trim();

      if (trimmed.startsWith("[")) {
        try {
          const parsedJson = JSON.parse(trimmed);
          if (Array.isArray(parsedJson)) {
            const slicedJson = parsedJson.slice(0, maxRows);
            return NextResponse.json({
              csvText: JSON.stringify(slicedJson, null, 2),
              title: `Remote Dataset (${parsedUrl.hostname})`,
              sourceUrl: parsedUrl.toString(),
              rowCount: slicedJson.length,
            });
          }
        } catch {
          // Fall through to line-based slicing
        }
      }

      const lines = trimmed.split(/\r?\n/);
      const sliced = lines.length > maxRows + 1 ? lines.slice(0, maxRows + 1).join("\n") : text;

      return NextResponse.json({
        csvText: sliced,
        title: `Remote Dataset (${parsedUrl.hostname})`,
        sourceUrl: parsedUrl.toString(),
        rowCount: Math.max(0, Math.min(lines.length - 1, maxRows)),
      });
    }

    // Mode: Hugging Face AdityaaXD/AQI-Of-India (O(1) indexed lookup by date)
    const targetDateRaw = sanitizeText(body.date, 20) || "2019-11-03";
    if (!isValidIsoDate(targetDateRaw)) {
      return NextResponse.json(
        { error: "Date must be formatted as YYYY-MM-DD (e.g. 2019-11-03)." },
        { status: 400 }
      );
    }

    const targetCity = sanitizeText(body.city, 80) || "Delhi";
    const data = await getHfAqiData();
    const dateRows = data.rowsByDate.get(targetDateRaw) || [];

    const matchingRows = dateRows
      .filter((row) => {
        if (targetCity === "ALL") return true;
        const meta = data.stationsById.get((row.StationId || "").trim());
        return meta?.City?.trim().toLowerCase() === targetCity.toLowerCase();
      })
      .slice(0, maxRows);

    if (matchingRows.length === 0) {
      return NextResponse.json(
        {
          error: `No station readings found for ${
            targetCity === "ALL" ? "India" : targetCity
          } on ${targetDateRaw}. Try another date between 2018-01-01 and 2020-06-30 (e.g., 2019-11-03 or 2019-11-06).`,
        },
        { status: 404 }
      );
    }

    const formattedRows = matchingRows.map((row) => {
      const meta = data.stationsById.get((row.StationId || "").trim());
      const stationLabel = meta
        ? `${meta.StationName} [${row.StationId}]`
        : row.StationId;
      return {
        Station: stationLabel,
        City: meta?.City || "",
        Date: row.Date,
        "PM2.5 (ug/m3)": row["PM2.5"] || "",
        "PM10 (ug/m3)": row.PM10 || "",
        "NO2 (ug/m3)": row.NO2 || "",
        "SO2 (ug/m3)": row.SO2 || "",
        "CO (mg/m3)": row.CO || "",
        AQI: row.AQI || "",
        Notes: meta?.Status
          ? `CPCB Station Status: ${meta.Status}${row.AQI_Bucket ? ` (${row.AQI_Bucket})` : ""}`
          : row.AQI_Bucket || "",
      };
    });

    const csvText = Papa.unparse(formattedRows);
    const cityLabel = targetCity === "ALL" ? "All India Stations" : `${targetCity} Stations`;

    return NextResponse.json({
      csvText,
      title: `CPCB ${cityLabel} — ${targetDateRaw}`,
      sourceUrl: "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India",
      rowCount: formattedRows.length,
    });
  } catch (err: unknown) {
    console.error("Dataset API Error:", err);
    const { status, message } = getHttpErrorDetails(err);
    return NextResponse.json({ error: message }, { status });
  }
}
