import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Returns an authenticated GoogleGenerativeAI instance.
 * Checks request headers first (evaluator entered in UI) then server environment.
 */
export function getGeminiClient(customApiKey?: string | null): GoogleGenerativeAI {
  const apiKey =
    customApiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "") {
    throw new Error(
      "Missing Gemini API Key. Please provide a valid GEMINI_API_KEY in .env.local or enter it in the studio header."
    );
  }

  return new GoogleGenerativeAI(apiKey.trim());
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executes a structured prompt on Gemini Flash with automatic exponential retry
 * and fallback to prevent transient 503 (high demand) or 429 rate limit errors.
 */
export async function generateStructuredJson<T>(
  prompt: string,
  systemInstruction: string,
  customApiKey?: string | null,
  modelName: string = "gemini-3.8-flash"
): Promise<T> {
  const ai = getGeminiClient(customApiKey);

  // Active verified models on this API key: 3.8 Flash primary, 3.5 Flash fallback
  const modelsToTry = [modelName, "gemini-3.5-flash"].filter(
    (val, idx, self) => self.indexOf(val) === idx
  );

  let lastError: unknown = null;

  for (const currentModel of modelsToTry) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const model = ai.getGenerativeModel({
          model: currentModel,
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2, // Low temperature for factual precision & traceability
          },
          systemInstruction,
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
          return JSON.parse(text) as T;
        } catch {
          // Resilient fallback for any stray markdown blocks
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
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("high demand") ||
          errMsg.includes("429") ||
          errMsg.includes("RESOURCE_EXHAUSTED") ||
          errMsg.includes("Service Unavailable");

        if (isTransient && attempt < maxRetries) {
          console.warn(
            `[Gemini Retry] ${currentModel} returned transient error (attempt ${attempt}/${maxRetries}). Retrying in ${attempt * 1200}ms...`
          );
          await sleep(attempt * 1200);
          continue;
        }

        // If not transient or out of retries for this model, try next model in fallback list
        console.warn(`[Gemini Fallback] Model ${currentModel} failed: ${errMsg}. Switching candidate...`);
        break;
      }
    }
  }

  throw lastError || new Error("Failed to generate content after retries and model fallbacks.");
}
