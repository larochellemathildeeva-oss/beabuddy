import {
  PUBLIC_PROVIDER,
  geoapifyProvider,
  locationIqProvider,
  type GeoProvider,
} from "./geo-endpoints.ts";
import { CreditGuard, GEOAPIFY_DAILY_CREDITS, geoapifyCredits } from "./geo-credits.ts";

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
  if (g.spend(credits, Date.now())) {
    console.warn(
      `[geo] Geoapify: ${Math.round(g.credits(Date.now()))} credits today, the ceiling is ${g.ceiling}; lookups move to ${fallbackName()} until midnight UTC`,
    );
  }
  const res = await fetch(url, init);
  if (g.answered(res.status, Date.now())) {
    console.warn(
      `[geo] Geoapify answered ${res.status}; lookups move to ${fallbackName()} ${g.reason === "rate-limited" ? "for ten minutes" : "until midnight UTC"}`,
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
