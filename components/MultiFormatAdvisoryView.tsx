"use client";

import React, { useState } from "react";
import { FileText, Globe, BookOpen, HeartPulse, Check, X, Printer, RefreshCw } from "lucide-react";
import { DualAudienceAdvisory, AnalysisResult } from "@/lib/types";

interface MultiFormatAdvisoryProps {
  analysis: AnalysisResult;
  advisory: DualAudienceAdvisory | null;
  isLoading: boolean;
  onGenerateAdvisory: (
    language: "en" | "hi" | "mr" | "bn",
    readingLevel: "Grade 5 (Plain Language)" | "Grade 8 (Standard)" | "Technical / Specialist"
  ) => void;
}

export function MultiFormatAdvisoryView({
  analysis,
  advisory,
  isLoading,
  onGenerateAdvisory,
}: MultiFormatAdvisoryProps) {
  const [activeFormat, setActiveFormat] = useState<"citizen" | "internal">("citizen");
  const [selectedLanguage, setSelectedLanguage] = useState<"en" | "hi" | "mr" | "bn">("en");
  const [selectedReadingLevel, setSelectedReadingLevel] = useState<
    "Grade 5 (Plain Language)" | "Grade 8 (Standard)" | "Technical / Specialist"
  >("Grade 5 (Plain Language)");

  const handleApplyPreferences = () => {
    onGenerateAdvisory(selectedLanguage, selectedReadingLevel);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              6
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Multi-Format Output & Multilingual Studio
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Produce an official internal briefing note alongside a plain-language citizen health advisory with vulnerable group protocols.
          </p>
        </div>

        {/* Format Switcher */}
        <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
          <button
            onClick={() => setActiveFormat("citizen")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeFormat === "citizen"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Citizen Advisory</span>
          </button>
          <button
            onClick={() => setActiveFormat("internal")}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              activeFormat === "internal"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Internal Briefing Note</span>
          </button>
        </div>
      </div>

      {/* Citizen Advisory Configuration Bar */}
      {activeFormat === "citizen" && (
        <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* Language Selection */}
            <div className="flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <label className="text-xs text-slate-400">Language:</label>
              <select
                value={selectedLanguage}
                onChange={(e) => setSelectedLanguage(e.target.value as "en" | "hi" | "mr" | "bn")}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="bn">বাংলা (Bengali)</option>
              </select>
            </div>

            {/* Reading Level Selection */}
            <div className="flex items-center space-x-1.5">
              <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
              <label className="text-xs text-slate-400">Reading Level:</label>
              <select
                value={selectedReadingLevel}
                onChange={(e) =>
                  setSelectedReadingLevel(
                    e.target.value as
                      | "Grade 5 (Plain Language)"
                      | "Grade 8 (Standard)"
                      | "Technical / Specialist"
                  )
                }
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Grade 5 (Plain Language)">Grade 5 (Plain Language)</option>
                <option value="Grade 8 (Standard)">Grade 8 (Standard)</option>
                <option value="Technical / Specialist">Technical / Specialist</option>
              </select>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleApplyPreferences}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition disabled:opacity-50 flex items-center space-x-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Generating..." : "Generate Advisory"}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-2.5 py-1.5 rounded-lg text-xs text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition flex items-center space-x-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>
      )}

      {!advisory ? (
        <div className="mt-5 p-8 text-center bg-slate-950/60 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            Click to generate tailored public health advisories and the internal briefing note.
          </p>
          <button
            onClick={handleApplyPreferences}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow transition disabled:opacity-50"
          >
            {isLoading ? "Translating & Formatting with Gemini..." : "Generate Briefings"}
          </button>
        </div>
      ) : activeFormat === "citizen" ? (
        /* CITIZEN ADVISORY VIEW */
        <div className="mt-5 space-y-5">
          {/* Headline and Alert Summary */}
          <div className="p-4 bg-gradient-to-r from-red-950/30 to-amber-950/20 border border-red-800/40 rounded-xl">
            <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400 mb-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse"></span>
              <span>PUBLIC AIR QUALITY ADVISORY [{advisory.language.toUpperCase()}]</span>
            </div>
            <h3 className="text-base font-bold text-white tracking-tight">
              {advisory.citizen_advisory.headline}
            </h3>
            <p className="text-xs text-slate-200 mt-2 leading-relaxed">
              {advisory.citizen_advisory.alert_summary}
            </p>
          </div>

          {/* Sensitive Group Dedicated Care Cards */}
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <HeartPulse className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider">
                Vulnerable Group Health Protocols
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {advisory.citizen_advisory.sensitive_group_care.map((group, idx) => (
                <div
                  key={idx}
                  className="bg-slate-950/80 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-white">{group.group_name}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase ${
                          group.caution_level.includes("High")
                            ? "bg-red-950 text-red-300 border-red-800"
                            : group.caution_level.includes("Moderate")
                            ? "bg-amber-950 text-amber-300 border-amber-800"
                            : "bg-emerald-950 text-emerald-300 border-emerald-800"
                        }`}
                      >
                        {group.caution_level}
                      </span>
                    </div>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                      {group.recommendations.map((rec, rIdx) => (
                        <li key={rIdx} className="leading-relaxed">
                          {rec}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-3.5">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-xs mb-2">
                <Check className="w-4 h-4" />
                <span>Recommended Actions (Do&apos;s)</span>
              </div>
              <ul className="text-xs text-emerald-200/90 space-y-1.5">
                {advisory.citizen_advisory.dos_and_donts.dos.map((item, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3.5">
              <div className="flex items-center space-x-1.5 text-red-400 font-semibold text-xs mb-2">
                <X className="w-4 h-4" />
                <span>Activities to Avoid (Don&apos;ts)</span>
              </div>
              <ul className="text-xs text-red-200/90 space-y-1.5">
                {advisory.citizen_advisory.dos_and_donts.donts.map((item, i) => (
                  <li key={i} className="flex items-start space-x-1.5">
                    <span className="text-red-400 font-bold shrink-0">✗</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* INTERNAL TECHNICAL BRIEFING NOTE */
        <div className="mt-5 space-y-4">
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
              Executive Technical Brief (For Official Use)
            </span>
            <p className="text-xs text-slate-200 mt-1 leading-relaxed">
              {advisory.internal_briefing_note.executive_overview}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Statutory Breaches */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
              <h4 className="text-xs font-semibold text-red-400 mb-2 flex items-center space-x-1.5">
                <span>Statutory Standards & Threshold Breaches</span>
              </h4>
              <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                {advisory.internal_briefing_note.statutory_threshold_breaches.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* Sensor Network Integrity */}
            <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800">
              <h4 className="text-xs font-semibold text-amber-400 mb-2">
                Sensor Network Integrity & Telemetry Audit
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
                {advisory.internal_briefing_note.sensor_network_integrity}
              </p>
              <div className="mt-2 text-[11px] text-slate-400">
                Monitored: {analysis.data_health.total_readings} stations |{" "}
                {analysis.data_health.missing_or_corrupt_count} gaps identified
              </div>
            </div>
          </div>

          {/* Inter-Agency Directives */}
          <div className="p-4 bg-slate-950 rounded-xl border border-slate-800">
            <h4 className="text-xs font-semibold text-emerald-400 mb-2">
              Cross-Departmental & Inter-Agency Directives
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-300">
              {advisory.internal_briefing_note.inter_agency_action_items.map((item, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="font-semibold text-slate-200 block mb-0.5">Directive {i + 1}</span>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
