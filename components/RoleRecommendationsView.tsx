"use client";

import React, { useState } from "react";
import { Shield, Home, GraduationCap, Clock, Target, ArrowRight } from "lucide-react";
import { RoleRecommendations, RoleAction } from "@/lib/types";

interface RoleRecommendationsProps {
  recommendations: RoleRecommendations | null;
  isLoading: boolean;
  onGenerate: () => void;
  onSelectRowCitation: (rowId: string) => void;
}

export function RoleRecommendationsView({
  recommendations,
  isLoading,
  onGenerate,
  onSelectRowCitation,
}: RoleRecommendationsProps) {
  const [activeTab, setActiveTab] = useState<"ward" | "housing" | "school">("ward");

  const getUrgencyBadge = (urgency: string) => {
    if (urgency.includes("IMMEDIATE")) {
      return "bg-red-500/20 text-red-300 border-red-500/50";
    }
    if (urgency.includes("24-HOUR")) {
      return "bg-amber-500/20 text-amber-300 border-amber-500/50";
    }
    return "bg-blue-500/20 text-blue-300 border-blue-500/50";
  };

  const currentActions: RoleAction[] = recommendations
    ? activeTab === "ward"
      ? recommendations.ward_officer
      : activeTab === "housing"
      ? recommendations.housing_society
      : recommendations.school_principal
    : [];

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-slate-800 gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
              4
            </span>
            <h2 className="text-lg font-semibold text-white tracking-tight">
              Role-Based Action Recommendations
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Prioritized local interventions custom-tailored to the operational jurisdiction of each stakeholder.
          </p>
        </div>

        {recommendations && (
          <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800">
            <button
              onClick={() => setActiveTab("ward")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "ward"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Ward Officer</span>
            </button>
            <button
              onClick={() => setActiveTab("housing")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "housing"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Home className="w-3.5 h-3.5" />
              <span>Housing Society</span>
            </button>
            <button
              onClick={() => setActiveTab("school")}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                activeTab === "school"
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>School Principal</span>
            </button>
          </div>
        )}
      </div>

      {!recommendations ? (
        <div className="mt-6 text-center py-8 bg-slate-950/60 rounded-xl border border-slate-800">
          <p className="text-xs text-slate-400 mb-3">
            Generate role-specific action plans mapped to the latest air quality readings.
          </p>
          <button
            onClick={onGenerate}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition disabled:opacity-50"
          >
            {isLoading ? "Synthesizing Interventions..." : "Generate Role-Based Interventions"}
          </button>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
            <span className="text-slate-300 font-medium">
              Active Persona:{" "}
              <strong className="text-emerald-400">
                {activeTab === "ward"
                  ? "Municipal Ward Officer (Enforcement & Infrastructure)"
                  : activeTab === "housing"
                  ? "Resident Welfare Association (Community Regulations)"
                  : "School Principal (Pediatric Safety & Facility Controls)"}
              </strong>
            </span>
            <span className="text-[11px] text-slate-400">{currentActions.length} Action Directives</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentActions.map((action, i) => (
              <div
                key={action.id || i}
                className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-sm font-semibold text-white">{action.action_title}</h4>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-bold uppercase whitespace-nowrap ${getUrgencyBadge(
                        action.urgency
                      )}`}
                    >
                      {action.urgency}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-3">{action.description}</p>

                  <div className="space-y-1.5 text-[11px]">
                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Target className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-slate-300">Target Zone:</strong> {action.target_location}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 text-slate-400">
                      <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>
                        <strong className="text-slate-300">Expected Impact:</strong> {action.expected_impact}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 italic">Triggered by: {action.triggered_by_hotspot}</span>
                  {action.evidence_rows && action.evidence_rows.length > 0 && (
                    <div className="flex items-center space-x-1">
                      {action.evidence_rows.map((rowId) => (
                        <button
                          key={rowId}
                          onClick={() => onSelectRowCitation(rowId)}
                          className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700 hover:bg-slate-700 transition flex items-center space-x-0.5"
                        >
                          <span>{rowId}</span>
                          <ArrowRight className="w-2.5 h-2.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
