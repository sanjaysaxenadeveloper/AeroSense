"use client";

import React, { useState } from "react";
import {
  GitCompare,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  UploadCloud,
  Database,
} from "lucide-react";
import { HF_AQI_DATASET, MAX_UPLOAD_BYTES } from "@/lib/constants";
import type { BriefComparisonResult, AnalysisResult } from "@/lib/types";

interface BriefComparisonProps {
  currentBrief: AnalysisResult;
  previousBriefs: AnalysisResult[];
  selectedPreviousId: string;
  onSelectPreviousId: (id: string) => void;
  comparisonResult: BriefComparisonResult | null;
  isLoading: boolean;
  onRunComparison: () => void;
  onUploadBaselineAndCompare: (rawText: string, briefTitle: string) => Promise<void>;
  onFetchHfBaselineAndCompare: (city: string, date: string) => Promise<void>;
}

export function BriefComparisonView({
  currentBrief,
  previousBriefs,
  selectedPreviousId,
  onSelectPreviousId,
  comparisonResult,
  isLoading,
  onRunComparison,
  onUploadBaselineAndCompare,
  onFetchHfBaselineAndCompare,
}: BriefComparisonProps) {
  const [baselineCity, setBaselineCity] = useState<string>(HF_AQI_DATASET.defaultCity);
  const [baselineDate, setBaselineDate] = useState<string>(HF_AQI_DATASET.defaultDate);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const getTrendStyles = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return "text-emerald-800 bg-emerald-50 border-emerald-200";
      case "DETERIORATING":
        return "text-red-800 bg-red-50 border-red-200";
      default:
        return "text-amber-800 bg-amber-50 border-amber-200";
    }
  };

  const handleBaselineUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (file.size > MAX_UPLOAD_BYTES) {
      setUploadError("Baseline file exceeds the 500 KB upload limit.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content && content.trim()) {
        void onUploadBaselineAndCompare(content, file.name.replace(/\.[^/.]+$/, ""));
      }
    };
    reader.onerror = () => {
      setUploadError("Unable to read baseline file.");
    };
    reader.readAsText(file);
  };

  return (
    <section
      id="section-compare"
      aria-busy={isLoading}
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            05. Brief-to-Brief Delta Comparison
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Compare the current brief against an earlier monitoring run to verify what changed and whether interventions reduced exposure.
          </p>
        </div>

        {/* Prior Brief Selector */}
        {previousBriefs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label htmlFor="prev-brief-select" className="text-xs font-medium text-slate-600">
              Baseline:
            </label>
            <select
              id="prev-brief-select"
              value={selectedPreviousId}
              onChange={(e) => onSelectPreviousId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C] max-w-xs"
            >
              {previousBriefs.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.brief_title} ({new Date(pb.brief_timestamp).toLocaleTimeString()})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={onRunComparison}
              disabled={isLoading || !selectedPreviousId}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Comparing..." : "Compare Briefs"}</span>
            </button>
          </div>
        )}
      </div>

      {previousBriefs.length === 0 ? (
        <div className="mt-5 p-6 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center space-y-4">
          <div>
            <GitCompare className="w-6 h-6 mx-auto mb-2 text-[#0D6E5C]" />
            <p className="text-sm font-semibold text-slate-900">
              Baseline brief saved: {currentBrief.brief_title}
            </p>
            <p className="text-xs text-slate-600 mt-1 max-w-xl mx-auto">
              Analyze another dataset in Section 01 to compare automatically, upload a prior file, or pull a live baseline date from Hugging Face AQI-Of-India below.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition cursor-pointer focus-within:ring-2 focus-within:ring-[#0D6E5C] focus-within:ring-offset-2 whitespace-nowrap">
              <UploadCloud className="w-4 h-4" aria-hidden="true" />
              <span>{isLoading ? "Analyzing & Comparing..." : "Upload Baseline File"}</span>
              <input
                type="file"
                accept=".csv,.tsv,.txt,.json,.md"
                onChange={handleBaselineUpload}
                disabled={isLoading}
                className="sr-only"
              />
            </label>

            <span className="text-xs text-slate-600 font-medium">or</span>

            <div className="inline-flex flex-wrap items-center justify-center gap-2 bg-white border border-slate-200 rounded-lg p-1.5">
              <Database className="w-3.5 h-3.5 text-[#0D6E5C] ml-1 shrink-0" aria-hidden="true" />
              <input
                type="text"
                aria-label="Baseline city"
                value={baselineCity}
                onChange={(e) => setBaselineCity(e.target.value)}
                placeholder="City"
                className="w-24 bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
              <input
                type="date"
                aria-label="Baseline date"
                min={HF_AQI_DATASET.minDate}
                max={HF_AQI_DATASET.maxDate}
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded px-2 py-1 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
              <button
                type="button"
                onClick={() => void onFetchHfBaselineAndCompare(baselineCity || HF_AQI_DATASET.defaultCity, baselineDate)}
                disabled={isLoading || !baselineDate}
                className="px-3 py-1 rounded text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition disabled:opacity-50 whitespace-nowrap"
              >
                {isLoading ? "Comparing..." : "Compare HF Date"}
              </button>
            </div>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-red-700 font-medium pt-1">
              {uploadError}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-4 pt-3 border-b border-slate-200 pb-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-600">
              Or compare <strong>{currentBrief.brief_title}</strong> against a new baseline file or Hugging Face date:
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition cursor-pointer focus-within:ring-2 focus-within:ring-[#0D6E5C] whitespace-nowrap">
                <UploadCloud className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
                <span>Upload Baseline</span>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,.json,.md"
                  onChange={handleBaselineUpload}
                  disabled={isLoading}
                  className="sr-only"
                />
              </label>
              <input
                type="text"
                aria-label="New HF baseline city"
                value={baselineCity}
                onChange={(e) => setBaselineCity(e.target.value)}
                placeholder="City"
                className="w-24 bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
              <input
                type="date"
                aria-label="New HF baseline date"
                min={HF_AQI_DATASET.minDate}
                max={HF_AQI_DATASET.maxDate}
                value={baselineDate}
                onChange={(e) => setBaselineDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
              <button
                type="button"
                onClick={() => void onFetchHfBaselineAndCompare(baselineCity || HF_AQI_DATASET.defaultCity, baselineDate)}
                disabled={isLoading || !baselineDate}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition disabled:opacity-50 whitespace-nowrap"
              >
                Compare HF Date
              </button>
            </div>
          </div>
          {uploadError && (
            <p role="alert" className="text-xs text-red-700 font-medium">
              {uploadError}
            </p>
          )}
        </div>
      )}

      {previousBriefs.length > 0 && isLoading && !comparisonResult ? (
        <div className="mt-5 space-y-4 animate-pulse">
          <div className="h-20 bg-slate-100 rounded-lg border border-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-28 bg-slate-100 rounded-lg border border-slate-200" />
            <div className="h-28 bg-slate-100 rounded-lg border border-slate-200" />
            <div className="h-28 bg-slate-100 rounded-lg border border-slate-200" />
          </div>
        </div>
      ) : !comparisonResult ? (
        <div className="mt-5 p-6 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 text-center">
          <p className="text-sm text-slate-700 mb-3">
            Compare <strong>{currentBrief.brief_title}</strong> against the selected baseline brief.
          </p>
          <button
            type="button"
            onClick={onRunComparison}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition disabled:opacity-50"
          >
            {isLoading ? "Comparing..." : "Run Delta Comparison"}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          {/* Trajectory Overview */}
          <div className="pb-5 border-b border-slate-200 flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="max-w-3xl">
              <span className="text-xs font-semibold text-slate-600">
                Delta Summary ({comparisonResult.previous_brief_date} →{" "}
                {comparisonResult.current_brief_date})
              </span>
              <p className="text-sm text-slate-900 mt-1 leading-relaxed">
                {comparisonResult.aqi_delta_summary}
              </p>
            </div>
            <span
              className={`px-3 py-1 rounded-md text-xs font-semibold border inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${getTrendStyles(
                comparisonResult.overall_trend
              )}`}
            >
              {comparisonResult.overall_trend === "IMPROVING" ? (
                <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              <span>Trajectory: {comparisonResult.overall_trend}</span>
            </span>
          </div>

          {/* 3-Column Hotspot Dynamics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-5 border-b border-slate-200">
            <div>
              <h3 className="text-xs font-semibold text-[#0D6E5C] mb-2">
                Resolved / Mitigated ({comparisonResult.resolved_hotspots.length})
              </h3>
              {comparisonResult.resolved_hotspots.length > 0 ? (
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {comparisonResult.resolved_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600 italic">No resolved hotspots detected.</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-red-700 mb-2">
                Newly Emerged ({comparisonResult.new_hotspots.length})
              </h3>
              {comparisonResult.new_hotspots.length > 0 ? (
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {comparisonResult.new_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600 italic">No new hotspots emerged.</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-amber-800 mb-2">
                Persistent Chronic ({comparisonResult.persistent_hotspots.length})
              </h3>
              {comparisonResult.persistent_hotspots.length > 0 ? (
                <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                  {comparisonResult.persistent_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-600 italic">None</p>
              )}
            </div>
          </div>

          {/* Intervention Efficacy Assessment */}
          <div>
            <h3 className="text-xs font-semibold text-slate-600 mb-1">
              Intervention Efficacy Assessment
            </h3>
            <p className="text-sm text-slate-800 leading-relaxed">
              {comparisonResult.intervention_efficacy_assessment}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
