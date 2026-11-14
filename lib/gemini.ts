import { createHash } from "node:crypto";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AppHttpError } from "./validation";

/**
 * Returns an authenticated server-side GoogleGenAI client.
 * Reads GEMINI_API_KEY strictly from server environment variables.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new AppHttpError(
      "Missing GEMINI_API_KEY on the server. Please configure GEMINI_API_KEY in Settings > Secrets.",
      500
    );
  }

  return new GoogleGenAI({
    apiKey: apiKey.trim(),
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Cooldown tracker per model so rate-limited models immediately route to healthy fallbacks
const modelCooldownUntil = new Map<string, number>();

// Bounded LRU response cache + in-flight request coalescing
interface CacheEntry {
  expiresAt: number;
  value: unknown;
}
const MAX_CACHE_ENTRIES = 40;
const RESPONSE_CACHE_TTL_MS = 10 * 60 * 1000;
const responseCache = new Map<string, CacheEntry>();
const inflightRequests = new Map<string, Promise<unknown>>();

export function buildPromptCacheKey(
  model: string,
  systemInstruction: string,
  prompt: string
): string {
  return createHash("sha256")
    .update(`${model}::${systemInstruction}::${prompt}`)
    .digest("hex");
}

function getCachedResponse<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.value as T;
}

function setCachedResponse(key: string, value: unknown): void {
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (oldestKey) responseCache.delete(oldestKey);
  }
  responseCache.set(key, {
    expiresAt: Date.now() + RESPONSE_CACHE_TTL_MS,
    value,
  });
}

function isQuotaError(errMsg: string): boolean {
  return (
    errMsg.includes("429") ||
    errMsg.includes("RESOURCE_EXHAUSTED") ||
    errMsg.toLowerCase().includes("quota exceeded") ||
    errMsg.toLowerCase().includes("rate limit")
  );
}

function isTransientServerError(errMsg: string): boolean {
  return (
    errMsg.includes("503") ||
    errMsg.includes("500") ||
    errMsg.includes("high demand") ||
    errMsg.includes("Service Unavailable") ||
    errMsg.includes("ECONNRESET") ||
    errMsg.includes("ETIMEDOUT")
  );
}

/**
 * Executes a structured JSON prompt on Gemini with bounded LRU caching,
 * in-flight request coalescing, smart quota cooldowns, and cross-model resilience.
 */
export async function generateStructuredJson<T>(
  prompt: string,
  systemInstruction: string,
  preferredModel: string = "gemini-4-hydrogen"
): Promise<T> {
  const cacheKey = buildPromptCacheKey(preferredModel, systemInstruction, prompt);
  const cached = getCachedResponse<T>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const inflight = inflightRequests.get(cacheKey);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const execution = (async (): Promise<T> => {
    const ai = getGeminiClient();

    const candidatePool = [preferredModel, "gemini-3.1-flash-lite", "gemini-4-hydrogen"].filter(
      (val, idx, self) => self.indexOf(val) === idx
    );

    const now = Date.now();
    const activeCandidates = candidatePool.filter(
      (m) => (modelCooldownUntil.get(m) ?? 0) <= now
    );
    const modelsToTry =
      activeCandidates.length > 0
        ? activeCandidates
        : ["gemini-3.1-flash-lite", "gemini-4-hydrogen"];

    let lastError: unknown = null;
    let sawQuotaExhaustion = false;

    for (const currentModel of modelsToTry) {
      const maxAttempts = 2;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          const response = await ai.models.generateContent({
            model: currentModel,
            contents: prompt,
            config: {
              systemInstruction,
              responseMimeType: "application/json",
              ...(currentModel === "gemini-4-hydrogen"
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
            },
          });

          const text = (response.text ?? "").trim();
          if (!text) {
            throw new Error(`Empty response returned by ${currentModel}`);
          }

          let parsed: T;
          try {
            parsed = JSON.parse(text) as T;
          } catch {
            const cleaned = text
              .replace(/^```json\s*/i, "")
              .replace(/^```\s*/i, "")
              .replace(/```$/i, "")
              .trim();
            parsed = JSON.parse(cleaned) as T;
          }

          setCachedResponse(cacheKey, parsed);
          return parsed;
        } catch (err: unknown) {
          lastError = err;
          const errMsg = err instanceof Error ? err.message : String(err);

          if (isQuotaError(errMsg)) {
            sawQuotaExhaustion = true;
            modelCooldownUntil.set(currentModel, Date.now() + 45_000);
            break;
          }

          if (isTransientServerError(errMsg) && attempt < maxAttempts) {
            await sleep(1000);
            continue;
          }

          break;
        }
      }
    }

    if (sawQuotaExhaustion) {
      throw new AppHttpError(
        "Gemini API rate limit reached across active models. Please wait ~35 seconds and retry, or enable billing in Settings > Secrets for higher RPM.",
        429
      );
    }

    throw lastError || new AppHttpError("Failed to generate content after model fallbacks.", 502);
  })();

  inflightRequests.set(cacheKey, execution);
  try {
    return await execution;
  } finally {
    inflightRequests.delete(cacheKey);
  }
}
