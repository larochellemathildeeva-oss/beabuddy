import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Model ids move. Keeping this in the environment means a rename is a config
 * change rather than a redeploy, and a wrong id fails loudly at the first call
 * instead of silently sitting in source.
 */
const MODEL_ID = process.env["GEMINI_MODEL"] || "gemini-3.7-flash";

/** Optional. When set, judgment jobs retry here if the primary is overloaded. */
const FALLBACK_MODEL_ID = process.env["GEMINI_FALLBACK_MODEL"];

function google() {
  const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) throw new Error("AI is not set up on this app yet.");
  return createGoogleGenerativeAI({ apiKey });
}

export function getGeminiModel() {
  return google()(MODEL_ID);
}

export function getFallbackModel() {
  if (!FALLBACK_MODEL_ID) return null;
  return google()(FALLBACK_MODEL_ID);
}

/** Judgment jobs: think more, and return a thought summary the UI can show. */
export const judgmentCall = {
  reasoning: "medium" as const,
  providerOptions: {
    google: {
      thinkingConfig: {
        includeThoughts: true,
        thinkingLevel: "medium" as const,
      },
    },
  },
};

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === "string" ? error : "";
}

/** Provider is up but out of capacity — retrying the same model rarely helps. */
export function isOverloaded(error: unknown): boolean {
  const text = messageOf(error).toLowerCase();
  return (
    text.includes("high demand") ||
    text.includes("overloaded") ||
    text.includes("unavailable") ||
    text.includes("503")
  );
}

function isRateLimited(error: unknown): boolean {
  const text = messageOf(error).toLowerCase();
  return text.includes("rate limit") || text.includes("quota") || text.includes("429");
}

/**
 * Turn a provider failure into something a traveller can act on. The AI SDK's
 * own message is written for developers — "AI_APICallError: This model is
 * currently experiencing high demand" is not something to show someone who
 * just wanted a trip planned.
 */
export function aiFailure(error: unknown): Error {
  if (isOverloaded(error)) {
    return new Error("Béa's planner is busy right now. Give it a minute and try again.");
  }
  if (isRateLimited(error)) {
    return new Error("That's a lot of planning at once. Wait a moment, then try again.");
  }
  const text = messageOf(error).toLowerCase();
  if (text.includes("api key") || text.includes("401") || text.includes("403")) {
    return new Error("AI is not set up on this app yet.");
  }
  return error instanceof Error ? error : new Error("Something went wrong. Try again.");
}

/**
 * Run against the primary model, and once against the fallback if the primary
 * is out of capacity. Without GEMINI_FALLBACK_MODEL set this behaves exactly as
 * before, so it is safe to ship before a second model id has been confirmed.
 */
export async function withModelFallback<T>(
  run: (model: ReturnType<typeof getGeminiModel>) => Promise<T>,
): Promise<T> {
  try {
    return await run(getGeminiModel());
  } catch (error) {
    const fallback = getFallbackModel();
    if (fallback && isOverloaded(error)) {
      console.error("[ai] primary model overloaded, retrying on fallback");
      return run(fallback);
    }
    throw error;
  }
}
