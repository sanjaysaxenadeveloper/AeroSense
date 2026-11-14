# AeroSense — Civic Air Quality Briefing Studio

> **Built for the PromptWars: Build with AI Challenge**
> *Turning raw, messy air quality monitoring tables into traceable, role-tailored local interventions and multilingual citizen advisories.*

---

## Executive Overview & Problem Statement

Civic environmental teams, housing societies, and schools receive air quality logs in inconsistent formats—mixed CSV/TSV exports, Markdown tables, JSON arrays, mismatched units (`mg/m³` vs `µg/m³`), sensor dropouts (`NA`, `ERR`, `-999`), and uncalibrated spikes. **AeroSense** solves this end-to-end by pairing deterministic telemetry preprocessing with **Google Gemini** structured synthesis. Every hotspot, trend, and action is bound to its source `[ROW_XXX]` record with unreliable readings explicitly flagged.

---

## GenAI Services & Where They Are Used

AeroSense invokes the official **`@google/genai`** TypeScript SDK strictly on the server (`GEMINI_API_KEY` via `process.env`, zero client-side key exposure) using **`gemini-4-hydrogen`** (with **`gemini-3.1-flash-lite`** automatic resilience fallback):

| Stage | API Route | GenAI Role & Structured Output |
| :--- | :--- | :--- |
| **1. Normalization, Integrity Audit & Hotspot Detection** | `POST /api/analyze` | Interprets messy CSV/TSV/Markdown/JSON or unstructured text, normalizes units (`mg/m³` → `µg/m³`), flags gaps/outliers, summarizes trends in plain language, and binds every finding to validated `[ROW_XXX]` citations. |
| **2. Role-Tailored Action Engine** | `POST /api/recommendations` | Synthesizes jurisdiction-matched, urgency-ranked (`IMMEDIATE`, `24-HOUR`, `PLANNED`) interventions for **Ward Officers**, **Housing Societies**, and **School Principals**, with interactive operational Q&A. |
| **3. Brief-to-Brief Delta Comparison** | `POST /api/compare` | Computes station-by-station numeric PM2.5 deltas and evaluates resolved, newly emerged, and persistent chronic hotspots plus intervention efficacy. |
| **4. Dual-Audience Multilingual Communications** | `POST /api/advisory` | Generates an English **Internal Technical Briefing Note** alongside a **Citizen Advisory** in **English, Hindi (हिंदी), Marathi (मराठी), Bengali (বাংলা), Tamil (தமிழ்), or Spanish (Español)** across **3 reading levels** (`Grade 5 Plain Language`, `Grade 8`, `Technical`), with dedicated protocols for children, older adults, outdoor workers, and sensitive groups. |
| **5. Live Public Dataset Connector** | `GET/POST /api/dataset` | Streams real CPCB India air quality station records from Hugging Face [`AdityaaXD/AQI-Of-India`](https://huggingface.co/datasets/AdityaaXD/AQI-Of-India) (`stations.csv` + `station_day.csv`) or any public `https://` dataset URL with SSRF protection. |

---

## Key Capabilities

1. **Zero Hardcoded Data**: Load real monitoring snapshots directly from Hugging Face (`AdityaaXD/AQI-Of-India`), fetch public `https://` CSV/JSON URLs (protected by DNS-rebinding SSRF validation and streaming byte caps), upload local files (`.csv`, `.tsv`, `.txt`, `.json`, `.md`), or paste unstructured sensor logs.
2. **Traceable Row Audit & Formula-Safe CSV Export (`[ROW_XXX]`)**: Deterministic preprocessing detects missing/corrupt readings (`NA`, `ERR`, `-999`, blanks), negative voltages, duplicates, and extreme outliers (`>900 µg/m³`), displays secondary `NO₂`/`SO₂` telemetry, and lets officers export cleaned telemetry CSV with CWE-1236 formula-injection protection.
3. **Role-Specific Action Matrices**: Separate remits for Municipal Ward Officers (road sweeping, anti-smog guns, construction halts), Housing Societies (DG set limits, window schedules, clean air rooms), and School Principals (outdoor sports suspension, indoor HEPA/PE, bus idling curbs).
4. **Brief-to-Brief Trajectory Comparison**: Compare consecutive monitoring runs, upload a prior baseline file, or pull an earlier Hugging Face date (e.g., Delhi `2019-11-03` vs `2019-11-06`) right inside Section 05.
5. **Accessible, Print-Ready Briefings**: WCAG 2.1 AA contrast, sequential heading hierarchy, keyboard-navigable ARIA tablists and file inputs, readability telemetry, clipboard copy, and clean `@media print` layouts.

---

## Local Setup & Verification

### Prerequisites
- Node.js 22+
- `GEMINI_API_KEY` from Google AI Studio configured in environment secrets (`.env.example` documents required variables)

### Run & Verify
```bash
npm install
npm run lint     # ESLint checks across app, lib, components, and tests
npm test         # 22 unit, SSRF/DNS-rebinding, CWE-1236, and validation tests across 6 suites
npm run build    # Production Next.js build verification
npm run dev      # Starts dev server on http://localhost:3000
```