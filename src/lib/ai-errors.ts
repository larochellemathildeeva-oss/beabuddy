/**
 * Pure helpers for Gemini failures. Kept free of the Google client so unit
 * tests can prove the 429 / overload classification without credentials.
 */

/** Don't burn free-tier quota on SDK retries; withModelFallback switches models instead. */
export const AI_CALL = { maxRetries: 0 } as const;

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

/** Free-tier / rate-limit 429 — same model will keep failing until the window resets. */
export function isRateLimited(error: unknown): boolean {
  const text = messageOf(error).toLowerCase();
  return (
    text.includes("rate limit") ||
    text.includes("quota") ||
    text.includes("resource_exhausted") ||
    text.includes("429")
  );
}

/** True when trying a weaker / alternate model is worth it. */
export function shouldFallToNextModel(error: unknown): boolean {
  return isOverloaded(error) || isRateLimited(error);
}

/**
 * Primary plus a comma-separated fallback ladder, de-duplicated and in order.
 * Example: primary `gemini-3.6-flash`, fallbacks `gemini-3.5-flash-lite,gemini-3.1-flash-lite-preview`.
 */
export function parseModelChain(primary: string, fallbacksCsv?: string | null): string[] {
  const extras = (fallbacksCsv ?? "")
    .split(/[,;\s]+/)
    .map((id) => id.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [primary.trim(), ...extras]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Try each model in order. On overload / quota, step down. Any other error
 * (or an exhausted ladder) throws the last failure.
 */
export async function runModelChain<M, T>(
  models: readonly M[],
  run: (model: M, index: number) => Promise<T>,
  opts?: { onStepDown?: (fromIndex: number, error: unknown) => void },
): Promise<T> {
  if (models.length === 0) throw new Error("No AI models configured.");
  let lastError: unknown;
  for (let i = 0; i < models.length; i++) {
    try {
      return await run(models[i]!, i);
    } catch (error) {
      lastError = error;
      const hasNext = i < models.length - 1;
      if (!hasNext || !shouldFallToNextModel(error)) throw error;
      opts?.onStepDown?.(i, error);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Something went wrong. Try again.");
}

/**
 * Daily free-tier caps (RPD) vs a short per-minute pause. Google often says
 * "Please retry in 40s" even on a daily metric, so we treat free_tier request
 * caps as daily when the wait is longer than a few minutes, or when the
 * message names a daily quota.
 */
export function isDailyQuota(error: unknown): boolean {
  if (!isRateLimited(error)) return false;
  const text = messageOf(error).toLowerCase();
  if (text.includes("per day") || text.includes("requests per day") || text.includes("/day")) {
    return true;
  }
  if (text.includes("free_tier") || text.includes("free tier")) {
    const retry = text.match(/retry in\s+(\d+(?:\.\d+)?)\s*(s|sec|second|m|min|minute)/i);
    if (!retry) return true;
    const amount = Number(retry[1]);
    const unit = retry[2]!.toLowerCase();
    const seconds = unit.startsWith("m") ? amount * 60 : amount;
    return seconds >= 15 * 60;
  }
  return false;
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
  if (isDailyQuota(error)) {
    return new Error(
      "Béa's free AI allowance is used up for today. Try again tomorrow — or ask whoever runs the app to raise the limit.",
    );
  }
  if (isRateLimited(error)) {
    return new Error("That's a lot of planning at once. Wait a minute, then try again.");
  }
  const text = messageOf(error).toLowerCase();
  if (text.includes("api key") || text.includes("401") || text.includes("403")) {
    return new Error("AI is not set up on this app yet.");
  }
  if (text.includes("inline_data") || text.includes("scalar field")) {
    return new Error("Could not read that picture. Try another photo or paste the list.");
  }
  return error instanceof Error ? error : new Error("Something went wrong. Try again.");
}
