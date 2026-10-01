import {
  PUBLIC_PROVIDER,
  geoapifyProvider,
  locationIqProvider,
  type GeoProvider,
} from "./geo-endpoints.ts";
import { CreditGuard, GEOAPIFY_DAILY_CREDITS, geoapifyCredits } from "./geo-credits.ts";
import { isDeployedBuild } from "./deployed.ts";
import { ERROR_PAUSE_MS, GeoLedger, type GeoReserveResult } from "./geo-ledger.ts";

/**
 * The geocoding token, on the server and nowhere else.
 *
 * `src/lib/*.functions.ts` ship to the client bundle — that is written down in
 * AGENTS.md and it is the reason this file exists separately. A key read in a
 * functions file would be compiled into JavaScript a browser downloads. Every
 * caller imports this lazily, inside its handler, the same way the Gemini key
 * is reached.
 *
 * Absent token, absent change: the public Nominatim and OSRM endpoints stay
 * exactly as they were, at the same one-a-second pace. Nothing breaks by not
 * configuring this, which is what makes the switch safe to make and safe to
 * undo.
 */
let announced = "";

/**
 * One guard for the whole server, on `globalThis` so the tile handler in
 * `server.ts` and the server functions count into the same day even if the
 * build gives each its own copy of this module.
 */
const GUARD_KEY = Symbol.for("bea.geoapifyCreditGuard");
function guard(): CreditGuard {
  const store = globalThis as { [GUARD_KEY]?: CreditGuard };
  if (!store[GUARD_KEY]) {
    const ceiling = Number(process.env["GEOAPIFY_DAILY_CREDITS"]);
    store[GUARD_KEY] = new CreditGuard(
      Number.isFinite(ceiling) && ceiling > 0 ? ceiling : GEOAPIFY_DAILY_CREDITS,
    );
  }
  return store[GUARD_KEY];
}

type ReserveRpcError = { code?: string; message?: string };
type ReserveRpcClient = {
  rpc(
    name: string,
    args: { _credits: number; _limit: number },
  ): PromiseLike<{ data: boolean | null; error: ReserveRpcError | null }>;
};

function missingReserveFunction(error: ReserveRpcError): boolean {
  return (
    error.code === "PGRST202" ||
    error.code === "42883" ||
    /function .*reserve_geoapify_credits.* does not exist/i.test(error.message ?? "")
  );
}

/** When the last reservation failure was logged; at most one a minute. */
let reserveFailureLoggedAt = 0;
function logReserveFailure(detail: unknown): void {
  const now = Date.now();
  if (now - reserveFailureLoggedAt < 60_000) return;
  reserveFailureLoggedAt = now;
  // Error code and message, or the thrown error with its stack; never the
  // request, which carries the service-role key.
  console.warn("[geo] Geoapify database reservation failed:", detail);
}

async function askGeoapifyLedger(credits: number): Promise<GeoReserveResult> {
  let admin: ReserveRpcClient;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    admin = supabaseAdmin as unknown as ReserveRpcClient;
    // Touching the client is part of the check: the import audit's stand-in
    // (no-database.ts) throws on any property, and so does a client built
    // without its environment variables.
    if (typeof admin.rpc !== "function") return "missing";
  } catch {
    // No admin client in this environment (no service-role key, a unit test,
    // the import audit): there is no ledger to ask, as with a missing migration.
    return "missing";
  }
  try {
    const { data, error } = await admin.rpc("reserve_geoapify_credits", {
      _credits: credits,
      _limit: guard().ceiling,
    });
    if (error) {
      if (missingReserveFunction(error)) return "missing";
      logReserveFailure({ code: error.code, message: error.message });
      return "error";
    }
    return data === true ? "ok" : "denied";
  } catch (error) {
    if (error && typeof error === "object" && missingReserveFunction(error as ReserveRpcError)) {
      return "missing";
    }
    logReserveFailure(error);
    return "error";
  }
}

/**
 * The shared reservation, except that the deployed app never runs unmetered:
 * there, no ledger (no service-role client, or the migration gone) is a
 * failure, so nothing is sent to Geoapify and lookups move to the fallback.
 * Unit tests, the import audit and local runs keep the in-memory count.
 */
async function reserveSharedGeoapifyCredits(credits: number): Promise<GeoReserveResult> {
  const result = await askGeoapifyLedger(credits);
  if (result === "missing" && isDeployedBuild()) {
    logReserveFailure(
      "no shared ledger in the deployed app (service-role client or geoapify_daily_usage migration missing)",
    );
    return "error";
  }
  return result;
}

const LEDGER_KEY = Symbol.for("bea.geoapifyDailyLedger");
function ledger(): GeoLedger {
  const store = globalThis as { [LEDGER_KEY]?: GeoLedger };
  if (!store[LEDGER_KEY]) {
    store[LEDGER_KEY] = new GeoLedger(reserveSharedGeoapifyCredits);
  }
  return store[LEDGER_KEY];
}

type LedgerLogState = { missing: boolean };
const LEDGER_LOG_KEY = Symbol.for("bea.geoapifyDailyLedgerLogState");
function ledgerLogState(): LedgerLogState {
  const store = globalThis as { [LEDGER_LOG_KEY]?: LedgerLogState };
  if (!store[LEDGER_LOG_KEY]) store[LEDGER_LOG_KEY] = { missing: false };
  return store[LEDGER_LOG_KEY];
}

/** The Geoapify key, or empty when it is not set or resting for today. */
export function geoapifyKey(): string {
  const key = (process.env["GEOAPIFY_API_KEY"] ?? "").trim();
  return key && !guard().resting(Date.now()) ? key : "";
}

/**
 * `fetch`, counting what Geoapify charges for it.
 *
 * Every request that may reach Geoapify goes through here, so the day's count
 * is Béa's own and the switch to LocationIQ happens before Geoapify's
 * allowance is gone rather than after. Other services pass straight through.
 */
export async function geoFetch(url: string, init?: RequestInit): Promise<Response> {
  const credits = geoapifyCredits(url);
  if (!credits) return fetch(url, init);
  const g = guard();
  // A URL built before Geoapify rested (a batch, a request in flight) is not
  // sent: callers read a 503 as "try later", and pick the fallback next time.
  if (g.resting(Date.now())) return new Response(null, { status: 503 });

  const reservation = await ledger().spend(credits);
  // The clock and the guard are read again: the reservation may have waited,
  // and another answer may have rested Geoapify meanwhile.
  const now = Date.now();
  if (reservation === "unmetered") {
    const log = ledgerLogState();
    if (!log.missing) {
      log.missing = true;
      console.warn(
        "[geo] Geoapify database ledger unavailable (is the geoapify_daily_usage migration applied?); using the in-memory daily count, asking again hourly",
      );
    }
  } else if (reservation === "denied") {
    if (!g.resting(now)) {
      console.warn(
        `[geo] Geoapify database daily ceiling is ${g.ceiling}; lookups move to ${fallbackName()} until midnight UTC`,
      );
    }
    g.restForDay(now);
    return new Response(null, { status: 503 });
  } else if (reservation === "error") {
    // Fail closed, and rest Geoapify for the pause so geoProvider() moves
    // lookups to the fallback instead of handing out 503s for a minute.
    if (!g.resting(now)) {
      console.warn(
        `[geo] Geoapify database reservation failed; nothing sent, lookups move to ${fallbackName()} for 60 seconds`,
      );
    }
    g.restFor(ERROR_PAUSE_MS, now);
    return new Response(null, { status: 503 });
  }
  if (g.resting(now)) return new Response(null, { status: 503 });

  if (g.spend(credits, now)) {
    console.warn(
      `[geo] Geoapify: ${Math.round(g.credits(now))} credits today, the ceiling is ${g.ceiling}; lookups move to ${fallbackName()} until midnight UTC`,
    );
  }
  const res = await fetch(url, init);
  const retryAfter = Number(res.headers.get("retry-after"));
  if (g.answered(res.status, Date.now(), Number.isFinite(retryAfter) ? retryAfter : undefined)) {
    console.warn(
      `[geo] Geoapify answered ${res.status}; lookups move to ${fallbackName()} ${g.reason === "rate-limited" ? "for a while" : "until midnight UTC"}`,
    );
  }
  return res;
}

function fallbackName(): string {
  return (process.env["LOCATIONIQ_TOKEN"] ?? "").trim() ? "LocationIQ" : "OpenStreetMap";
}

export function geoProvider(): GeoProvider {
  // Geoapify first when both are set: its terms allow keeping what it finds,
  // and it routes walks, which LocationIQ's hosted router may not. While it
  // rests (see geo-credits.ts), LocationIQ, then the public servers.
  const key = geoapifyKey();
  const token = (process.env["LOCATIONIQ_TOKEN"] ?? "").trim();
  const provider = key
    ? geoapifyProvider(key)
    : token
      ? locationIqProvider(token)
      : PUBLIC_PROVIDER;

  /**
   * Say in the server log which service is answering, once and again
   * whenever it changes.
   *
   * Setting the token is a deploy-time change with no visible effect beyond
   * "things feel quicker", which is not something anyone should have to judge
   * by feel. One line at first use answers it. The token itself is never
   * logged — only its length, which is enough to tell a real token from an
   * empty string or a stray pair of quotes.
   */
  if (announced !== provider.name) {
    announced = provider.name;
    console.info(
      key
        ? `[geo] Geoapify (key ${key.length} chars, ${provider.gapMs}ms between lookups)`
        : token
          ? `[geo] LocationIQ (token ${token.length} chars, ${provider.gapMs}ms between lookups)`
          : "[geo] OpenStreetMap public endpoints — no GEOAPIFY_API_KEY or LOCATIONIQ_TOKEN answering, 1.1s between lookups",
    );
  }
  return provider;
}

/** Whether a paid provider is configured, for the pace a batch can keep. */
export function geoIsKeyed(): boolean {
  return geoProvider().token.length > 0;
}
