/**
 * A daily ceiling on what each traveller may ask of Gemini.
 *
 * Every AI call costs Béa money, and most of them had no per-person limit at
 * all; the few that did kept it in the server's memory, which a restart or a
 * second instance forgets. So each logical AI operation reserves units from a
 * per-traveller, per-UTC-day row in the database before Gemini is asked
 * (reserve_ai_units, the ai_daily_usage migration). The units are Béa's own:
 * a rough weight per operation, not Google's bill. One operation reserves
 * once, however many models `withModelFallback` tries.
 *
 * Pure and tested; the reservation itself is in ai-quota.server.ts.
 */

/** Units a traveller may spend in a UTC day, unless `AI_DAILY_UNITS` says otherwise. */
export const AI_DAILY_UNITS_DEFAULT = 100;

/** What each operation reserves. About 25 trip builds, or 50 receipt scans, a day. */
export const AI_COST = {
  localName: 1,
  receipt: 2,
  packing: 2,
  comparePlaces: 2,
  planEdit: 2,
  recoList: 3,
  optimize: 3,
  itinerary: 4,
  dayTrip: 4,
  documentRead: 5,
  compareItineraries: 6,
} as const;

export type AiOperation = keyof typeof AI_COST;

export const AI_LIMIT_MESSAGE =
  "Béa has reached today's AI limit for your account. Everything else still works, and it resets at midnight UTC.";
export const AI_UNAVAILABLE_MESSAGE =
  "Béa's AI tools are unavailable for a moment. Your trips are unaffected — try again shortly.";

/** The daily ceiling from the environment, or the default when unset or nonsense. */
export function aiDailyUnits(raw: string | undefined): number {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : AI_DAILY_UNITS_DEFAULT;
}

export type QuotaReply = "allowed" | "refused" | "missing" | "error";

/**
 * Read reserve_ai_units' answer. A missing function or table means the
 * migration is not applied yet; every other error is `error`, and the
 * caller sends nothing to Gemini.
 */
export function readQuotaReply(
  data: unknown,
  error: { code?: string; message?: string } | null,
): QuotaReply {
  if (error) {
    const missing =
      error.code === "PGRST202" ||
      error.code === "PGRST205" ||
      error.code === "42883" ||
      error.code === "42P01" ||
      /could not find the function|does not exist|schema cache/i.test(error.message ?? "");
    return missing ? "missing" : "error";
  }
  if (data === true) return "allowed";
  if (data === false) return "refused";
  return "error";
}

function utcDay(now: number): number {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * The same ceiling counted in this process only: what decides while the
 * migration is not applied, or where there is no database (local runs). A
 * restart forgets it, which is why the database decides once it can.
 */
export class MemoryQuota {
  private day = 0;
  private readonly spent = new Map<string, number>();
  private readonly maxUsers: number;

  constructor(maxUsers = 50_000) {
    this.maxUsers = maxUsers;
  }

  reserve(userId: string, units: number, limit: number, now: number): boolean {
    const day = utcDay(now);
    if (day !== this.day) {
      this.day = day;
      this.spent.clear();
    }
    if (units <= 0) return true;
    const used = this.spent.get(userId) ?? 0;
    if (used + units > limit) return false;
    if (!this.spent.has(userId) && this.spent.size >= this.maxUsers) {
      const oldest = this.spent.keys().next().value;
      if (oldest !== undefined) this.spent.delete(oldest);
    }
    this.spent.set(userId, used + units);
    return true;
  }
}
