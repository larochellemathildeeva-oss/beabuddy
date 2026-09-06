import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RouteStep = { instruction: string; distance: number };

export type RouteLeg = {
  from: string;
  to: string;
  mode: "walking" | "driving";
  distance: number;
  duration: number;
  steps: RouteStep[];
  mapUrl: string;
};

type Stop = { title: string; lat?: number | null; lon?: number | null };

const UA = "BeaBot/1.0 (travel app)";

function cleanArea(area: string): string {
  return area.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").replace(/\s+,/g, ",").trim();
}

// Turn a timeline title like "Picnic Lunch at Beaver Lake · Est. 10 CAD"
// into searchable place-name candidates.
function candidates(title: string): string[] {
  const base = title
    .split("·")[0]!
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripVerb = (v: string) =>
    v
      .replace(
        /^(?:purchase|buy|hike|explore|visit|walk|stroll|self-guided|guided|classic|historic|picnic|lunch|dinner|breakfast|brunch|coffee|drinks?|tour|day\s+trip)\b\s*/i,
        "",
      )
      .trim();
  const out: string[] = [];
  const push = (v: string | undefined) => {
    const t = (v ?? "").replace(/^[-,&\s]+|[-,&\s]+$/g, "").trim();
    if (t.length > 2 && !out.includes(t)) out.push(t);
  };
  const stripTail = (v: string) =>
    v
      .replace(
        /\s+(?:walking|walk|tour|dinner|lunch|breakfast|brunch|drinks?|coffee|hike|visit|exploration)$/i,
        "",
      )
      .trim();
  // "X at Place" → the place is the strongest candidate
  const at = base.match(/\b(?:at|in|to|around|near)\s+(.+)$/i);
  if (at?.[1]) push(stripTail(stripVerb(at[1]).split(/\s*&\s*/)[0] ?? ""));
  if (at?.[1]) push(at[1]);
  // Verb-stripped, without "& second place" tails and trailing activity words
  push(stripTail(stripVerb(base).split(/\s*&\s*/)[0] ?? ""));
  push(stripVerb(base).split(/\s*&\s*/)[0]);
  push(stripVerb(base));
  push(base.split(/\s*&\s*/)[0]);
  push(base);
  return out.slice(0, 6);
}

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
}

// Nominatim + OSRM share one ceiling so a 200-stop body of pre-geocoded
// points cannot become 199 OSRM fetches. 15 × 1.1s of lookups plus the
// leftover OSRM calls should stay under a 30s proxy timeout.
const OUTBOUND_BUDGET = 25;

const BuildRoutesInput = z.object({
  stops: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        lat: z.number().nullable().optional(),
        lon: z.number().nullable().optional(),
      }),
    )
    .max(200),
  area: z.string().max(200).optional(),
});

function mapsOnlyLeg(fromName: string, toName: string, area: string): RouteLeg {
  const region = cleanArea(area);
  const q = (n: string) => encodeURIComponent(region ? `${n}, ${region}` : n);
  return {
    from: fromName,
    to: toName,
    mode: "walking",
    distance: 0,
    duration: 0,
    steps: [],
    mapUrl: `https://www.google.com/maps/dir/?api=1&origin=${q(fromName)}&destination=${q(toName)}&travelmode=walking`,
  };
}

export const buildRoutes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { stops: Stop[]; area?: string }) => BuildRoutesInput.parse(input))
  .handler(async ({ data }) => {
    const area = data.area?.trim() ?? "";
    const points: ({ lat: number; lon: number } | null)[] = [];
    let outboundLeft = OUTBOUND_BUDGET;
    const lookup = async (query: string) => {
      if (outboundLeft <= 0) return null;
      outboundLeft -= 1;
      const found = await geocode(query);
      await new Promise((r) => setTimeout(r, 1100)); // Nominatim rate limit
      return found;
    };
    for (const stop of data.stops) {
      if (
        typeof stop.lat === "number" &&
        typeof stop.lon === "number" &&
        (stop.lat !== 0 || stop.lon !== 0)
      ) {
        points.push({ lat: stop.lat, lon: stop.lon });
        continue;
      }
      const region = cleanArea(area);
      const names = candidates(stop.title);
      let found: { lat: number; lon: number } | null = null;
      for (const name of names) {
        const q = region ? `${name}, ${region}` : name;
        found = await lookup(q);
        if (found) break;
      }
      // Some well-known places (e.g. Beaver Lake) only resolve without a region suffix.
      if (!found && region) {
        for (const name of names) {
          const hit = await lookup(name);
          if (!hit) continue;
          // Guard against same-named places far away: if we already have a
          // located stop on this trip, the new one must be near it.
          const anchor = points.find((p) => p !== null);
          if (anchor && haversine(anchor, hit) > 150_000) continue;
          found = hit;
          break;
        }
      }
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
        if (!unresolved.includes(missing)) unresolved.push(missing);
        legs.push(mapsOnlyLeg(fromName, toName, area));
        continue;
      }
      if (outboundLeft <= 0) {
        legs.push(mapsOnlyLeg(fromName, toName, area));
        continue;
      }
      outboundLeft -= 1;
      const straight = haversine(a, b);
      const mode: "walking" | "driving" = straight < 3000 ? "walking" : "driving";
      const r = await leg(a, b, mode);
      if (!r) {
        legs.push(mapsOnlyLeg(fromName, toName, area));
        continue;
      }
      legs.push({
        from: fromName,
        to: toName,
        mode,
        distance: r.distance,
        duration: r.duration,
        steps: r.steps,
        mapUrl: `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lon}&destination=${b.lat},${b.lon}&travelmode=${mode === "walking" ? "walking" : "driving"}`,
      });
    }

    return { legs, unresolved, savedAt: new Date().toISOString() };
  });

function haversine(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
