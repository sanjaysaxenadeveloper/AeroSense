"use client";

import React, { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Search, Info } from "lucide-react";
import { RawDataRow, DataAuditReport } from "@/lib/types";

interface DataAuditGridProps {
  rows: RawDataRow[];
  audit: DataAuditReport;
  dataHealthSummary?: string;
  highlightedRowId?: string | null;
}

export function DataAuditGrid({
  rows,
  audit,
  dataHealthSummary,
  highlightedRowId,
}: DataAuditGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "flagged">("all");

  const filteredRows = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return rows.filter((r) => {
      if (highlightedRowId && r.row_id === highlightedRowId) return true;
      const matchesSearch =
        !query ||
        r.station_id?.toLowerCase().includes(query) ||
        r.row_id.toLowerCase().includes(query) ||
        r.timestamp?.toLowerCase().includes(query);
      if (filterMode === "flagged") return matchesSearch && r.is_flagged;
      return matchesSearch;
    });
  }, [rows, highlightedRowId, searchTerm, filterMode]);

  const getAqiClass = (aqi: number) => {
    if (aqi > 400) return "text-red-800 bg-red-50 border-red-200";
    if (aqi > 300) return "text-purple-800 bg-purple-50 border-purple-200";
    if (aqi > 200) return "text-amber-800 bg-amber-50 border-amber-200";
    if (aqi > 100) return "text-orange-800 bg-orange-50 border-orange-200";
    return "text-emerald-800 bg-emerald-50 border-emerald-200";
  };

  return (
    <section
      id="section-audit"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            02. Sensor Integrity &amp; Row Audit
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Indexed telemetry readings with unit normalization and automated gap flagging. Click any row citation in the brief to locate its source record.
          </p>
        </div>

        {/* Unboxed inline KPI strip with tabular numerals */}
        <div className="flex flex-wrap items-center gap-6 text-sm shrink-0">
          <div>
            <span className="block text-xs text-slate-600">Total Nodes</span>
            <span className="font-mono font-semibold text-lg text-slate-950 tabular-nums">
              {audit.total_readings}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <span className="block text-xs text-slate-600">Valid Readings</span>
            <span className="font-mono font-semibold text-lg text-[#0D6E5C] tabular-nums">
              {audit.valid_readings_count}
            </span>
          </div>
          <div className="h-8 w-px bg-slate-200" aria-hidden="true" />
          <div>
            <span className="block text-xs text-slate-600">Flagged Gaps</span>
            <span className="font-mono font-semibold text-lg text-amber-700 tabular-nums">
              {audit.missing_or_corrupt_count}
            </span>
          </div>
        </div>
      </div>

      {/* Data Health & Unit Normalization Summary (clean hairline divider, no nested card) */}
      {(dataHealthSummary ||
        (audit.unit_conversions && audit.unit_conversions.length > 0) ||
        audit.detected_units.length > 0) && (
        <div className="py-4 border-b border-slate-200 space-y-2 text-xs text-slate-700">
          {dataHealthSummary && (
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-[#0D6E5C] shrink-0 mt-0.5" />
              <p className="text-sm text-slate-700 leading-relaxed">{dataHealthSummary}</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            {audit.detected_units.length > 0 && (
              <span>
                Detected raw units:{" "}
                <strong className="text-slate-800 font-medium">
                  {audit.detected_units.join(", ")}
                </strong>
              </span>
            )}
            {audit.unit_conversions && audit.unit_conversions.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-700">
                  Normalized: {audit.unit_conversions.join("; ")}
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Search & Segmented Filter Controls */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            aria-label="Filter sensor rows by station, row ID, or timestamp"
            placeholder="Filter by station, row ID, or time..."
            className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
          />
        </div>

        <div
          role="group"
          aria-label="Row integrity filter"
          className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start sm:self-auto"
        >
          <button
            type="button"
            aria-pressed={filterMode === "all"}
            onClick={() => setFilterMode("all")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] ${
              filterMode === "all"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            All Rows ({rows.length})
          </button>
          <button
            type="button"
            aria-pressed={filterMode === "flagged"}
            onClick={() => setFilterMode("flagged")}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] ${
              filterMode === "flagged"
                ? "bg-white text-amber-800 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            Flagged Only ({audit.missing_or_corrupt_count})
          </button>
        </div>
      </div>

      <span className="sr-only" aria-live="polite">
        Showing {filteredRows.length} of {rows.length} sensor rows
      </span>

      {/* High-Density Daylight Data Grid */}
      <div className="mt-4 overflow-x-auto border border-slate-200 rounded-lg max-h-96 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <caption className="sr-only">
            Indexed sensor integrity and normalized air quality readings
          </caption>
          <thead className="bg-slate-50 text-slate-700 sticky top-0 border-b border-slate-200 z-10">
            <tr>
              <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">Citation</th>
              <th scope="col" className="py-2.5 px-3 font-semibold">Station / Location</th>
              <th scope="col" className="py-2.5 px-3 font-semibold whitespace-nowrap">Timestamp</th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                PM2.5 (µg/m³)
              </th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                PM10 (µg/m³)
              </th>
              <th scope="col" className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Est. AQI</th>
              <th scope="col" className="py-2.5 px-3 font-semibold">Integrity Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredRows.map((r) => {
              const isTargeted = highlightedRowId === r.row_id;
              return (
                <tr
                  key={r.row_id}
                  id={`table-row-${r.row_id}`}
                  className={`transition-colors ${
                    isTargeted
                      ? "bg-teal-50 ring-1 ring-inset ring-[#0D6E5C]/40"
                      : r.is_flagged
                      ? "bg-amber-50/40 hover:bg-amber-50/70"
                      : "hover:bg-slate-50"
                  }`}
                >
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded border ${
                        isTargeted
                          ? "bg-[#0D6E5C] text-white border-[#0D6E5C] font-semibold"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                      }`}
                    >
                      {r.row_id}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-900 font-medium">
                    <div>{r.station_id}</div>
                    {r.notes && (
                      <div className="text-[11px] text-slate-600 font-normal mt-0.5">{r.notes}</div>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 font-mono text-[11px] tabular-nums whitespace-nowrap">
                    {r.timestamp}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {r.pm2_5 != null ? (
                      <span
                        className={
                          r.pm2_5 > 250 ? "text-red-700 font-semibold" : "text-slate-800"
                        }
                      >
                        {r.pm2_5}
                      </span>
                    ) : (
                      <span className="text-amber-700 italic">Missing</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {r.pm10 != null ? r.pm10 : <span className="text-amber-700 italic">Missing</span>}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                    {r.aqi != null ? (
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded border font-semibold text-[11px] ${getAqiClass(
                          r.aqi
                        )}`}
                      >
                        {r.aqi}
                      </span>
                    ) : (
                      <span className="text-slate-600">N/A</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    {r.is_flagged ? (
                      <span className="inline-flex items-start gap-1.5 text-amber-800 text-[11px] font-medium">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{r.flag_reason || "Data gap flagged"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[#0D6E5C] text-[11px] font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Verified</span>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
