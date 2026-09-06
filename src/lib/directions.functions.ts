import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { hasCoords, mapsDirUrl, placeQueryCandidates, reuseKeyForStop } from "@/lib/direction-stops";
import { haversine } from "@/lib/geo";

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
  return area.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

// Lookups sleep 1.1s each (Nominatim). Legs are one un-throttled OSRM fetch.
// A long day plan needs more than a dozen lookups; reuse identical venues.
const LOOKUP_BUDGET = 30;
const LEG_BUDGET = 60;
const WALL_MS = 80_000;

async function geocode(query: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { lat: string; lon: string }[];
    const first = json[0];
    if (!first) return null;
    return { lat: Number(first.lat), lon: Number(first.lon) };
  } catch {
    return null;
  }
}

function stepText(s: {
  maneuver?: { type?: string; modifier?: string };
  name?: string;
}): string {
  const type = s.maneuver?.type ?? "continue";
  const mod = s.maneuver?.modifier ? ` ${s.maneuver.modifier}` : "";
  const name = s.name ? ` onto ${s.name}` : "";
  if (type === "arrive") return "Arrive at your destination";
  if (type === "depart") return `Head off${name}`;
  return `${type}${mod}${name}`.replace(/^\w/, (c) => c.toUpperCase());
}

async function leg(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  mode: "walking" | "driving",
) {
  const profile = mode === "walking" ? "foot" : "driving";
  const url = `https://router.project-osrm.org/route/v1/${profile}/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&steps=true`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      routes?: {
        distance: number;
        duration: number;
        legs: { steps: { distance: number; name?: string; maneuver?: { type?: string; modifier?: string } }[] }[];
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
    const queryCache = new Map<string, { lat: number; lon: number } | null>();
    let lookupsLeft = LOOKUP_BUDGET;
    let legsLeft = LEG_BUDGET;
    const deadline = Date.now() + WALL_MS;
    const lookup = async (query: string) => {
      const cacheKey = query.toLowerCase();
      if (queryCache.has(cacheKey)) return queryCache.get(cacheKey) ?? null;
      if (lookupsLeft <= 0 || Date.now() > deadline) return null;
      lookupsLeft -= 1;
      const found = await geocode(query);
      queryCache.set(cacheKey, found);
      if (lookupsLeft > 0) await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit
      return found;
    };
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
      let found: { lat: number; lon: number } | null = null;
      for (const name of names) {
        const q = region ? `${name}, ${region}` : name;
        found = await lookup(q);
        if (found) break;
      }
      // Some well-known places (e.g. Beaver Lake) only resolve without a region suffix.
      if (!found && region && names[0]) {
        const hit = await lookup(names[0]);
        const anchor = points.find((p) => p !== null);
        if (hit && (!anchor || haversine(anchor, hit) <= 150_000)) found = hit;
      }
      if (found) remembered.set(reuseKeyForStop(stop), found);
      points.push(found);
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
          legs.push(mapsOnlyLeg(fromName, toName, area, { capped: true, from: a ?? null, to: b ?? null }));
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
      const r = await leg(a, b, mode);
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
