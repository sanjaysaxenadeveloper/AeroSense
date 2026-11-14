"use client";

import React, { useState, useEffect, useRef } from "react";
import { Navbar } from "@/components/Navbar";
import { DataIngestionSection } from "@/components/DataIngestionSection";
import { DataAuditGrid } from "@/components/DataAuditGrid";
import { HotspotExplorer } from "@/components/HotspotExplorer";
import { RoleRecommendationsView } from "@/components/RoleRecommendationsView";
import { BriefComparisonView } from "@/components/BriefComparisonView";
import { MultiFormatAdvisoryView } from "@/components/MultiFormatAdvisoryView";
import {
  fetchBriefAnalysis,
  fetchBriefComparison,
  fetchDualAdvisory,
  fetchHfDatasetCsv,
  fetchRoleRecommendations,
  loadSavedBriefsFromStorage,
  saveBriefsToStorage,
} from "@/lib/briefing-client";
import type {
  AnalysisResult,
  RoleRecommendations,
  BriefComparisonResult,
  DualAudienceAdvisory,
  AdvisoryLanguage,
  AdvisoryReadingLevel,
} from "@/lib/types";
import { AlertCircle, CheckCircle2, Circle } from "lucide-react";

export default function Home() {
  const [currentAnalysis, setCurrentAnalysis] = useState<AnalysisResult | null>(null);
  const [previousBriefs, setPreviousBriefs] = useState<AnalysisResult[]>([]);
  const [selectedPreviousId, setSelectedPreviousId] = useState("");
  const [highlightedRowId, setHighlightedRowId] = useState<string | null>(null);

  // Feature states
  const [roleRecommendations, setRoleRecommendations] = useState<RoleRecommendations | null>(null);
  const [comparisonResult, setComparisonResult] = useState<BriefComparisonResult | null>(null);
  const [advisory, setAdvisory] = useState<DualAudienceAdvisory | null>(null);

  // Loading states
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGeneratingRoles, setIsGeneratingRoles] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  const [isGeneratingAdvisory, setIsGeneratingAdvisory] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  // Client-side response caches to eliminate redundant repeat API/Gemini calls
  const rolesCacheRef = useRef<Map<string, RoleRecommendations>>(new Map());
  const advisoryCacheRef = useRef<Map<string, DualAudienceAdvisory>>(new Map());
  const compareCacheRef = useRef<Map<string, BriefComparisonResult>>(new Map());

  // Restore saved compact briefs on client mount
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = loadSavedBriefsFromStorage();
      if (saved.length > 0) {
        setPreviousBriefs(saved);
        setSelectedPreviousId(saved[0].id);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // 1. Core Ingestion & Analysis Call
  const handleAnalyze = async (rawText: string, briefTitle: string) => {
    setIsAnalyzing(true);
    setErrorMessage(null);
    setStatusMessage("Normalizing sensor data and generating air quality brief.");
    setHighlightedRowId(null);
    setRoleRecommendations(null);
    setComparisonResult(null);
    setAdvisory(null);
    rolesCacheRef.current.clear();
    advisoryCacheRef.current.clear();
    compareCacheRef.current.clear();

    try {
      const data = await fetchBriefAnalysis(rawText, briefTitle);

      let baselinePrevious: AnalysisResult | null =
        previousBriefs.find((b) => b.id === selectedPreviousId) || previousBriefs[0] || null;

      if (currentAnalysis) {
        const updatedPrevious = [
          currentAnalysis,
          ...previousBriefs.filter((b) => b.id !== currentAnalysis.id),
        ];
        setPreviousBriefs(updatedPrevious);
        setSelectedPreviousId(currentAnalysis.id);
        baselinePrevious = currentAnalysis;
        saveBriefsToStorage(updatedPrevious);
      }

      setCurrentAnalysis(data);
      setStatusMessage(`Brief ready for ${data.brief_title}.`);

      void autoGenerateFollowups(data, baselinePrevious);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const autoGenerateFollowups = async (
    analysis: AnalysisResult,
    baselinePrevious: AnalysisResult | null
  ) => {
    const tasks: Promise<void>[] = [
      handleGenerateRoleRecommendations(undefined, analysis),
      handleGenerateAdvisory("en", "Grade 5 (Plain Language)", analysis),
    ];
    if (baselinePrevious) {
      tasks.push(handleRunComparison(analysis, baselinePrevious));
    }
    await Promise.allSettled(tasks);
  };

  // 2. Role Recommendations Call (with client-side cache)
  const handleGenerateRoleRecommendations = async (
    focusQuestion?: string,
    overrideAnalysis?: AnalysisResult
  ) => {
    const target = overrideAnalysis || currentAnalysis;
    if (!target) return;

    const normalizedQuestion = focusQuestion?.trim() || "";
    const cacheKey = `${target.id}:${normalizedQuestion || "__default__"}`;
    const cached = rolesCacheRef.current.get(cacheKey);
    if (cached) {
      setRoleRecommendations(cached);
      setStatusMessage("Loaded cached stakeholder actions.");
      return;
    }

    setIsGeneratingRoles(true);
    setStatusMessage("Generating role-tailored recommendations.");
    try {
      const data = await fetchRoleRecommendations(target, normalizedQuestion || undefined);
      rolesCacheRef.current.set(cacheKey, data);
      setRoleRecommendations(data);
      setStatusMessage("Role-tailored action plans ready.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate role recommendations.";
      setErrorMessage(msg);
    } finally {
      setIsGeneratingRoles(false);
    }
  };

  // 3. Brief Comparison Call (with client-side cache)
  const handleRunComparison = async (
    overrideCurrent?: AnalysisResult,
    overridePrevious?: AnalysisResult
  ) => {
    const curr = overrideCurrent || currentAnalysis;
    const prev = overridePrevious || previousBriefs.find((b) => b.id === selectedPreviousId);
    if (!curr || !prev) return;

    const cacheKey = `${curr.id}:${prev.id}`;
    const cached = compareCacheRef.current.get(cacheKey);
    if (cached) {
      setComparisonResult(cached);
      setStatusMessage("Loaded cached brief comparison.");
      return;
    }

    setIsComparing(true);
    setStatusMessage("Comparing current brief against baseline.");
    try {
      const data = await fetchBriefComparison(curr, prev);
      compareCacheRef.current.set(cacheKey, data);
      setComparisonResult(data);
      setStatusMessage("Brief comparison complete.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to compare briefs.";
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
    }
  };

  const handleUploadBaselineAndCompare = async (rawText: string, briefTitle: string) => {
    if (!currentAnalysis) return;
    setIsComparing(true);
    setErrorMessage(null);
    try {
      const baselineBrief = await fetchBriefAnalysis(rawText, briefTitle);
      const updatedPrevious = [baselineBrief, ...previousBriefs];
      setPreviousBriefs(updatedPrevious);
      setSelectedPreviousId(baselineBrief.id);
      saveBriefsToStorage(updatedPrevious);

      await handleRunComparison(currentAnalysis, baselineBrief);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to compare with baseline file.";
      setErrorMessage(msg);
    } finally {
      setIsComparing(false);
    }
  };

  const handleFetchHfBaselineAndCompare = async (city: string, date: string) => {
    if (!currentAnalysis) return;
    setIsComparing(true);
    setErrorMessage(null);
    try {
      const dsData = await fetchHfDatasetCsv(city, date, 30);
      await handleUploadBaselineAndCompare(dsData.csvText, dsData.title);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch Hugging Face baseline.";
      setErrorMessage(msg);
      setIsComparing(false);
    }
  };

  // 4. Advisory Generation Call (with client-side cache per language + reading level)
  const handleGenerateAdvisory = async (
    language: AdvisoryLanguage = "en",
    readingLevel: AdvisoryReadingLevel = "Grade 5 (Plain Language)",
    overrideAnalysis?: AnalysisResult
  ) => {
    const target = overrideAnalysis || currentAnalysis;
    if (!target) return;

    const cacheKey = `${target.id}:${language}:${readingLevel}`;
    const cached = advisoryCacheRef.current.get(cacheKey);
    if (cached) {
      setAdvisory(cached);
      setStatusMessage(`Loaded cached ${language.toUpperCase()} advisory at ${readingLevel}.`);
      return;
    }

    setIsGeneratingAdvisory(true);
    setStatusMessage(`Generating ${language.toUpperCase()} citizen advisory and internal note.`);
    try {
      const data = await fetchDualAdvisory(target, language, readingLevel);
      advisoryCacheRef.current.set(cacheKey, data);
      setAdvisory(data);
      setStatusMessage("Citizen advisory and internal briefing note ready.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to generate advisory.";
      setErrorMessage(msg);
    } finally {
      setIsGeneratingAdvisory(false);
    }
  };

  const handleSelectRowCitation = (rowId: string) => {
    setHighlightedRowId(rowId);
    const element = document.getElementById(`table-row-${rowId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      document.getElementById("section-audit")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleReset = () => {
    setCurrentAnalysis(null);
    setRoleRecommendations(null);
    setComparisonResult(null);
    setAdvisory(null);
    setHighlightedRowId(null);
    setErrorMessage(null);
    setStatusMessage("Workspace reset for a new briefing.");
    rolesCacheRef.current.clear();
    advisoryCacheRef.current.clear();
    compareCacheRef.current.clear();
  };

  const workflowSteps = [
    { id: "section-ingestion", label: "01. Ingestion", done: Boolean(currentAnalysis) },
    { id: "section-audit", label: "02. Row Audit", done: Boolean(currentAnalysis) },
    { id: "section-hotspots", label: "03. Hotspots", done: Boolean(currentAnalysis) },
    { id: "section-roles", label: "04. Role Actions", done: Boolean(roleRecommendations) },
    { id: "section-compare", label: "05. Brief Delta", done: Boolean(comparisonResult) },
    { id: "section-advisory", label: "06. Advisories", done: Boolean(advisory) },
  ];

  return (
    <div id="top" className="min-h-screen bg-[#F7F8FA] flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-[#0D6E5C] focus:text-white focus:rounded-lg focus:text-xs focus:font-semibold"
      >
        Skip to main content
      </a>
      <Navbar hasAnalysis={Boolean(currentAnalysis)} onReset={handleReset} />

      <div className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col lg:flex-row gap-8">
        {/* Left Workspace Rail (Desktop 256px) - uses landmark labels without pre-h1 headings */}
        <aside aria-label="Briefing workflow and saved history" className="lg:w-64 shrink-0 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 lg:sticky lg:top-24 space-y-6">
            <div>
              <p id="workflow-nav-heading" className="text-xs font-semibold text-slate-600 tracking-wide mb-3">
                Briefing Workflow
              </p>
              <nav aria-labelledby="workflow-nav-heading" className="space-y-1">
                {workflowSteps.map((step) => (
                  <a
                    key={step.id}
                    href={`#${step.id}`}
                    className="flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition-colors"
                  >
                    <span>{step.label}</span>
                    {step.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#0D6E5C] shrink-0" aria-hidden="true" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />
                    )}
                  </a>
                ))}
              </nav>
            </div>

            {previousBriefs.length > 0 && (
              <div className="pt-5 border-t border-slate-200">
                <p id="saved-briefs-heading" className="text-xs font-semibold text-slate-600 tracking-wide mb-2">
                  Saved Brief History ({previousBriefs.length})
                </p>
                <ul aria-labelledby="saved-briefs-heading" className="space-y-2 text-xs">
                  {previousBriefs.slice(0, 4).map((b) => (
                    <li key={b.id} className="text-slate-700 truncate">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreviousId(b.id);
                          document.getElementById("section-compare")?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="text-left hover:text-[#0D6E5C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors truncate w-full"
                        title={b.brief_title}
                      >
                        {b.brief_title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-5 border-t border-slate-200 text-xs text-slate-600 space-y-1.5">
              <p className="font-semibold text-slate-800">Target Stakeholders</p>
              <p>Ward Officers · Housing Societies · School Principals · Public Health</p>
            </div>
          </div>
        </aside>

        {/* Main Editorial Content Viewport */}
        <main id="main-content" className="flex-1 min-w-0 space-y-6">
          <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </div>

          <div className="pb-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight text-balance">
              Civic Air Quality Briefing Studio
            </h1>
            <p className="text-sm sm:text-base text-slate-600 mt-1.5 max-w-3xl">
              Turn messy ward-level air quality tables into traceable hotspot reports, role-specific interventions, brief-to-brief comparisons, and multilingual citizen advisories.
            </p>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-3"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold text-red-950">Analysis Request Error</p>
                <p className="mt-0.5 text-red-800">{errorMessage}</p>
              </div>
            </div>
          )}

          <DataIngestionSection onAnalyze={handleAnalyze} isLoading={isAnalyzing} />

          {currentAnalysis && (
            <>
              <DataAuditGrid
                rows={currentAnalysis.indexed_rows}
                audit={currentAnalysis.data_health}
                dataHealthSummary={currentAnalysis.data_health_summary}
                highlightedRowId={highlightedRowId}
              />

              <HotspotExplorer
                summary={currentAnalysis.summary}
                overallCategory={currentAnalysis.overall_aqi_category}
                hotspots={currentAnalysis.hotspots}
                trends={currentAnalysis.general_trends}
                onSelectRowCitation={handleSelectRowCitation}
              />

              <RoleRecommendationsView
                recommendations={roleRecommendations}
                isLoading={isGeneratingRoles}
                onGenerate={(q) => handleGenerateRoleRecommendations(q)}
                onSelectRowCitation={handleSelectRowCitation}
              />

              <BriefComparisonView
                currentBrief={currentAnalysis}
                previousBriefs={previousBriefs}
                selectedPreviousId={selectedPreviousId}
                onSelectPreviousId={setSelectedPreviousId}
                comparisonResult={comparisonResult}
                isLoading={isComparing}
                onRunComparison={() => handleRunComparison()}
                onUploadBaselineAndCompare={handleUploadBaselineAndCompare}
                onFetchHfBaselineAndCompare={handleFetchHfBaselineAndCompare}
              />

              <MultiFormatAdvisoryView
                analysis={currentAnalysis}
                advisory={advisory}
                isLoading={isGeneratingAdvisory}
                onGenerateAdvisory={handleGenerateAdvisory}
              />
            </>
          )}

          <footer className="pt-6 pb-4 border-t border-slate-200 text-xs text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>AeroSense Civic Air Quality Briefing Studio</span>
            <span>Powered by Google Gemini structured analysis · Server-side API execution</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
