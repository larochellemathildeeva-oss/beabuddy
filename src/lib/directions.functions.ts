import { autoPinTrusted } from "@/lib/match-confidence";
import { areaBoxFrom, boxViewbox, inBox, widenBox, type AreaBox } from "@/lib/geocode-plan";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  hasCoords,
  mapsDirUrl,
  placeQueryCandidates,
  reuseKeyForStop,
} from "@/lib/direction-stops";
import { haversine } from "@/lib/geo";
import {
  classifyGeoStatus,
  nextDelayMs,
  routeProfile,
  routeUrl,
  searchUrl,
  type GeoProvider,
} from "@/lib/geo-endpoints";

export type RouteStep = { instruction: string; distance: number };

export type RouteLeg = {
  from: string;
  to: string;
  mode: "walking" | "driving";
  distance: number;
  duration: number;
  steps: RouteStep[];
  mapUrl: string;
  /** True when we had coordinates but stopped calling OSRM. */
  capped?: boolean;
  /** True when neither end could be placed on the map. */
  unknownSpot?: boolean;
  /** True when both ends resolved to the same pin. */
  sameSpot?: boolean;
  fromLat?: number;
  fromLon?: number;
  toLat?: number;
  toLon?: number;
};

type Stop = {
  title: string;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
};

const UA = "BeaBot/1.0 (travel app)";

function cleanArea(area: string): string {
  return area
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
}

// Lookups sleep 1.1s each (Nominatim). Legs are one un-throttled OSRM fetch.
// A long day plan needs more than a dozen lookups; reuse identical venues.
const LOOKUP_BUDGET = 30;
const LEG_BUDGET = 60;
const WALL_MS = 80_000;

type GeoFound = {
  lat: number;
  lon: number;
  boundingbox?: string[];
  /** What the geocoder called it and what kind of thing it is, for autoPinTrusted. */
  label?: string;
  category?: string;
  kind?: string;
};

async function geocode(
  provider: GeoProvider,
  query: string,
  box?: AreaBox | null,
): Promise<GeoFound | null> {
  // Inside the trip's area when there is one: bounded in the request, and
  // checked on the way back, because these pins are saved onto the stops.
  const url = searchUrl(provider, {
    query,
    limit: box ? 3 : 1,
    ...(box ? { viewbox: boxViewbox(box), bounded: true } : {}),
  });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    // A throttled lookup is not a missing place: caching it as one would
    // blank a real stop for the rest of this request.
    if (classifyGeoStatus(res.status) !== "ok") return null;
    const json = (await res.json()) as {
      lat: string;
      lon: string;
      boundingbox?: string[];
      display_name?: string;
      class?: string;
      category?: string;
      type?: string;
      addresstype?: string;
    }[];
    for (const hit of json) {
      const lat = Number(hit.lat);
      const lon = Number(hit.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (box && !inBox(box, lat, lon)) continue;
      return {
        lat,
        lon,
        ...(hit.boundingbox ? { boundingbox: hit.boundingbox } : {}),
        ...(hit.display_name ? { label: hit.display_name } : {}),
        ...(hit.category || hit.class ? { category: hit.category || hit.class } : {}),
        ...(hit.addresstype || hit.type ? { kind: hit.addresstype || hit.type } : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}

function stepText(s: { maneuver?: { type?: string; modifier?: string }; name?: string }): string {
  const type = s.maneuver?.type ?? "continue";
  const mod = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : "";
  const name = s.name ? ` onto ${s.name}` : "";
  if (type === "arrive") return "Arrive at your destination";
  if (type === "depart") return `Head off${name}`;
  return `${type}${mod}${name}`.replace(/^\w/, (c) => c.toUpperCase());
}

async function leg(
  provider: GeoProvider,
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  mode: "walking" | "driving",
) {
  // "foot" on the demo router, "walking" on LocationIQ — the same mode under
  // two names, and the wrong one 400s every walking leg without saying so.
  const url = routeUrl(provider, routeProfile(provider, mode), a, b);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: {
        distance: number;
        duration: number;
        legs: {
          steps: {
            distance: number;
            name?: string;
            maneuver?: { type?: string; modifier?: string };
          }[];
        }[];
      }[];
    };
    const route = json.routes?.[0];
    if (!route) return null;
    const steps: RouteStep[] = (route.legs[0]?.steps ?? [])
      .map((s) => ({ instruction: stepText(s), distance: Math.round(s.distance) }))
      .filter((s) => s.distance > 0 || s.instruction.startsWith("Arrive"));
    return { distance: Math.round(route.distance), duration: Math.round(route.duration), steps };
  } catch {
    return null;
  }
}

const coord = z.preprocess((value) => {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

const BuildRoutesInput = z.object({
  stops: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(200),
        address: z.string().max(300).nullable().optional(),
        lat: coord,
        lon: coord,
      }),
    )
    .min(2)
    .max(200),
  area: z.string().max(200).optional(),
});

function mapsOnlyLeg(
  fromName: string,
  toName: string,
  area: string,
  opts?: {
    capped?: boolean;
    mode?: "walking" | "driving";
    from?: { lat: number; lon: number } | null;
    to?: { lat: number; lon: number } | null;
  },
): RouteLeg {
  const from = opts?.from ?? null;
  const to = opts?.to ?? null;
  const mode = opts?.mode ?? "walking";
  return {
    from: fromName,
    to: toName,
    mode,
    distance: 0,
    duration: 0,
    steps: [],
    mapUrl: mapsDirUrl(
      { title: fromName, ...(from ? { lat: from.lat, lon: from.lon } : {}) },
      { title: toName, ...(to ? { lat: to.lat, lon: to.lon } : {}) },
      area,
      mode,
    ),
    ...(opts?.capped ? { capped: true } : {}),
    ...(!from || !to ? { unknownSpot: true } : {}),
    ...(from ? { fromLat: from.lat, fromLon: from.lon } : {}),
    ...(to ? { toLat: to.lat, toLon: to.lon } : {}),
  };
}

export const buildRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stops: Stop[]; area?: string }) => BuildRoutesInput.parse(input))
  .handler(async ({ data }) => {
    const area = data.area?.trim() ?? "";
    const points: ({ lat: number; lon: number } | null)[] = [];
    const deferred: string[] = [];
    const remembered = new Map<string, { lat: number; lon: number }>();
    const queryCache = new Map<string, GeoFound | null>();
    let lookupsLeft = LOOKUP_BUDGET;
    let legsLeft = LEG_BUDGET;
    const deadline = Date.now() + WALL_MS;
    // Server-only: this file ships to the client bundle, the token must not.
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();
    /** Timestamps of requests made, so both the burst and minute caps hold. */
    const sent: number[] = [];
    let box: AreaBox | null = null;
    const lookup = async (query: string) => {
      const cacheKey = query.toLowerCase();
      if (queryCache.has(cacheKey)) return queryCache.get(cacheKey) ?? null;
      if (lookupsLeft <= 0 || Date.now() > deadline) return null;
      // The provider's own pace, honouring the minute cap as well as the gap,
      // rather than a number written in here.
      const delay = nextDelayMs(provider, sent, Date.now());
      if (delay > 0) {
        if (Date.now() + delay > deadline) return null;
        await new Promise((r) => setTimeout(r, delay));
      }
      lookupsLeft -= 1;
      sent.push(Date.now());
      const found = await geocode(provider, query, box);
      queryCache.set(cacheKey, found);
      return found;
    };
    // The area's box, once, before any stop that needs looking up. Without
    // it a stop's name alone could land anywhere — "Queue de Castor" in
    // Montreal was saved at a stand near Quebec City.
    if (area && data.stops.some((stop) => !hasCoords(stop))) {
      const areaHit = await lookup(cleanArea(area));
      const areaBox = areaBoxFrom(areaHit?.boundingbox);
      if (areaBox) box = widenBox(areaBox);
    }
    for (const stop of data.stops) {
      if (hasCoords(stop)) {
        const pin = { lat: stop.lat, lon: stop.lon };
        remembered.set(reuseKeyForStop(stop), pin);
        points.push(pin);
        continue;
      }
      const reuse = remembered.get(reuseKeyForStop(stop));
      if (reuse) {
        points.push(reuse);
        continue;
      }
      if (lookupsLeft <= 0 || Date.now() > deadline) {
        if (!deferred.includes(stop.title)) deferred.push(stop.title);
        points.push(null);
        continue;
      }
      const region = cleanArea(area);
      const names = placeQueryCandidates(stop.title, stop.address);
      // A lookup counts only if it plausibly is this stop. These pins are
      // saved onto the stops; a namesake is treated as not found, so the leg
      // opens Maps by name instead of routing to the wrong place.
      const trusted = (hit: GeoFound | null) =>
        hit && autoPinTrusted({ title: stop.title, address: stop.address }, hit) ? hit : null;
      let found: GeoFound | null = null;
      for (const name of names) {
        const q = region ? `${name}, ${region}` : name;
        found = trusted(await lookup(q));
        if (found) break;
      }
      // Some well-known places (e.g. Beaver Lake) only resolve without a region suffix.
      if (!found && region && names[0]) {
        const hit = trusted(await lookup(names[0]));
        const anchor = points.find((p) => p !== null);
        // Bounded to the area when it has a box; the anchor check is what is
        // left when it has none.
        if (hit && (box || !anchor || haversine(anchor, hit) <= 150_000)) found = hit;
      }
      const pin = found ? { lat: found.lat, lon: found.lon } : null;
      if (pin) remembered.set(reuseKeyForStop(stop), pin);
      points.push(pin);
    }

    const legs: RouteLeg[] = [];
    const unresolved: string[] = [];
    for (let i = 0; i < data.stops.length - 1; i++) {
      const a = points[i];
      const b = points[i + 1];
      const fromName = data.stops[i]!.title;
      const toName = data.stops[i + 1]!.title;
      if (!a || !b) {
        const missing = !a ? fromName : toName;
        if (deferred.includes(missing)) {
          legs.push(
            mapsOnlyLeg(fromName, toName, area, { capped: true, from: a ?? null, to: b ?? null }),
          );
        } else {
          if (!unresolved.includes(missing)) unresolved.push(missing);
          legs.push(mapsOnlyLeg(fromName, toName, area, { from: a ?? null, to: b ?? null }));
        }
        continue;
      }
      const straight = haversine(a, b);
      if (straight < 25) {
        legs.push({
          from: fromName,
          to: toName,
          mode: "walking",
          distance: 0,
          duration: 0,
          steps: [],
          mapUrl: mapsDirUrl(
            { title: fromName, lat: a.lat, lon: a.lon },
            { title: toName, lat: b.lat, lon: b.lon },
            area,
            "walking",
          ),
          sameSpot: true,
          fromLat: a.lat,
          fromLon: a.lon,
          toLat: b.lat,
          toLon: b.lon,
        });
        continue;
      }
      const mode: "walking" | "driving" = straight < 3000 ? "walking" : "driving";
      if (legsLeft <= 0 || Date.now() > deadline) {
        legs.push(mapsOnlyLeg(fromName, toName, area, { capped: true, from: a, to: b, mode }));
        continue;
      }
      legsLeft -= 1;
      const r = await leg(provider, a, b, mode);
      if (!r) {
        legs.push(mapsOnlyLeg(fromName, toName, area, { from: a, to: b, mode }));
        continue;
      }
      legs.push({
        from: fromName,
        to: toName,
        mode,
        distance: r.distance,
        duration: r.duration,
        steps: r.steps,
        mapUrl: mapsDirUrl(
          { title: fromName, lat: a.lat, lon: a.lon },
          { title: toName, lat: b.lat, lon: b.lon },
          area,
          mode,
        ),
        fromLat: a.lat,
        fromLon: a.lon,
        toLat: b.lat,
        toLon: b.lon,
      });
    }

    return { legs, unresolved, deferred, savedAt: new Date().toISOString() };
  });
