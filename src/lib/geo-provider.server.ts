import {
  PUBLIC_PROVIDER,
  geoapifyProvider,
  locationIqProvider,
  type GeoProvider,
} from "./geo-endpoints.ts";
import { CreditGuard, GEOAPIFY_DAILY_CREDITS, geoapifyCredits } from "./geo-credits.ts";
import { GeoLedger, type GeoReserveResult } from "./geo-ledger.ts";

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

async function reserveSharedGeoapifyCredits(credits: number): Promise<GeoReserveResult> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as unknown as ReserveRpcClient;
    const { data, error } = await admin.rpc("reserve_geoapify_credits", {
      _credits: credits,
      _limit: guard().ceiling,
    });
    if (error) return missingReserveFunction(error) ? "missing" : "error";
    return data === true ? "ok" : "denied";
  } catch (error) {
    if (error && typeof error === "object" && missingReserveFunction(error as ReserveRpcError)) {
      return "missing";
    }
    return "error";
  }
}

const LEDGER_KEY = Symbol.for("bea.geoapifyDailyLedger");
function ledger(): GeoLedger {
  const store = globalThis as { [LEDGER_KEY]?: GeoLedger };
  if (!store[LEDGER_KEY]) {
    store[LEDGER_KEY] = new GeoLedger(reserveSharedGeoapifyCredits);
  }
  return store[LEDGER_KEY];
}

type LedgerLogState = { missing: boolean; errorUntil: number };
const LEDGER_LOG_KEY = Symbol.for("bea.geoapifyDailyLedgerLogState");
function ledgerLogState(): LedgerLogState {
  const store = globalThis as { [LEDGER_LOG_KEY]?: LedgerLogState };
  if (!store[LEDGER_LOG_KEY]) store[LEDGER_LOG_KEY] = { missing: false, errorUntil: 0 };
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
  const now = Date.now();
  // A URL built before Geoapify rested (a batch, a request in flight) is not
  // sent: callers read a 503 as "try later", and pick the fallback next time.
  if (g.resting(now)) return new Response(null, { status: 503 });

  const reservation = await ledger().spend(credits, now);
  if (reservation === "unmetered") {
    const log = ledgerLogState();
    if (!log.missing) {
      log.missing = true;
      console.warn(
        "[geo] Geoapify database ledger unavailable (is the geoapify_daily_usage migration applied?); using the in-memory daily count",
      );
    }
  } else if (reservation === "denied") {
    if (!g.resting(now)) {
      g.restForDay(now);
      console.warn(
        `[geo] Geoapify database daily ceiling is ${g.ceiling}; lookups move to ${fallbackName()} until midnight UTC`,
      );
    }
    return new Response(null, { status: 503 });
  } else if (reservation === "error") {
    const log = ledgerLogState();
    if (now >= log.errorUntil) {
      log.errorUntil = now + 60_000;
      console.warn("[geo] Geoapify database reservation failed; Geoapify pauses for 60 seconds");
    }
    return new Response(null, { status: 503 });
  }

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
