"use client";

import React from "react";
import { ArrowUpRight } from "lucide-react";
import { HotspotFinding, TrendFinding } from "@/lib/types";

interface HotspotExplorerProps {
  summary: string;
  overallCategory: string;
  hotspots: HotspotFinding[];
  trends: TrendFinding[];
  onSelectRowCitation: (rowId: string) => void;
}

export function HotspotExplorer({
  summary,
  overallCategory,
  hotspots,
  trends,
  onSelectRowCitation,
}: HotspotExplorerProps) {
  const getSeverityStyles = (severity: string) => {
    switch (severity) {
      case "HAZARDOUS":
        return "text-red-800 bg-red-50 border-red-200";
      case "VERY_UNHEALTHY":
        return "text-purple-800 bg-purple-50 border-purple-200";
      case "UNHEALTHY":
        return "text-amber-800 bg-amber-50 border-amber-200";
      case "UNHEALTHY_SENSITIVE":
        return "text-orange-800 bg-orange-50 border-orange-200";
      default:
        return "text-emerald-800 bg-emerald-50 border-emerald-200";
    }
  };

  return (
    <section
      id="section-hotspots"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col sm:flex-row sm:items-end justify-between pb-5 border-b border-slate-200 gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            03. Hotspots &amp; Plain-Language Trends
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            AI synthesis traced directly to sensor rows. Select any citation to highlight its record in the audit table.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-600 font-medium">Regional Status:</span>
          <span
            className={`px-2.5 py-1 rounded-md text-xs font-semibold border whitespace-nowrap ${getSeverityStyles(
              overallCategory
            )}`}
          >
            {overallCategory.replaceAll("_", " ")}
          </span>
        </div>
      </div>

      {/* Executive Summary (clean editorial block separated by hairline divider) */}
      <div className="py-5 border-b border-slate-200">
        <h3 className="text-xs font-semibold text-slate-600 tracking-wide mb-1.5">
          Executive Briefing Summary
        </h3>
        <p className="text-base text-slate-900 leading-relaxed max-w-4xl">{summary}</p>
      </div>

      {/* Regional Trends */}
      {trends.length > 0 && (
        <div className="py-5 border-b border-slate-200">
          <h3 className="text-xs font-semibold text-slate-600 tracking-wide mb-3">
            Observed Regional Trends
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trends.map((t, idx) => (
              <div key={idx} className="space-y-2">
                <h4 className="text-sm font-semibold text-slate-950">{t.trend_title}</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{t.description}</p>
                {t.evidence_rows && t.evidence_rows.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-xs text-slate-600">Evidence:</span>
                    {t.evidence_rows.map((rowId) => (
                      <button
                        key={rowId}
                        type="button"
                        onClick={() => onSelectRowCitation(rowId)}
                        className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 hover:bg-teal-50 text-slate-800 hover:text-[#0D6E5C] border border-slate-200 hover:border-[#0D6E5C]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition inline-flex items-center gap-0.5 tabular-nums"
                      >
                        <span>{rowId}</span>
                        <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Critical Local Hotspots Grid */}
      <div className="pt-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-slate-600 tracking-wide">
            Identified Local Hotspots ({hotspots.length})
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {hotspots.map((hs) => (
            <div
              key={hs.id}
              className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between bg-slate-50/50 hover:bg-white transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="text-sm font-semibold text-slate-950">{hs.location_name}</h4>
                  <span
                    className={`text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap shrink-0 ${getSeverityStyles(
                      hs.severity
                    )}`}
                  >
                    {hs.severity.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="flex items-baseline flex-wrap gap-x-2 gap-y-1 mb-2.5 text-xs text-slate-600">
                  <span className="text-base font-bold text-red-700 font-mono tabular-nums">
                    {hs.peak_value}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-medium text-slate-800">{hs.pollutant_of_concern}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{hs.timestamp}</span>
                </div>

                <p className="text-xs text-slate-700 leading-relaxed">{hs.plain_language_summary}</p>

                {hs.likely_cause && (
                  <p className="text-xs text-slate-600 mt-2.5">
                    <strong className="font-semibold text-slate-800">Likely driver:</strong>{" "}
                    {hs.likely_cause}
                  </p>
                )}
              </div>

              {/* Traceability Row Citations */}
              <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600 font-medium">Source rows</span>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {hs.evidence_rows.map((rowId) => (
                    <button
                      key={rowId}
                      type="button"
                      onClick={() => onSelectRowCitation(rowId)}
                      title={`Inspect ${rowId} in the audit table`}
                      className="text-[11px] font-mono px-2 py-0.5 rounded bg-white hover:bg-teal-50 text-slate-800 hover:text-[#0D6E5C] border border-slate-300 hover:border-[#0D6E5C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition inline-flex items-center gap-0.5 tabular-nums"
                    >
                      <span>{rowId}</span>
                      <ArrowUpRight className="w-3 h-3" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
