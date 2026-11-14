"use client";

import React, { useState } from "react";
import { UploadCloud, FileText, Sparkles, Database, Check } from "lucide-react";
import { SAMPLE_DATASETS, SampleDataset } from "@/lib/sample-datasets";

interface DataIngestionProps {
  onAnalyze: (rawText: string, briefTitle: string) => Promise<void>;
  isLoading: boolean;
}

export function DataIngestionSection({ onAnalyze, isLoading }: DataIngestionProps) {
  const [rawText, setRawText] = useState(SAMPLE_DATASETS[0].rawText);
  const [briefTitle, setBriefTitle] = useState(SAMPLE_DATASETS[0].name);
  const [selectedDatasetId, setSelectedDatasetId] = useState(SAMPLE_DATASETS[0].id);
  const [loadSuccess, setLoadSuccess] = useState(false);

  const handleSelectSample = (dataset: SampleDataset) => {
    setSelectedDatasetId(dataset.id);
    setRawText(dataset.rawText);
    setBriefTitle(dataset.name);
    setLoadSuccess(true);
    setTimeout(() => setLoadSuccess(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBriefTitle(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setRawText(content);
        setSelectedDatasetId("custom-upload");
      }
    };
    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawText.trim()) return;
    onAnalyze(rawText, briefTitle);
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              1
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Data Ingestion & Normalization
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Accepts raw, messy tables with missing readings (NA/null), inconsistent units (ppm/µg), and erratic timestamps.
          </p>
        </div>

        {/* Quick Load Built-in Datasets for Evaluators */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-emerald-400" />
            Load Sample:
          </span>
          {SAMPLE_DATASETS.map((ds) => (
            <button
              key={ds.id}
              type="button"
              onClick={() => handleSelectSample(ds)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition font-medium ${
                selectedDatasetId === ds.id
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm"
                  : "bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white"
              }`}
            >
              {ds.id === "delhi-ncr-winter-morning" ? "Delhi Morning (Messy)" : ds.id === "delhi-ncr-winter-evening" ? "Delhi Evening (Delta)" : "Mumbai MIDC"}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Brief Title / Ward Identification
            </label>
            <input
              type="text"
              value={briefTitle}
              onChange={(e) => setBriefTitle(e.target.value)}
              placeholder="e.g., Delhi Ward 4 Morning Peak Monitoring"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Upload CSV / TSV File
            </label>
            <label className="flex items-center justify-center space-x-2 w-full bg-slate-800/60 hover:bg-slate-800 border border-slate-700/80 border-dashed rounded-xl px-3.5 py-2.5 text-xs text-slate-300 cursor-pointer transition">
              <UploadCloud className="w-4 h-4 text-emerald-400" />
              <span>Choose CSV / TXT</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-slate-300 flex items-center space-x-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              <span>Raw Tabular Data (Pasted or Uploaded)</span>
            </label>
            {loadSuccess && (
              <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
                <Check className="w-3 h-3" />
                <span>Dataset loaded</span>
              </span>
            )}
          </div>
          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              setSelectedDatasetId("custom-input");
            }}
            placeholder="Paste CSV, TSV, or comma/tab-separated table here..."
            className="w-full font-mono text-xs bg-slate-950/90 border border-slate-800 rounded-xl p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
            required
          />
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-slate-500">
            Automated preprocessing parses headers, extracts units, indexes rows (`ROW_001`...), and flags sensor anomalies.
          </p>

          <button
            type="submit"
            disabled={isLoading || !rawText.trim()}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-medium text-sm text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-lg shadow-emerald-900/30 disabled:opacity-50 transition"
          >
            <Sparkles className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>{isLoading ? "Analyzing Air Quality with Gemini..." : "Run AI Analysis & Briefing"}</span>
          </button>
        </div>
      </form>
    </section>
  );
}
