import { GoogleGenAI, ThinkingLevel } from "@google/genai";

/**
 * Returns an authenticated server-side GoogleGenAI client.
 * Reads GEMINI_API_KEY strictly from server environment variables.
 */
export function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "Missing GEMINI_API_KEY on the server. Please configure GEMINI_API_KEY in Settings > Secrets."
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
 * Executes a structured JSON prompt on Gemini with smart quota cooldowns,
 * minimal transient retry, and cross-model resilience across Gemini 4 / 3.1.
 */
export async function generateStructuredJson<T>(
  prompt: string,
  systemInstruction: string,
  preferredModel: string = "gemini-4-hydrogen"
): Promise<T> {
  const ai = getGeminiClient();

  const candidatePool = [preferredModel, "gemini-3.1-flash-lite", "gemini-4-hydrogen"].filter(
    (val, idx, self) => self.indexOf(val) === idx
  );

  const now = Date.now();
  const activeCandidates = candidatePool.filter(
    (m) => (modelCooldownUntil.get(m) ?? 0) <= now
  );
  // If all models are currently in cooldown, try the highest-throughput lite model first
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

        try {
          return JSON.parse(text) as T;
        } catch {
          const cleaned = text
            .replace(/^```json\s*/i, "")
            .replace(/^```\s*/i, "")
            .replace(/```$/i, "")
            .trim();
          return JSON.parse(cleaned) as T;
        }
      } catch (err: unknown) {
        lastError = err;
        const errMsg = err instanceof Error ? err.message : String(err);

        // On 429 quota exhaustion, put this model in a 45s cooldown and immediately fall back
        if (isQuotaError(errMsg)) {
          sawQuotaExhaustion = true;
          modelCooldownUntil.set(currentModel, Date.now() + 45_000);
          break;
        }

        // Only retry brief server/network hiccups once before switching candidate
        if (isTransientServerError(errMsg) && attempt < maxAttempts) {
          await sleep(1000);
          continue;
        }

        break;
      }
    }
  }

  if (sawQuotaExhaustion) {
    const rateLimitError = new Error(
      "Gemini API rate limit reached across active models. Please wait ~35 seconds and retry, or enable billing in Settings > Secrets for higher RPM."
    ) as Error & { status?: number };
    rateLimitError.status = 429;
    throw rateLimitError;
  }

  throw lastError || new Error("Failed to generate content after model fallbacks.");
}
