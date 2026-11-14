"use client";

import React, { useState } from "react";
import {
  FileText,
  Globe,
  BookOpen,
  Check,
  X,
  Printer,
  RefreshCw,
  Copy,
} from "lucide-react";
import {
  DualAudienceAdvisory,
  AnalysisResult,
  AdvisoryLanguage,
  AdvisoryReadingLevel,
} from "@/lib/types";

interface MultiFormatAdvisoryProps {
  analysis: AnalysisResult;
  advisory: DualAudienceAdvisory | null;
  isLoading: boolean;
  onGenerateAdvisory: (
    language: AdvisoryLanguage,
    readingLevel: AdvisoryReadingLevel
  ) => void;
}

export function MultiFormatAdvisoryView({
  analysis,
  advisory,
  isLoading,
  onGenerateAdvisory,
}: MultiFormatAdvisoryProps) {
  const [activeFormat, setActiveFormat] = useState<"citizen" | "internal">("citizen");
  const [selectedLanguage, setSelectedLanguage] = useState<AdvisoryLanguage>("en");
  const [selectedReadingLevel, setSelectedReadingLevel] =
    useState<AdvisoryReadingLevel>("Grade 5 (Plain Language)");
  const [copied, setCopied] = useState(false);

  const handleApplyPreferences = () => {
    onGenerateAdvisory(selectedLanguage, selectedReadingLevel);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopy = async () => {
    if (!advisory) return;
    let text = "";
    if (activeFormat === "citizen") {
      const ca = advisory.citizen_advisory;
      text = `${ca.headline}\n\n${ca.alert_summary}\n\n${ca.sensitive_group_care
        .map((g) => `${g.group_name} (${g.caution_level}):\n- ${g.recommendations.join("\n- ")}`)
        .join("\n\n")}\n\nDO:\n- ${ca.dos_and_donts.dos.join("\n- ")}\n\nDON'T:\n- ${ca.dos_and_donts.donts.join("\n- ")}`;
    } else {
      const note = advisory.internal_briefing_note;
      text = `INTERNAL BRIEFING NOTE\n\nOverview:\n${note.executive_overview}\n\nThreshold Breaches:\n- ${note.statutory_threshold_breaches.join(
        "\n- "
      )}\n\nSensor Network Integrity:\n${note.sensor_network_integrity}\n\nInter-Agency Directives:\n- ${note.inter_agency_action_items.join(
        "\n- "
      )}`;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard restrictions
    }
  };

  const getCautionStyles = (caution: string) => {
    if (caution.includes("High")) return "text-red-800 bg-red-50 border-red-200";
    if (caution.includes("Moderate")) return "text-amber-800 bg-amber-50 border-amber-200";
    return "text-emerald-800 bg-emerald-50 border-emerald-200";
  };

  return (
    <section
      id="section-advisory"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            06. Internal Briefing Note &amp; Citizen Advisory
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Dual-format communications: technical internal memo for officials alongside multilingual citizen advisories tailored by reading level and sensitive group care.
          </p>
        </div>

        {/* Format Switcher */}
        <div
          role="tablist"
          aria-label="Advisory output format"
          className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start lg:self-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeFormat === "citizen"}
            onClick={() => setActiveFormat("citizen")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeFormat === "citizen"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
            <span>Citizen Advisory</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeFormat === "internal"}
            onClick={() => setActiveFormat("internal")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeFormat === "internal"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
            <span>Internal Briefing Note</span>
          </button>
        </div>
      </div>

      {/* Controls & Export Toolbar */}
      <div className="py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        {activeFormat === "citizen" ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              <label htmlFor="adv-lang" className="text-xs font-medium text-slate-600">
                Language:
              </label>
              <select
                id="adv-lang"
                value={selectedLanguage}
                disabled={isLoading}
                onChange={(e) => {
                  const nextLang = e.target.value as AdvisoryLanguage;
                  setSelectedLanguage(nextLang);
                  onGenerateAdvisory(nextLang, selectedReadingLevel);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C] disabled:opacity-60"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="es">Español (Spanish)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
              <label htmlFor="adv-level" className="text-xs font-medium text-slate-600">
                Reading Level:
              </label>
              <select
                id="adv-level"
                value={selectedReadingLevel}
                disabled={isLoading}
                onChange={(e) => {
                  const nextLevel = e.target.value as AdvisoryReadingLevel;
                  setSelectedReadingLevel(nextLevel);
                  onGenerateAdvisory(selectedLanguage, nextLevel);
                }}
                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C] disabled:opacity-60"
              >
                <option value="Grade 5 (Plain Language)">Grade 5 (Plain Language)</option>
                <option value="Grade 8 (Standard)">Grade 8 (Standard)</option>
                <option value="Technical / Specialist">Technical / Specialist</option>
              </select>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-600">
            Official technical briefing note for city commissioners, ward engineers, and public health officers (English).
          </p>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {activeFormat === "citizen" && (
            <button
              type="button"
              onClick={handleApplyPreferences}
              disabled={isLoading}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Generating..." : "Update Advisory"}</span>
            </button>
          )}
          {advisory && (
            <button
              type="button"
              onClick={handleCopy}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition inline-flex items-center gap-1.5 whitespace-nowrap"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-[#0D6E5C]" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span>{copied ? "Copied" : "Copy Text"}</span>
            </button>
          )}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </button>
        </div>
      </div>

      {isLoading && !advisory ? (
        <div className="mt-5 space-y-4 animate-pulse">
          <div className="h-24 bg-slate-100 rounded-lg border border-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200" />
            <div className="h-32 bg-slate-100 rounded-lg border border-slate-200" />
          </div>
        </div>
      ) : !advisory ? (
        <div className="mt-5 p-8 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
          <p className="text-sm text-slate-600 mb-3">
            Generate tailored public health advisories and the internal technical briefing note.
          </p>
          <button
            type="button"
            onClick={handleApplyPreferences}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition disabled:opacity-50"
          >
            Generate Briefings
          </button>
        </div>
      ) : activeFormat === "citizen" ? (
        /* CITIZEN ADVISORY VIEW */
        <div role="tabpanel" aria-label="Citizen Advisory" className="mt-5 space-y-6">
          <div className="pb-5 border-b border-slate-200">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mb-2">
              <span className="font-semibold text-red-700">Public Air Quality Advisory</span>
              <span aria-hidden="true">·</span>
              <span>Language: {advisory.language.toUpperCase()}</span>
              <span aria-hidden="true">·</span>
              <span>{advisory.reading_level}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-950 tracking-tight">
              {advisory.citizen_advisory.headline}
            </h3>
            <p className="text-sm text-slate-700 mt-2 leading-relaxed max-w-4xl">
              {advisory.citizen_advisory.alert_summary}
            </p>
          </div>

          {/* Sensitive Group Dedicated Care Grid */}
          <div className="pb-5 border-b border-slate-200">
            <h4 className="text-xs font-semibold text-slate-500 tracking-wide mb-3">
              Guidance for Children, Older Adults &amp; Sensitive Groups
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advisory.citizen_advisory.sensitive_group_care.map((group, idx) => (
                <div
                  key={idx}
                  className="border border-slate-200 rounded-lg p-4 bg-slate-50/40"
                >
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-sm font-semibold text-slate-950">
                      {group.group_name}
                    </span>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap shrink-0 ${getCautionStyles(
                        group.caution_level
                      )}`}
                    >
                      {group.caution_level}
                    </span>
                  </div>
                  <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                    {group.recommendations.map((rec, rIdx) => (
                      <li key={rIdx} className="leading-relaxed">
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Do's and Don'ts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="flex items-center gap-1.5 text-[#0D6E5C] font-semibold text-xs mb-2.5">
                <Check className="w-4 h-4" />
                <span>Recommended Actions (Do&apos;s)</span>
              </div>
              <ul className="text-xs text-slate-700 space-y-2">
                {advisory.citizen_advisory.dos_and_donts.dos.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-[#0D6E5C] shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-center gap-1.5 text-red-700 font-semibold text-xs mb-2.5">
                <X className="w-4 h-4" />
                <span>Activities to Avoid (Don&apos;ts)</span>
              </div>
              <ul className="text-xs text-slate-700 space-y-2">
                {advisory.citizen_advisory.dos_and_donts.donts.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <X className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : (
        /* INTERNAL TECHNICAL BRIEFING NOTE */
        <div role="tabpanel" aria-label="Internal Briefing Note" className="mt-5 space-y-6">
          <div className="pb-5 border-b border-slate-200">
            <span className="text-xs font-semibold text-slate-500">
              Internal Technical Memorandum · {analysis.brief_title}
            </span>
            <p className="text-sm text-slate-900 mt-2 leading-relaxed max-w-4xl">
              {advisory.internal_briefing_note.executive_overview}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-5 border-b border-slate-200">
            <div>
              <h4 className="text-xs font-semibold text-red-700 mb-2">
                Statutory Standards &amp; Threshold Breaches
              </h4>
              <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside">
                {advisory.internal_briefing_note.statutory_threshold_breaches.map((item, i) => (
                  <li key={i} className="leading-relaxed">
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-semibold text-amber-700 mb-2">
                Sensor Network Integrity &amp; Telemetry Audit
              </h4>
              <p className="text-xs text-slate-700 leading-relaxed">
                {advisory.internal_briefing_note.sensor_network_integrity}
              </p>
              <div className="mt-2.5 text-xs font-mono tabular-nums text-slate-500">
                Monitored: {analysis.data_health.total_readings} stations ·{" "}
                {analysis.data_health.missing_or_corrupt_count} data gaps flagged
              </div>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold text-slate-500 mb-3">
              Cross-Departmental &amp; Inter-Agency Directives
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-700">
              {advisory.internal_briefing_note.inter_agency_action_items.map((item, i) => (
                <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <span className="font-semibold text-slate-950 block mb-1">
                    Directive {i + 1}
                  </span>
                  <span className="leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
