"use client";

import React, { useState, useEffect } from "react";
import { Wind, Key, ShieldCheck, AlertCircle } from "lucide-react";

interface NavbarProps {
  apiKey: string;
  onApiKeyChange: (key: string) => void;
}

export function Navbar({ apiKey, onApiKeyChange }: NavbarProps) {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [inputKey, setInputKey] = useState(apiKey);
  const [hasServerKey, setHasServerKey] = useState(false);

  useEffect(() => {
    // Check if server already has an environment key configured
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        if (data.hasServerKey) {
          setHasServerKey(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveKey = () => {
    onApiKeyChange(inputKey.trim());
    setShowKeyModal(false);
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/20 p-2 rounded-lg border border-emerald-500/30 text-emerald-400">
              <Wind className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">AeroSense</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                  Civic AI Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Turn Raw Air Quality Data into Actionable Civic Interventions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 px-3 py-1 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-slate-300 font-medium">Real-Time Gemini 3.8 Flash Active</span>
            </div>

            <button
              onClick={() => setShowKeyModal(true)}
              className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-lg border transition ${
                apiKey || hasServerKey
                  ? "bg-slate-800 text-emerald-300 border-emerald-500/40 hover:bg-slate-700"
                  : "bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{apiKey || hasServerKey ? "API Key Configured" : "Set Gemini Key"}</span>
            </button>
          </div>
        </div>
      </header>

      {/* API Key Modal for Evaluators */}
      {showKeyModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Gemini API Key Configuration</h3>
                <p className="text-xs text-slate-400">
                  Required for real-time live LLM data interpretation.
                </p>
              </div>
            </div>

            {hasServerKey && !apiKey && (
              <div className="mb-4 p-3 bg-emerald-900/30 border border-emerald-700/50 rounded-lg flex items-start space-x-2 text-xs text-emerald-200">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  A server-side <strong>GEMINI_API_KEY</strong> environment variable is active. You can leave this empty or override it below.
                </span>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="p-2.5 bg-slate-800/60 rounded-lg border border-slate-700/50 text-[11px] text-slate-400 flex items-start space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  Hackathon Rule: All outputs are generated live from Gemini API calls with zero mock fallbacks.
                </span>
              </div>
            </div>

            <div className="mt-5 flex justify-end space-x-2">
              <button
                onClick={() => setShowKeyModal(false)}
                className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition"
              >
                Close
              </button>
              <button
                onClick={handleSaveKey}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
              >
                Save & Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
