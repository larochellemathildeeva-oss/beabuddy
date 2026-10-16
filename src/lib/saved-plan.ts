/**
 * "Build from saved places": the saved places a traveller picked, put in a
 * workable order for the trip's days, as a preview that is saved only when
 * they approve it. Pure and free: the order and the times come from the
 * pins' positions (`route-optimize.ts`), not from a model or a router.
 */
import {
  clockToSec,
  distanceM,
  driveSeconds,
  minutesLabel,
  secToClock,
  walkSeconds,
} from "./route-optimize.ts";

export type SavedPace = "relaxed" | "balanced" | "full";
export type SavedAround = "walk" | "mixed" | "transit";

export const PACES: ReadonlyArray<{ id: SavedPace; label: string; perDay: number }> = [
  { id: "relaxed", label: "Relaxed · 1–2 main stops", perDay: 2 },
  { id: "balanced", label: "Balanced · 2–3 main stops", perDay: 3 },
  { id: "full", label: "Full · 4–5 main stops", perDay: 5 },
];

export const AROUND: ReadonlyArray<{ id: SavedAround; label: string }> = [
  { id: "walk", label: "Prefer walking · Allow breaks" },
  { id: "mixed", label: "Walk what's close · Ride the rest" },
  { id: "transit", label: "Mostly transit · Short walks" },
];

export type SavedPick = {
  id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
};

export type PlannedStop = {
  id: string;
  name: string;
  /** "09:00". */
  start: string;
  /** "11:00". */
  end: string;
  stayMinutes: number;
  /** Getting here from the stop before; null for the day's first. */
  travel: { minutes: number; metres: number; mode: "walk" | "ride" } | null;
};

export type PlannedDay = { date: string | null; stops: PlannedStop[] };

/** Where in the morning the first stop starts. */
export const DAY_START = "09:00";
/** A pause after each visit, so a plan is not back-to-back. */
export const BUFFER_MIN = 15;

/** How long a visit usually lasts, by what the place is. */
export function stayFor(category: string | null): number {
  const c = (category ?? "").toLowerCase();
  if (/museum|gallery|palace|castle|temple|market|park|garden/.test(c)) return 120;
  if (/restaurant|trattoria|dinner|lunch|meal|bistro/.test(c)) return 75;
  if (/caf[eé]|coffee|bakery|bar|pub|gelato/.test(c)) return 45;
  if (/landmark|square|piazza|monument|viewpoint|church|bridge/.test(c)) return 60;
  return 60;
}

const pinned = (p: SavedPick): p is SavedPick & { lat: number; lon: number } =>
  p.lat != null && p.lon != null;

/** Nearest next stop each time, from the first pick; unpinned ones keep their order at the end. */
export function orderByDistance(picks: readonly SavedPick[]): SavedPick[] {
  const placed = picks.filter(pinned);
  const rest = picks.filter((p) => !pinned(p));
  if (placed.length < 2) return [...placed, ...rest];
  const left = [...placed];
  const out = [left.shift()!];
  while (left.length) {
    const at = out[out.length - 1] as (typeof placed)[number];
    let best = 0;
    let bestM = Infinity;
    left.forEach((p, i) => {
      const m = distanceM(at, p);
      if (m < bestM) {
        bestM = m;
        best = i;
      }
    });
    out.push(left.splice(best, 1)[0]!);
  }
  return [...out, ...rest];
}

/** Minutes and way of getting between two pins. */
export function hop(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  around: SavedAround,
): { minutes: number; metres: number; mode: "walk" | "ride" } {
  const metres = Math.round(distanceM(a, b));
  const limit = around === "walk" ? 3_000 : around === "mixed" ? 1_500 : 800;
  const walk = metres <= limit;
  const seconds = walk ? walkSeconds(metres) : driveSeconds(metres);
  return { minutes: Math.max(1, Math.round(seconds / 60)), metres, mode: walk ? "walk" : "ride" };
}

/**
 * The picks over the given days: the pace's number of main stops a day,
 * nearest first, times counted from `DAY_START` with each travel and a
 * buffer. `days` are the trip's dates (null for an undated trip's one day);
 * picks beyond the last day stay on it, so nothing is dropped.
 */
export function planSaved(
  picks: readonly SavedPick[],
  days: readonly (string | null)[],
  pace: SavedPace,
  around: SavedAround,
): PlannedDay[] {
  const perDay = PACES.find((p) => p.id === pace)!.perDay;
  const dates = days.length ? days : [null];
  const ordered = orderByDistance(picks);
  const out: PlannedDay[] = dates.map((date) => ({ date, stops: [] }));
  const dayCount = Math.min(dates.length, Math.max(1, Math.ceil(ordered.length / perDay)));
  const used = out.slice(0, dayCount);
  ordered.forEach((pick, i) => {
    const slot = Math.min(used.length - 1, Math.floor(i / perDay));
    used[slot]!.stops.push({
      id: pick.id,
      name: pick.name,
      start: "",
      end: "",
      stayMinutes: stayFor(pick.category),
      travel: null,
    });
  });
  const byId = new Map(picks.map((p) => [p.id, p]));
  for (const day of used) {
    let clock = clockToSec(DAY_START) ?? 9 * 3600;
    day.stops.forEach((stop, i) => {
      const here = byId.get(stop.id);
      const before = i > 0 ? byId.get(day.stops[i - 1]!.id) : undefined;
      if (before && here && pinned(before) && pinned(here)) {
        stop.travel = hop(before, here, around);
        clock += stop.travel.minutes * 60;
      }
      stop.start = secToClock(clock);
      clock += stop.stayMinutes * 60;
      stop.end = secToClock(clock);
      clock += BUFFER_MIN * 60;
    });
  }
  return used.filter((d) => d.stops.length > 0);
}

/** "15 min walk · 700 m", the line under a travel gap. */
export function hopLine(t: NonNullable<PlannedStop["travel"]>): string {
  const dist = t.metres >= 1_000 ? `${(t.metres / 1_000).toFixed(1)} km` : `${t.metres} m`;
  return `${minutesLabel(t.minutes * 60)} ${t.mode} · ${dist}`;
}
