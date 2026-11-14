"use client";

import React, { useState } from "react";
import {
  Shield,
  Home,
  GraduationCap,
  ArrowUpRight,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { RoleRecommendations, RoleAction } from "@/lib/types";

interface RoleRecommendationsProps {
  recommendations: RoleRecommendations | null;
  isLoading: boolean;
  onGenerate: (focusQuestion?: string) => void;
  onSelectRowCitation: (rowId: string) => void;
}

export function RoleRecommendationsView({
  recommendations,
  isLoading,
  onGenerate,
  onSelectRowCitation,
}: RoleRecommendationsProps) {
  const [activeTab, setActiveTab] = useState<"ward" | "housing" | "school">("ward");
  const [focusQuestion, setFocusQuestion] = useState("");

  const getUrgencyStyles = (urgency: string) => {
    if (urgency.includes("IMMEDIATE")) {
      return "text-red-800 bg-red-50 border-red-200";
    }
    if (urgency.includes("24-HOUR")) {
      return "text-amber-800 bg-amber-50 border-amber-200";
    }
    return "text-sky-800 bg-sky-50 border-sky-200";
  };

  const currentActions: RoleAction[] = recommendations
    ? activeTab === "ward"
      ? recommendations.ward_officer || []
      : activeTab === "housing"
      ? recommendations.housing_society || []
      : recommendations.school_principal || []
    : [];

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onGenerate(focusQuestion.trim() || undefined);
  };

  return (
    <section
      id="section-roles"
      className="bg-white border border-slate-200 rounded-xl p-6 sm:p-7"
    >
      <div className="flex flex-col lg:flex-row lg:items-end justify-between pb-5 border-b border-slate-200 gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-950 tracking-tight">
            04. Role-Tailored Local Actions
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Prioritized interventions matched to the authority of who is asking: Ward Officer, Housing Society, or School Principal.
          </p>
        </div>

        {/* Segmented Persona Switcher */}
        <div
          role="tablist"
          aria-label="Stakeholder persona actions"
          className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-lg self-start lg:self-auto shrink-0"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "ward"}
            onClick={() => setActiveTab("ward")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "ward"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
            <span>Ward Officer</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "housing"}
            onClick={() => setActiveTab("housing")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "housing"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <Home className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
            <span>Housing Society</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "school"}
            onClick={() => setActiveTab("school")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              activeTab === "school"
                ? "bg-white text-slate-950 shadow-sm"
                : "text-slate-600 hover:text-slate-950"
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5 text-[#0D6E5C]" aria-hidden="true" />
            <span>School Principal</span>
          </button>
        </div>
      </div>

      {isLoading && !recommendations ? (
        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-36 bg-slate-100 rounded-lg border border-slate-200" />
          ))}
        </div>
      ) : !recommendations ? (
        <div className="mt-5 py-8 text-center border border-dashed border-slate-300 rounded-lg bg-slate-50/50">
          <p className="text-sm text-slate-600 mb-3">
            Generate prioritized action plans tailored to each stakeholder&apos;s jurisdiction.
          </p>
          <button
            type="button"
            onClick={() => onGenerate()}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#0D6E5C] hover:bg-[#095446] text-white transition disabled:opacity-50"
          >
            Generate Role-Based Actions
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          {/* Interactive Stakeholder Question Bar */}
          <form
            onSubmit={handleAskSubmit}
            className="flex flex-col sm:flex-row gap-2.5 pb-5 border-b border-slate-200"
          >
            <div className="relative flex-1">
              <MessageSquare className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" aria-hidden="true" />
              <input
                type="text"
                value={focusQuestion}
                onChange={(e) => setFocusQuestion(e.target.value)}
                aria-label="Ask a specific operational question for stakeholders"
                placeholder="Ask a specific question for these roles (e.g., 'Should we pause morning assembly or restrict DG backups?')"
                className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#0D6E5C]/20 focus:border-[#0D6E5C]"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>{isLoading ? "Updating..." : "Tailor Actions"}</span>
            </button>
          </form>

          {/* Active Persona Descriptor */}
          <div role="tabpanel" aria-label="Role actions list" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
            <span>
              Viewing remit for{" "}
              <strong className="text-slate-950 font-semibold">
                {activeTab === "ward"
                  ? "Municipal Ward Officer (Enforcement & Public Works)"
                  : activeTab === "housing"
                  ? "Housing Society / RWA (Community & Facility Controls)"
                  : "School Principal (Pediatric Health & Campus Operations)"}
              </strong>
            </span>
            <span className="font-mono tabular-nums text-slate-500">
              {currentActions.length} prioritized actions
            </span>
          </div>

          {/* Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentActions.map((action, i) => (
              <div
                key={action.id || i}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between bg-slate-50/40 hover:bg-white transition-colors"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <h4 className="text-sm font-semibold text-slate-950">{action.action_title}</h4>
                    <span
                      className={`text-[11px] px-2 py-0.5 rounded border font-semibold whitespace-nowrap shrink-0 ${getUrgencyStyles(
                        action.urgency
                      )}`}
                    >
                      {action.urgency}
                    </span>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed mb-3">
                    {action.description}
                  </p>

                  <div className="space-y-1 text-xs text-slate-600">
                    <div>
                      <strong className="font-semibold text-slate-800">Target zone:</strong>{" "}
                      {action.target_location}
                    </div>
                    <div>
                      <strong className="font-semibold text-slate-800">Expected impact:</strong>{" "}
                      {action.expected_impact}
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">
                    Trigger: {action.triggered_by_hotspot}
                  </span>
                  {action.evidence_rows && action.evidence_rows.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap justify-end">
                      {action.evidence_rows.map((rowId) => (
                        <button
                          key={rowId}
                          type="button"
                          onClick={() => onSelectRowCitation(rowId)}
                          className="font-mono text-[11px] px-2 py-0.5 rounded bg-white hover:bg-teal-50 text-slate-800 hover:text-[#0D6E5C] border border-slate-300 hover:border-[#0D6E5C] transition inline-flex items-center gap-0.5 tabular-nums"
                        >
                          <span>{rowId}</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          </div>
        </div>
      )}
    </section>
  );
}
