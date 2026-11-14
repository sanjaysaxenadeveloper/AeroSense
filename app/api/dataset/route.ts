import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { validatePublicDatasetUrl } from "@/lib/dataset-utils";

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
  NO: string;
  NO2: string;
  NOx: string;
  NH3: string;
  CO: string;
  SO2: string;
  O3: string;
  AQI: string;
  AQI_Bucket: string;
}

interface CachedHfData {
  fetchedAt: number;
  stationsById: Map<string, StationMeta>;
  stationDayRows: StationDayRow[];
  cities: string[];
}

let hfCache: CachedHfData | null = null;
let hfInflight: Promise<CachedHfData> | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

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
      throw new Error(
        `Failed to fetch Hugging Face dataset (stations: ${stRes.status}, station_day: ${sdRes.status}).`
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

    hfCache = {
      fetchedAt: Date.now(),
      stationsById,
      stationDayRows: parsedDays.data,
      cities: Array.from(citySet).sort(),
    };

    return hfCache;
  })();

  try {
    return await hfInflight;
  } finally {
    hfInflight = null;
  }
}

export async function GET() {
  try {
    const data = await getHfAqiData();
    return NextResponse.json({
      dataset: "AdityaaXD/AQI-Of-India",
      sourceUrl: "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India",
      cities: data.cities,
      totalStationRows: data.stationDayRows.length,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to inspect dataset.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      source = "hf_aqi_india",
      city = "Delhi",
      date = "2019-11-03",
      url,
      maxRows = 25,
    }: {
      source?: "hf_aqi_india" | "custom_url";
      city?: string;
      date?: string;
      url?: string;
      maxRows?: number;
    } = body;

    if (source === "custom_url") {
      const validation = validatePublicDatasetUrl(url);
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

      const contentLength = Number(remoteRes.headers.get("content-length") || 0);
      if (contentLength > MAX_CUSTOM_URL_BYTES) {
        return NextResponse.json(
          { error: "Remote file exceeds 2 MB size limit for direct preview." },
          { status: 400 }
        );
      }

      const text = await remoteRes.text();
      if (Buffer.byteLength(text, "utf8") > MAX_CUSTOM_URL_BYTES) {
        return NextResponse.json(
          { error: "Remote file exceeds 2 MB size limit for direct preview." },
          { status: 400 }
        );
      }
      const trimmed = text.trim();
      const safeLimit = Math.min(Math.max(1, Number(maxRows) || 25), 50);

      if (trimmed.startsWith("[")) {
        try {
          const parsedJson = JSON.parse(trimmed);
          if (Array.isArray(parsedJson)) {
            const slicedJson = parsedJson.slice(0, safeLimit);
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
      const sliced = lines.length > safeLimit + 1 ? lines.slice(0, safeLimit + 1).join("\n") : text;

      return NextResponse.json({
        csvText: sliced,
        title: `Remote Dataset (${parsedUrl.hostname})`,
        sourceUrl: parsedUrl.toString(),
        rowCount: Math.max(0, Math.min(lines.length - 1, safeLimit)),
      });
    }

    // Mode: Hugging Face AdityaaXD/AQI-Of-India (station_day.csv + stations.csv)
    const data = await getHfAqiData();
    const targetDate = (date || "2019-11-03").trim();
    const targetCity = (city || "Delhi").trim();
    const limit = Math.min(Math.max(1, Number(maxRows) || 25), 50);

    const matchingRows = data.stationDayRows
      .filter((row) => {
        if ((row.Date || "").trim() !== targetDate) return false;
        if (targetCity === "ALL") return true;
        const meta = data.stationsById.get((row.StationId || "").trim());
        return meta?.City?.trim().toLowerCase() === targetCity.toLowerCase();
      })
      .slice(0, limit);

    if (matchingRows.length === 0) {
      return NextResponse.json(
        {
          error: `No station readings found for ${
            targetCity === "ALL" ? "India" : targetCity
          } on ${targetDate}. Try another date between 2018-01-01 and 2020-06-30 (e.g., 2019-11-03 or 2019-11-06).`,
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
      title: `CPCB ${cityLabel} — ${targetDate}`,
      sourceUrl: "https://huggingface.co/datasets/AdityaaXD/AQI-Of-India",
      rowCount: formattedRows.length,
    });
  } catch (err: unknown) {
    console.error("Dataset API Error:", err);
    const msg = err instanceof Error ? err.message : "Failed to load dataset.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
