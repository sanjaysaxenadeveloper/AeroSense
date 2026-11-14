"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Search, SlidersHorizontal } from "lucide-react";
import { RawDataRow, DataAuditReport } from "@/lib/types";

interface DataAuditGridProps {
  rows: RawDataRow[];
  audit: DataAuditReport;
  highlightedRowId?: string | null;
}

export function DataAuditGrid({ rows, audit, highlightedRowId }: DataAuditGridProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const filteredRows = rows.filter((r) => {
    const matchesSearch =
      r.station_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.row_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.timestamp?.toLowerCase().includes(searchTerm.toLowerCase());
    if (showFlaggedOnly) return matchesSearch && r.is_flagged;
    return matchesSearch;
  });

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              2
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Traceable Data Audit & Sensor Integrity
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Every AI finding cites an underlying row. Corrupted sensors, telemetry failures, and missing units are tagged below.
          </p>
        </div>

        {/* Audit Metrics */}
        <div className="flex items-center space-x-2">
          <div className="px-3 py-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-semibold text-slate-400">Total Nodes</span>
            <span className="text-sm font-bold text-white">{audit.total_readings}</span>
          </div>
          <div className="px-3 py-1.5 bg-emerald-950/40 border border-emerald-800/50 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-semibold text-emerald-400">Valid</span>
            <span className="text-sm font-bold text-emerald-300">{audit.valid_readings_count}</span>
          </div>
          <div className="px-3 py-1.5 bg-amber-950/40 border border-amber-800/50 rounded-xl text-center">
            <span className="block text-[10px] uppercase font-semibold text-amber-400">Flagged Gaps</span>
            <span className="text-sm font-bold text-amber-300">{audit.missing_or_corrupt_count}</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search station, ID, time..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={() => setShowFlaggedOnly(!showFlaggedOnly)}
          className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition ${
            showFlaggedOnly
              ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
              : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{showFlaggedOnly ? "Showing Flagged Only" : "Filter Flagged Only"}</span>
        </button>
      </div>

      {/* Interactive Table with Highlighting */}
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-800 max-h-80 overflow-y-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-slate-950/90 text-slate-400 sticky top-0 border-b border-slate-800 z-10">
            <tr>
              <th className="py-2.5 px-3 font-semibold">Row Citation</th>
              <th className="py-2.5 px-3 font-semibold">Station / Location</th>
              <th className="py-2.5 px-3 font-semibold">Timestamp</th>
              <th className="py-2.5 px-3 font-semibold text-right">PM2.5 (µg/m³)</th>
              <th className="py-2.5 px-3 font-semibold text-right">PM10</th>
              <th className="py-2.5 px-3 font-semibold text-right">Est. AQI</th>
              <th className="py-2.5 px-3 font-semibold">Integrity / Flag</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 bg-slate-900/60">
            {filteredRows.map((r) => {
              const isTargeted = highlightedRowId === r.row_id;
              return (
                <tr
                  key={r.row_id}
                  id={`table-row-${r.row_id}`}
                  className={`transition-colors ${
                    isTargeted
                      ? "bg-emerald-500/20 border-l-4 border-l-emerald-400 text-white font-medium"
                      : r.is_flagged
                      ? "bg-amber-950/10 hover:bg-amber-950/20"
                      : "hover:bg-slate-800/40"
                  }`}
                >
                  <td className="py-2 px-3">
                    <span
                      className={`font-mono text-[11px] px-1.5 py-0.5 rounded ${
                        isTargeted
                          ? "bg-emerald-400 text-slate-950 font-bold"
                          : "bg-slate-800 text-slate-300 border border-slate-700"
                      }`}
                    >
                      {r.row_id}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-200 font-medium">{r.station_id}</td>
                  <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">{r.timestamp}</td>
                  <td className="py-2 px-3 text-right font-mono">
                    {r.pm2_5 != null ? (
                      <span className={r.pm2_5 > 250 ? "text-red-400 font-semibold" : "text-slate-200"}>
                        {r.pm2_5}
                      </span>
                    ) : (
                      <span className="text-amber-400 italic">Missing</span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-slate-300">
                    {r.pm10 != null ? r.pm10 : <span className="text-amber-400 italic">Missing</span>}
                  </td>
                  <td className="py-2 px-3 text-right font-mono">
                    {r.aqi != null ? (
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold text-[11px] ${
                          r.aqi > 400
                            ? "bg-red-950 text-red-300 border border-red-800"
                            : r.aqi > 300
                            ? "bg-purple-950 text-purple-300 border border-purple-800"
                            : r.aqi > 200
                            ? "bg-orange-950 text-orange-300 border border-orange-800"
                            : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                        }`}
                      >
                        {r.aqi}
                      </span>
                    ) : (
                      <span className="text-slate-500">N/A</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    {r.is_flagged ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px]">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span>{r.flag_reason || "Data Gap Flagged"}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-emerald-400 text-[10px]">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Valid</span>
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
