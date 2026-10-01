import {
  AI_COST,
  AI_LIMIT_MESSAGE,
  AI_UNAVAILABLE_MESSAGE,
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
 * Until the migration is applied, or where there is no service-role client,
 * the same ceiling is counted in this process, with one warning, and the
 * database is asked again hourly.
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

async function askDatabase(userId: string, units: number, limit: number): Promise<QuotaReply> {
  let admin: {
    rpc: (
      name: string,
      args: { _user_id: string; _units: number; _limit: number },
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
    const { data, error } = await admin.rpc("reserve_ai_units", {
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

  // "missing": no ledger yet. Count here, and ask the database again later.
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
