"use client";

import React, { useState, useEffect } from "react";
import {
  UploadCloud,
  FileText,
  ArrowRight,
  Check,
  Trash2,
  Database,
  Globe,
  ExternalLink,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { HF_AQI_DATASET, MAX_UPLOAD_BYTES } from "@/lib/constants";

interface DataIngestionProps {
  onAnalyze: (rawText: string, briefTitle: string) => Promise<void>;
  isLoading: boolean;
}

type DatasetSourceMode = "hf_aqi_india" | "custom_url";

export function DataIngestionSection({ onAnalyze, isLoading }: DataIngestionProps) {
  const [rawText, setRawText] = useState("");
  const [briefTitle, setBriefTitle] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);

  // Live remote dataset connector state
  const [sourceMode, setSourceMode] = useState<DatasetSourceMode>("hf_aqi_india");
  const [availableCities, setAvailableCities] = useState<string[]>(["Delhi"]);
  const [selectedCity, setSelectedCity] = useState("Delhi");
  const [selectedDate, setSelectedDate] = useState("2019-11-03");
  const [customUrl, setCustomUrl] = useState("");
  const [isFetchingDataset, setIsFetchingDataset] = useState(false);
  const [datasetError, setDatasetError] = useState<string | null>(null);
  const [datasetNotice, setDatasetNotice] = useState<{
    message: string;
    sourceUrl: string;
  } | null>(null);

  // Load live city index from Hugging Face stations.csv
  useEffect(() => {
    let cancelled = false;
    async function loadDatasetMeta() {
      try {
        const res = await fetch("/api/dataset");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.cities) && data.cities.length > 0) {
          setAvailableCities(data.cities);
        }
      } catch {
        // Non-blocking fallback keeps initial Delhi option
      }
    }
    void loadDatasetMeta();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_UPLOAD_BYTES) {
      setDatasetError("Uploaded file exceeds the 500 KB limit. Please slice a smaller telemetry window.");
      e.target.value = "";
      return;
    }

    setUploadedFileName(file.name);
    setDatasetNotice(null);
    setDatasetError(null);
    if (!briefTitle.trim()) {
      setBriefTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
      }
    };
    reader.onerror = () => {
      setDatasetError("Unable to read selected file. Please verify file encoding is UTF-8 text.");
    };
    reader.readAsText(file);
  };

  const handleFetchDataset = async () => {
    setIsFetchingDataset(true);
    setDatasetError(null);
    setDatasetNotice(null);

    try {
      const payload =
        sourceMode === "hf_aqi_india"
          ? {
              source: "hf_aqi_india",
              city: selectedCity,
              date: selectedDate,
              maxRows: 30,
            }
          : {
              source: "custom_url",
              url: customUrl.trim(),
              maxRows: 30,
            };

      const res = await fetch("/api/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch live dataset.");
      }

      setRawText(data.csvText || "");
      setBriefTitle(data.title || "");
      setUploadedFileName(null);
      setDatasetNotice({
        message: `Loaded ${data.rowCount} live rows (${data.title})`,
        sourceUrl: data.sourceUrl,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch live dataset.";
      setDatasetError(msg);
    } finally {
      setIsFetchingDataset(false);
    }
  };

  const handleClear = () => {
    setRawText("");
    setBriefTitle("");
    setUploadedFileName(null);
    setDatasetNotice(null);
    setDatasetError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    onAnalyze(rawText, briefTitle.trim());
  };

  const handleSourceTabKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End") {
      e.preventDefault();
      const next: DatasetSourceMode =
        e.key === "Home"
          ? "hf_aqi_india"
          : e.key === "End"
          ? "custom_url"
          : sourceMode === "hf_aqi_india"
          ? "custom_url"
          : "hf_aqi_india";
      setSourceMode(next);
      setDatasetError(null);
      document.getElementById(`tab-source-${next}`)?.focus();
    }
  };

  return (
    <section
      id="section-ingestion"
      aria-busy={isLoading || isFetchingDataset}
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            01. Data Ingestion &amp; Normalization
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Load live CPCB monitoring records from Hugging Face, fetch a public CSV URL, upload a local file, or paste messy sensor tables.
          </p>
        </div>

        {(rawText || briefTitle || datasetNotice) && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors whitespace-nowrap shrink-0 self-start sm:self-auto"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Input</span>
          </button>
        )}
      </div>

      {/* Live Remote Dataset Connector */}
      <div className="mt-5 bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
            <Database className="w-4 h-4 text-[#0D6E5C] shrink-0" aria-hidden="true" />
            <span>Live Public Dataset Connector</span>
            <a
              href={HF_AQI_DATASET.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-mono text-[11px] font-medium text-[#0D6E5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded ml-1"
            >
              <span>{HF_AQI_DATASET.repo}</span>
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>

          <div
            role="tablist"
            aria-label="Live dataset source"
            className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 self-start sm:self-auto"
          >
            <button
              id="tab-source-hf_aqi_india"
              type="button"
              role="tab"
              aria-selected={sourceMode === "hf_aqi_india"}
              aria-controls="tabpanel-source-hf_aqi_india"
              tabIndex={sourceMode === "hf_aqi_india" ? 0 : -1}
              onClick={() => {
                setSourceMode("hf_aqi_india");
                setDatasetError(null);
              }}
              onKeyDown={handleSourceTabKeyDown}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] ${
                sourceMode === "hf_aqi_india"
                  ? "bg-[#0D6E5C] text-white"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Hugging Face CPCB
            </button>
            <button
              id="tab-source-custom_url"
              type="button"
              role="tab"
              aria-selected={sourceMode === "custom_url"}
              aria-controls="tabpanel-source-custom_url"
              tabIndex={sourceMode === "custom_url" ? 0 : -1}
              onClick={() => {
                setSourceMode("custom_url");
                setDatasetError(null);
              }}
              onKeyDown={handleSourceTabKeyDown}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] ${
                sourceMode === "custom_url"
                  ? "bg-[#0D6E5C] text-white"
                  : "text-slate-600 hover:text-slate-950"
              }`}
            >
              Public HTTPS URL
            </button>
          </div>
        </div>

        {sourceMode === "hf_aqi_india" ? (
          <div
            id="tabpanel-source-hf_aqi_india"
            role="tabpanel"
            aria-labelledby="tab-source-hf_aqi_india"
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-5">
              <label
                htmlFor="hf-city-select"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                City / Monitoring Network
              </label>
              <select
                id="hf-city-select"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              >
                <option value="ALL">All Cities (India Stations)</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-4">
              <label
                htmlFor="hf-date-input"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Observation Date (2015–2020)
              </label>
              <input
                id="hf-date-input"
                type="date"
                min="2015-01-01"
                max="2020-07-01"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleFetchDataset}
                disabled={isFetchingDataset || !selectedDate}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#0D6E5C] ${isFetchingDataset ? "animate-spin" : ""}`}
                />
                <span>{isFetchingDataset ? "Fetching CSV..." : "Fetch Live CSV"}</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            id="tabpanel-source-custom_url"
            role="tabpanel"
            aria-labelledby="tab-source-custom_url"
            className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
          >
            <div className="sm:col-span-9">
              <label
                htmlFor="custom-dataset-url"
                className="block text-[11px] font-semibold text-slate-600 mb-1"
              >
                Public HTTPS CSV / TSV / JSON URL
              </label>
              <div className="relative">
                <Globe className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                <input
                  id="custom-dataset-url"
                  type="url"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  placeholder="https://huggingface.co/datasets/AdityaaXD/AQI-Of-India/resolve/main/city_day.csv"
                  className="w-full bg-white border border-slate-300 rounded-lg pl-8 pr-3 py-2 text-xs font-mono text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
                />
              </div>
            </div>

            <div className="sm:col-span-3">
              <button
                type="button"
                onClick={handleFetchDataset}
                disabled={isFetchingDataset || !customUrl.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#0D6E5C] ${isFetchingDataset ? "animate-spin" : ""}`}
                  aria-hidden="true"
                />
                <span>{isFetchingDataset ? "Fetching..." : "Fetch URL"}</span>
              </button>
            </div>
          </div>
        )}

        {sourceMode === "hf_aqi_india" && !datasetError && !datasetNotice && (
          <p className="text-[11px] text-slate-600">
            Active CPCB coverage: 2018-01-01 to 2020-06-30 across 230 Indian stations (try <span className="font-mono text-slate-800">{HF_AQI_DATASET.defaultDate}</span> vs <span className="font-mono text-slate-800">{HF_AQI_DATASET.comparisonDate}</span> to test multi-station spikes and brief comparison).
          </p>
        )}

        {datasetError && (
          <div
            role="alert"
            className="p-2.5 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{datasetError}</span>
          </div>
        )}

        {datasetNotice && (
          <div
            aria-live="polite"
            className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex flex-wrap items-center justify-between gap-2"
          >
            <span className="flex items-center gap-1.5 font-medium">
              <Check className="w-3.5 h-3.5 text-[#0D6E5C] shrink-0" aria-hidden="true" />
              <span>{datasetNotice.message}</span>
            </span>
            <a
              href={datasetNotice.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0D6E5C] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded"
            >
              <span>Inspect Source</span>
              <span className="sr-only"> (opens in a new tab)</span>
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </a>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label
              htmlFor="brief-title-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Brief Title / Ward Identification
            </label>
            <input
              id="brief-title-input"
              type="text"
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
              placeholder="Enter ward, society, or monitoring report title"
              className="w-full bg-white border border-slate-300 rounded-lg px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C] transition"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Upload Local File
            </span>
            <label className="flex items-center justify-center gap-2 w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 border-dashed rounded-lg px-4 py-2.5 text-xs font-medium text-slate-700 cursor-pointer focus-within:ring-2 focus-within:ring-[#0D6E5C] focus-within:border-[#0D6E5C] transition whitespace-nowrap">
              <UploadCloud className="w-4 h-4 text-[#0D6E5C] shrink-0" aria-hidden="true" />
              <span className="truncate">
                {uploadedFileName ? uploadedFileName : "Choose CSV / TSV / TXT / JSON"}
              </span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json,.md"
                onChange={handleFileUpload}
                className="sr-only"
              />
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="raw-data-textarea"
              className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5 text-slate-600" aria-hidden="true" />
              <span>Raw Tabular Data or Sensor Readings</span>
            </label>
            {uploadedFileName && (
              <span className="text-xs font-medium text-[#0D6E5C] flex items-center gap-1">
                <Check className="w-3.5 h-3.5" aria-hidden="true" />
                <span>File loaded</span>
              </span>
            )}
          </div>
          <textarea
            id="raw-data-textarea"
            rows={7}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Fetch from the live Hugging Face dataset above, upload a file, or paste CSV, TSV, Markdown table, JSON array, or sensor logs here..."
            className="w-full font-mono text-xs leading-relaxed bg-slate-50 border border-slate-300 rounded-lg p-3.5 text-slate-800 placeholder-slate-500 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C] transition"
            required
          />
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <p className="text-xs text-slate-600">
            Preprocessing standardizes units, assigns row tags (ROW_001), and flags missing or unreliable sensor readings before Gemini analysis.
          </p>

          <button
            type="submit"
            disabled={isLoading || !rawText.trim()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm text-white bg-[#0D6E5C] hover:bg-[#095446] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] focus-visible:ring-offset-2 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <span>{isLoading ? "Analyzing Air Quality..." : "Analyze & Generate Brief"}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>
    </section>
  );
}
