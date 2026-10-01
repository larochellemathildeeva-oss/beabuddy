import { isDeployedBuild } from "./deployed.ts";
import {
  AI_COST,
  AI_LIMIT_MESSAGE,
  AI_UNAVAILABLE_MESSAGE,
  LOCAL_NAME_DAILY,
  MemoryQuota,
  aiDailyUnits,
  readQuotaReply,
  type AiOperation,
  type QuotaReply,
} from "./ai-quota.ts";

/**
 * Reserve a traveller's AI units for one operation, before Gemini is asked.
 *
 * Server only: it uses the service-role client, imported lazily, so a
 * `*.functions.ts` file that imports this lazily inside its handler never
 * brings the key toward the browser. The user ID must come from the verified
 * session (`context.userId`), never from the request body.
 *
 * Throws with a message fit to show when today's units are spent, or when the
 * database cannot be asked (fail closed: paid work is not done unaccounted).
 * Run from source (unit tests, the import audit, local runs) with no
 * migration or no service-role client, the same ceiling is counted in this
 * process, with one warning, and the database is asked again hourly. The
 * deployed app refuses instead (`isDeployedBuild`).
 */

const MEMORY_KEY = Symbol.for("bea.aiMemoryQuota");
function memory(): MemoryQuota {
  const store = globalThis as { [MEMORY_KEY]?: MemoryQuota };
  store[MEMORY_KEY] ??= new MemoryQuota();
  return store[MEMORY_KEY];
}

const MISSING_RETRY_MS = 60 * 60_000;
let missingUntil = 0;
let missingWarned = false;
let errorLoggedAt = 0;

/**
 * Ask the database. Without `bucket`, the shared allowance through
 * reserve_ai_units; with one, that bucket through reserve_ai_units_in (the
 * ai_usage_buckets migration), so a missing second migration only affects
 * what uses a bucket.
 */
async function askDatabase(
  userId: string,
  units: number,
  limit: number,
  bucket?: string,
): Promise<QuotaReply> {
  let admin: {
    rpc: (
      name: string,
      args: Record<string, string | number>,
    ) => PromiseLike<{ data: unknown; error: { code?: string; message?: string } | null }>;
  };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    admin = supabaseAdmin as unknown as typeof admin;
    // Touching the client is part of the check: the import audit's stand-in
    // (no-database.ts) throws on any property, as does a client built
    // without its environment variables. Neither is a database to ask.
    if (typeof admin.rpc !== "function") return "missing";
  } catch {
    return "missing";
  }
  try {
    const { data, error } = bucket
      ? await admin.rpc("reserve_ai_units_in", {
          _user_id: userId,
          _bucket: bucket,
          _units: units,
          _limit: limit,
        })
      : await admin.rpc("reserve_ai_units", {
          _user_id: userId,
          _units: units,
          _limit: limit,
        });
    const reply = readQuotaReply(data, error);
    if (reply === "error" && Date.now() - errorLoggedAt > 60_000) {
      errorLoggedAt = Date.now();
      console.error("[ai-quota] reservation failed:", {
        code: error?.code,
        message: error?.message,
      });
    }
    return reply;
  } catch (error) {
    if (Date.now() - errorLoggedAt > 60_000) {
      errorLoggedAt = Date.now();
      console.error("[ai-quota] reservation failed:", error);
    }
    return "error";
  }
}

export async function reserveAi(userId: string, operation: AiOperation): Promise<void> {
  if (!userId) throw new Error(AI_UNAVAILABLE_MESSAGE);
  const units = AI_COST[operation];
  const limit = aiDailyUnits(process.env["AI_DAILY_UNITS"]);
  const now = Date.now();

  const reply = now < missingUntil ? "missing" : await askDatabase(userId, units, limit);
  if (reply === "allowed") return;
  if (reply === "refused") throw new Error(AI_LIMIT_MESSAGE);
  if (reply === "error") throw new Error(AI_UNAVAILABLE_MESSAGE);

  // "missing": no ledger. The deployed app never counts per process — that
  // would give every restart and every instance a fresh day — so there it
  // fails closed. Tests, scripts and local runs count here instead.
  if (isDeployedBuild()) {
    if (Date.now() - errorLoggedAt > 60_000) {
      errorLoggedAt = Date.now();
      console.error(
        "[ai-quota] no shared AI ledger in the deployed app (service-role client or ai_daily_usage migration missing); AI is refused",
      );
    }
    throw new Error(AI_UNAVAILABLE_MESSAGE);
  }
  if (now >= missingUntil) {
    missingUntil = now + MISSING_RETRY_MS;
    if (!missingWarned) {
      missingWarned = true;
      console.warn(
        "[ai-quota] the durable AI ceiling is unavailable (is the ai_daily_usage migration applied?); counting per process, asking again hourly",
      );
    }
  }
  if (!memory().reserve(userId, units, limit, now)) throw new Error(AI_LIMIT_MESSAGE);
}

let localNameMissingUntil = 0;

/**
 * One local-script name lookup, from the traveller's own small daily bucket
 * (`LOCAL_NAME_DAILY`, 'local_name'), not the allowance meant for trip builds.
 * True when reserved. Never throws: anything else means the search goes on
 * without the local-script name. The deployed app skips the lookup when the
 * bucket cannot be counted; run from source it is counted per process.
 */
export async function reserveLocalName(userId: string): Promise<boolean> {
  if (!userId) return false;
  const now = Date.now();
  const reply =
    now < localNameMissingUntil
      ? "missing"
      : await askDatabase(userId, 1, LOCAL_NAME_DAILY, "local_name");
  if (reply === "allowed") return true;
  if (reply !== "missing") return false;
  localNameMissingUntil = now + MISSING_RETRY_MS;
  if (isDeployedBuild()) {
    // Asked again hourly, not on every search, and said once.
    console.warn(
      "[ai-quota] local-name bucket unavailable (is the ai_usage_buckets migration applied?); searching without local-script names, asking again in an hour",
    );
    return false;
  }
  return memory().reserve(`local_name:${userId}`, 1, LOCAL_NAME_DAILY, now);
}
