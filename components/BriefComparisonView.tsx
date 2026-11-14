"use client";

import React from "react";
import { GitCompare, TrendingDown, TrendingUp, CheckCircle2, AlertOctagon, RefreshCw } from "lucide-react";
import { BriefComparisonResult, AnalysisResult } from "@/lib/types";

interface BriefComparisonProps {
  currentBrief: AnalysisResult;
  previousBriefs: AnalysisResult[];
  selectedPreviousId: string;
  onSelectPreviousId: (id: string) => void;
  comparisonResult: BriefComparisonResult | null;
  isLoading: boolean;
  onRunComparison: () => void;
}

export function BriefComparisonView({
  currentBrief,
  previousBriefs,
  selectedPreviousId,
  onSelectPreviousId,
  comparisonResult,
  isLoading,
  onRunComparison,
}: BriefComparisonProps) {
  const getTrendColor = (trend: string) => {
    switch (trend) {
      case "IMPROVING":
        return "bg-emerald-950 text-emerald-300 border-emerald-700";
      case "DETERIORATING":
        return "bg-red-950 text-red-300 border-red-700";
      default:
        return "bg-amber-950 text-amber-300 border-amber-700";
    }
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              5
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Brief Comparisons & Temporal Delta
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Compare the current brief against earlier monitoring runs to track emerging hotspots and verify intervention efficacy.
          </p>
        </div>

        {/* Prior Brief Selector */}
        {previousBriefs.length > 0 && (
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Compare With:</span>
            <select
              value={selectedPreviousId}
              onChange={(e) => onSelectPreviousId(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {previousBriefs.map((pb) => (
                <option key={pb.id} value={pb.id}>
                  {pb.brief_title} ({new Date(pb.brief_timestamp).toLocaleTimeString()})
                </option>
              ))}
            </select>

            <button
              onClick={onRunComparison}
              disabled={isLoading || !selectedPreviousId}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 flex items-center space-x-1"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Comparing..." : "Diff Briefs"}</span>
            </button>
          </div>
        )}
      </div>

      {previousBriefs.length === 0 ? (
        <div className="mt-5 p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
          <GitCompare className="w-8 h-8 mx-auto mb-2 text-slate-600" />
          <p className="font-medium text-slate-300">Only 1 brief is currently loaded in session.</p>
          <p className="text-[11px] text-slate-500 mt-1">
            Load or upload another dataset (e.g. &ldquo;Delhi-NCR Post-Intervention Evening Brief&rdquo; from the samples above) to unlock the live temporal delta comparison.
          </p>
        </div>
      ) : !comparisonResult ? (
        <div className="mt-5 p-6 rounded-xl bg-slate-950/60 border border-slate-800 text-center">
          <p className="text-xs text-slate-300 mb-3">
            Ready to compare <strong>{currentBrief.brief_title}</strong> with the selected historical brief.
          </p>
          <button
            onClick={onRunComparison}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition"
          >
            {isLoading ? "Analyzing Delta..." : "Run AI Delta Analysis"}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {/* Header Delta Card */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                Temporal Trajectory
              </span>
              <p className="text-sm font-semibold text-slate-200 mt-0.5">
                {comparisonResult.aqi_delta_summary}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span
                className={`px-3 py-1 rounded-xl text-xs font-bold border uppercase flex items-center space-x-1.5 ${getTrendColor(
                  comparisonResult.overall_trend
                )}`}
              >
                {comparisonResult.overall_trend === "IMPROVING" ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                <span>Trend: {comparisonResult.overall_trend}</span>
              </span>
            </div>
          </div>

          {/* Hotspot Movement Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Resolved */}
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3.5">
              <div className="flex items-center space-x-2 text-emerald-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Resolved Hotspots</h4>
              </div>
              {comparisonResult.resolved_hotspots.length > 0 ? (
                <ul className="text-xs text-emerald-200/80 space-y-1 list-disc list-inside">
                  {comparisonResult.resolved_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No resolved hotspots detected.</p>
              )}
            </div>

            {/* Newly Emerged */}
            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3.5">
              <div className="flex items-center space-x-2 text-red-400 mb-2">
                <AlertOctagon className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Newly Emerged Hotspots</h4>
              </div>
              {comparisonResult.new_hotspots.length > 0 ? (
                <ul className="text-xs text-red-200/80 space-y-1 list-disc list-inside">
                  {comparisonResult.new_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500 italic">No new hotspots emerged.</p>
              )}
            </div>

            {/* Persistent */}
            <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5">
              <div className="flex items-center space-x-2 text-amber-400 mb-2">
                <GitCompare className="w-4 h-4" />
                <h4 className="text-xs font-semibold">Persistent Chronic Hotspots</h4>
              </div>
              {comparisonResult.persistent_hotspots.length > 0 ? (
                <ul className="text-xs text-amber-200/80 space-y-1 list-disc list-inside">
                  {comparisonResult.persistent_hotspots.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-slate-500 italic">None</p>
              )}
            </div>
          </div>

          {/* Intervention Efficacy Assessment */}
          <div className="p-3.5 bg-slate-950/80 border border-slate-800 rounded-xl">
            <h4 className="text-[11px] uppercase font-bold text-slate-400 tracking-wider mb-1">
              Intervention Efficacy Assessment
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              {comparisonResult.intervention_efficacy_assessment}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
