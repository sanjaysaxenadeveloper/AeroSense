"use client";

import React from "react";

interface NavbarProps {
  hasAnalysis: boolean;
  onReset: () => void;
}

export function Navbar({ hasAnalysis, onReset }: NavbarProps) {
  const handleFocusIngestion = () => {
    const el = document.getElementById("raw-data-textarea");
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  };

  return (
    <header className="bg-white/95 backdrop-blur border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line brand wordmark */}
        <a
          href="#top"
          className="text-lg font-bold tracking-tight text-slate-950 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded"
        >
          AeroSense
        </a>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#section-ingestion"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Ingestion
          </a>
          <a
            href="#section-audit"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Audit Table
          </a>
          <a
            href="#section-hotspots"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Hotspots
          </a>
          <a
            href="#section-roles"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Role Actions
          </a>
          <a
            href="#section-compare"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Compare
          </a>
          <a
            href="#section-advisory"
            className="hover:text-slate-950 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] rounded transition-colors whitespace-nowrap shrink-0"
          >
            Advisories
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {hasAnalysis ? (
            <button
              type="button"
              onClick={onReset}
              className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] transition-colors whitespace-nowrap shrink-0"
            >
              New Briefing
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFocusIngestion}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0D6E5C] hover:bg-[#095446] rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D6E5C] focus-visible:ring-offset-2 transition-colors whitespace-nowrap shrink-0"
            >
              Paste or Upload Data
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
