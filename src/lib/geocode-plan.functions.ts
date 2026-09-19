import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { planStopQueries, QUERIES_PER_STOP } from "@/lib/geocode-plan";
import { searchUrl, type GeoProvider } from "@/lib/geo-endpoints";

const UA = "BeaBot/1.0 (travel app)";

/** Nominatim asks for no more than one request a second. This is the gap. */
export const PLAN_LOOKUP_GAP_MS = 1_100;

/** Bounds on a single call, so one enormous plan cannot run away. */
const LOOKUP_BUDGET = 60;
const WALL_MS = 90_000;

const StopIn = z.object({
  title: z.string().max(200),
  detail: z.string().nullish(),
});

const Input = z.object({
  stops: z.array(StopIn).max(60),
  area: z.string().max(200).nullish(),
});

export type PlacedStop = { index: number; lat: number; lon: number };

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function geocode(
  provider: GeoProvider,
  query: string,
): Promise<{ lat: number; lon: number } | null> {
  // accept-language=* asks for the name in the local language rather than an
  // English translation. It does not change what matches — OSM indexes local
  // names either way — but it means a place found as 清水寺 comes back as
  // 清水寺, which is what a reader standing in front of it needs.
  const url = searchUrl(provider, { query, limit: 1, language: "*" });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    const first = json[0];
    if (!first) return null;
    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  } catch {
    return null;
  }
}

/**
 * Places the stops a plan produced, so they land on the map with the rest.
 *
 * Only stops that resolve come back. A stop that does not is left alone rather
 * than guessed at — the whole reason the queries are anchored to the trip's
 * area is that an unanchored lookup once put a Montreal burger in Slovakia,
 * and a wrong pin is worse than no pin.
 *
 * The one-a-second gap is Nominatim's usage policy, not caution. It is why
 * this is slow enough to need something to look at while it runs.
 */
export const geocodePlanStops = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { stops: { title: string; detail?: string | null }[]; area?: string | null }) =>
      Input.parse(input),
  )
  .handler(async ({ data }) => {
    const area = data.area?.trim() ?? "";
    const placed: PlacedStop[] = [];
    if (!area) return { placed, lookedUp: 0, area: "" };

    // Which service answers, and how fast it lets us ask. Imported here
    // rather than at the top of the file: this module ships to the client
    // bundle, and the token must not go with it.
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();

    const cache = new Map<string, { lat: number; lon: number } | null>();
    const deadline = Date.now() + WALL_MS;
    let budget = LOOKUP_BUDGET;
    let lookedUp = 0;
    let first = true;

    for (const [index, stop] of data.stops.entries()) {
      const queries = planStopQueries({ title: stop.title, detail: stop.detail }, area).slice(
        0,
        QUERIES_PER_STOP,
      );
      for (const query of queries) {
        const key = query.toLowerCase();
        if (cache.has(key)) {
          const hit = cache.get(key) ?? null;
          if (hit) {
            placed.push({ index, ...hit });
            break;
          }
          continue;
        }
        if (budget <= 0 || Date.now() > deadline) break;
        // The gap goes before every request but the first, so a one-stop plan
        // does not sit still for a second before it starts.
        if (!first) await wait(provider.gapMs);
        first = false;
        budget -= 1;
        lookedUp += 1;
        const hit = await geocode(provider, query);
        cache.set(key, hit);
        if (hit) {
          placed.push({ index, ...hit });
          break;
        }
      }
    }

    return { placed, lookedUp, area };
  });
