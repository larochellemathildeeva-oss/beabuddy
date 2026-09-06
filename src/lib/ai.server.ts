import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { wrapLanguageModel } from "ai";
import { flattenGeminiPromptFiles } from "@/lib/ai-image";
import {
  AI_CALL,
  aiFailure,
  isDailyQuota,
  isOverloaded,
  isRateLimited,
  parseModelChain,
  runModelChain,
  shouldFallToNextModel,
} from "@/lib/ai-errors";

export {
  AI_CALL,
  aiFailure,
  isDailyQuota,
  isOverloaded,
  isRateLimited,
  parseModelChain,
  shouldFallToNextModel,
};

/**
 * Model ids move. Keeping this in the environment means a rename is a config
 * change rather than a redeploy, and a wrong id fails loudly at the first call
 * instead of silently sitting in source.
 */
// gemini-2.5-flash is blocked for new API keys/projects — use 3.6+ only.
const MODEL_ID = process.env["GEMINI_MODEL"] || "gemini-3.6-flash";

/**
 * Optional comma-separated ladder of weaker / cheaper models. Tried in order
 * when the primary (then each previous step) is overloaded or out of free-tier
 * quota. Each model has its own free-tier pool.
 *
 * Example: gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview
 */
const FALLBACK_MODEL_IDS =
  process.env["GEMINI_FALLBACK_MODEL"] || "gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview";

function google() {
  const apiKey = process.env["GOOGLE_GENERATIVE_AI_API_KEY"];
  if (!apiKey) throw new Error("AI is not set up on this app yet.");
  return createGoogleGenerativeAI({ apiKey });
}

function wrapGoogleModel(model: ReturnType<ReturnType<typeof google>>) {
  return wrapLanguageModel({
    model,
    middleware: {
      specificationVersion: "v3",
      transformParams: async ({ params }) => ({
        ...params,
        prompt: flattenGeminiPromptFiles(params.prompt),
      }),
    },
  });
}

function modelForId(id: string) {
  return wrapGoogleModel(google()(id));
}

/** Ordered chain: primary, then each fallback, de-duplicated. */
export function geminiModelChain(): string[] {
  return parseModelChain(MODEL_ID, FALLBACK_MODEL_IDS);
}

export function getGeminiModel() {
  return modelForId(MODEL_ID);
}

/** First fallback only — prefer withModelFallback for the full ladder. */
export function getFallbackModel() {
  const chain = geminiModelChain();
  const next = chain[1];
  return next ? modelForId(next) : null;
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

/**
 * Run against the primary model, then each fallback in turn when the current
 * one is out of capacity or free-tier quota. Without GEMINI_FALLBACK_MODEL
 * this is a single attempt on the primary.
 */
export async function withModelFallback<T>(
  run: (model: ReturnType<typeof getGeminiModel>) => Promise<T>,
): Promise<T> {
  const ids = geminiModelChain();
  return runModelChain(ids, (id, index) => run(modelForId(id)), {
    onStepDown: (fromIndex, error) => {
      const reason = isRateLimited(error) ? "rate-limited" : "overloaded";
      console.error(
        `[ai] ${ids[fromIndex]} ${reason}, stepping down to ${ids[fromIndex + 1]}`,
      );
    },
  });
}
