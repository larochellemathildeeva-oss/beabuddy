/**
 * Rearranging a trip on travel times rather than on names.
 *
 * Optimize used to hand the model a list of titles and coordinates and ask it
 * to cluster them. A model reading "35.0116,135.7681" cannot tell a four-
 * minute walk from a forty-minute one, so "Closest together" was a guess
 * presented as a plan. Now both halves work from travel times:
 *
 * - Which day: every pair of pinned stops in a place is timed, and the model
 *   is shown each stop's nearest neighbours in minutes.
 * - Which order, and when: for "Open when you get there", each day is then
 *   solved here, exactly, from those times and the opening hours Place
 *   Details knows. A museum that opens at 10:00 is not visited at 09:00.
 *
 * The times are estimated from the pins' positions — straight-line distance,
 * stretched for streets, at walking pace or a city drive — not bought from a
 * router. Geoapify's Route Matrix measured them for real, but at locations ×
 * min(locations, 10) credits, a single Optimize could spend a sixth of the
 * day's free allowance. For choosing which stops share a day and in what
 * order, the estimate points the same way, and costs nothing. Directions,
 * when asked for, still come from the router.
 *
 * Why not Geoapify's Route Planner for the second half, for the same reason:
 * it is priced like a matrix over every location, for each day, and is built
 * for fleets. One traveller with at most twelve stops a day is small enough
 * to try every order.
 *
 * This file is the pure part — grouping, estimates, prompts, tallies and the
 * day solver — so every rule is tested. The only lookup Optimize still makes,
 * opening hours, is in `route-optimize.server.ts`.
 */
import { openWindowsOn } from "./opening-hours.ts";
import { timelineGlyph } from "./timeline-kind.ts";

export type OptStop = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  lat: number | null;
  lon: number | null;
  planned_stay_minutes?: number | null | undefined;
};

type Pinned = OptStop & { lat: number; lon: number };

/** How a place's stops are timed: on foot, or by car when it is too spread out to walk. */
export type TravelMode = "walk" | "drive";

export const isPinned = (s: OptStop): s is Pinned =>
  typeof s.lat === "number" &&
  typeof s.lon === "number" &&
  Number.isFinite(s.lat) &&
  Number.isFinite(s.lon);

/** Stops further apart than this are in different places, not one day's walk. */
export const CLUSTER_KM = 25;
/** Most stops timed against each other in one place; the rest go unmeasured. */
export const ESTIMATE_MAX_STOPS = 60;
/** A group of stops spread wider than this is driven between, not walked. */
export const WALK_SPAN_M = 4_000;
/** Most stops ordered in one day: 2¹² orders to weigh, a few milliseconds. */
export const PLANNER_MAX_JOBS = 12;
/** A short hop is walked, even in a place whose stops are timed by car. */
export const WALK_HOP_M = 1_500;
/**
 * Directions walk a journey shorter than this and drive a longer one
 * (directions.functions.ts). The route check asks the router the same way,
 * so the journeys it buys are the ones directions will want — and are free
 * to them through the shared cache.
 */
export const DIRECTIONS_WALK_M = 3_000;

export function distanceM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Stops grouped by place: two stops share a group when a chain of stops each
 * within `km` of the next joins them. Kyoto and Osaka on one trip become two
 * groups, and the drive between them is never counted as a day's travel.
 */
export function clusterStops<T extends { lat: number; lon: number }>(
  stops: readonly T[],
  km = CLUSTER_KM,
): T[][] {
  const limit = km * 1000;
  const group = stops.map((_, i) => i);
  const root = (i: number): number => (group[i] === i ? i : (group[i] = root(group[i]!)));
  for (let i = 0; i < stops.length; i++) {
    for (let j = i + 1; j < stops.length; j++) {
      if (distanceM(stops[i]!, stops[j]!) <= limit) group[root(j)] = root(i);
    }
  }
  const out = new Map<number, T[]>();
  stops.forEach((s, i) => {
    const r = root(i);
    const list = out.get(r) ?? [];
    list.push(s);
    out.set(r, list);
  });
  return [...out.values()];
}

/** Walk when every stop is within a walk of every other; otherwise drive. */
export function modeFor(points: readonly { lat: number; lon: number }[]): TravelMode {
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (distanceM(points[i]!, points[j]!) > WALK_SPAN_M) return "drive";
    }
  }
  return "walk";
}

/** Travel times between the stops of one place, in seconds; `[i][j]` is i to j. */
export type TravelTable = {
  ids: string[];
  mode: TravelMode;
  seconds: (number | null)[][];
};

/**
 * Travel times between the pinned stops of each place, estimated from their
 * positions: one table per group of two or more, in trip order, each timed
 * on foot when the whole place is walkable and by car otherwise — short hops
 * are walked either way. Free, and the same every time for the same pins.
 */
export function estimatedTables(stops: readonly OptStop[]): TravelTable[] {
  const seen = new Set<string>();
  const pinned = stops.filter(isPinned).filter((s) => !seen.has(s.id) && seen.add(s.id));
  return clusterStops(pinned)
    .filter((g) => g.length >= 2)
    .map((g) => {
      const group = g.slice(0, ESTIMATE_MAX_STOPS);
      const mode = modeFor(group);
      return {
        ids: group.map((s) => s.id),
        mode,
        seconds: group.map((a) =>
          group.map((b) => {
            const metres = distanceM(a, b);
            if (metres < 1) return 0;
            return mode === "walk" || metres <= WALK_HOP_M
              ? walkSeconds(metres)
              : driveSeconds(metres);
          }),
        ),
      };
    });
}

export function minutesLabel(seconds: number): string {
  const m = Math.max(1, Math.round(seconds / 60));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/**
 * For the model: each stop's nearest few by estimated travel time. A full table
 * would be n² numbers the model skims; nearest neighbours are what
 * clustering actually needs, and a short line each is read properly.
 */
export function neighbourLines(tables: readonly TravelTable[], perStop = 3): string[] {
  const lines: string[] = [];
  for (const t of tables) {
    const how = t.mode === "walk" ? "on foot" : "by car";
    t.ids.forEach((id, i) => {
      const near = t.ids
        .map((other, j) => ({ other, s: t.seconds[i]?.[j] ?? null, j }))
        .filter((x): x is { other: string; s: number; j: number } => x.j !== i && x.s != null)
        .sort((a, b) => a.s - b.s)
        .slice(0, perStop);
      if (!near.length) return;
      lines.push(
        `- id=${id}: ${near.map((x) => `~${minutesLabel(x.s)} to id=${x.other}`).join(", ")} (${how})`,
      );
    });
  }
  return lines;
}

/**
 * Time spent getting from each stop to the next within the same day, over
 * the whole trip, counting only pairs a table covers. Undated stops are not
 * a day and are left out. `pairs` says how much of the trip the total speaks
 * for, so a tally of nothing is never shown as "0 min".
 */
export function travelTotal(
  tables: readonly TravelTable[],
  ordered: readonly Pick<OptStop, "id" | "day_date">[],
): { seconds: number; pairs: number } {
  const where = new Map<string, { t: TravelTable; i: number }>();
  for (const t of tables) t.ids.forEach((id, i) => where.set(id, { t, i }));
  let seconds = 0;
  let pairs = 0;
  let prev: { t: TravelTable; i: number; day: string } | null = null;
  for (const stop of ordered) {
    const here = where.get(stop.id);
    if (!here || !stop.day_date) continue;
    if (prev && prev.day === stop.day_date && prev.t === here.t) {
      const s = here.t.seconds[prev.i]?.[here.i];
      if (s != null) {
        seconds += s;
        pairs += 1;
      }
    }
    prev = { ...here, day: stop.day_date };
  }
  return { seconds, pairs };
}

/** One journey in a day: a pinned stop to the next pinned stop, in the same place. */
export type Leg = {
  day: string;
  from: Place & { id: string };
  to: Place & { id: string };
  mode: TravelMode;
  /** The map's estimate, in seconds. */
  estimate: number;
};

export const legKey = (from: string, to: string) => `${from}>${to}`;

/**
 * The journeys a trip makes in this order, day by day — the same pairs
 * `travelTotal` counts — each with how directions would travel it: walked
 * under `DIRECTIONS_WALK_M`, driven beyond.
 */
export function legsOf(tables: readonly TravelTable[], ordered: readonly OptStop[]): Leg[] {
  const where = new Map<string, { t: TravelTable; i: number }>();
  for (const t of tables) t.ids.forEach((id, i) => where.set(id, { t, i }));
  const legs: Leg[] = [];
  let prev: { t: TravelTable; i: number; day: string; stop: Pinned } | null = null;
  for (const stop of ordered) {
    const here = where.get(stop.id);
    if (!here || !stop.day_date || !isPinned(stop)) continue;
    if (prev && prev.day === stop.day_date && prev.t === here.t) {
      const estimate = here.t.seconds[prev.i]?.[here.i];
      if (estimate != null) {
        const from = { id: prev.stop.id, lat: prev.stop.lat, lon: prev.stop.lon };
        const to = { id: stop.id, lat: stop.lat, lon: stop.lon };
        legs.push({
          day: stop.day_date,
          from,
          to,
          mode: distanceM(from, to) < DIRECTIONS_WALK_M ? "walk" : "drive",
          estimate,
        });
      }
    }
    prev = { ...here, day: stop.day_date, stop };
  }
  return legs;
}

/** A checked journey this much longer than its estimate means the map misled. */
export const SURPRISE_RATIO = 1.5;
export const SURPRISE_MIN_SEC = 10 * 60;

/** Whether the real route is so much longer than the map suggested that the day should be looked at again. */
export function isSurprise(estimate: number, real: number): boolean {
  return real > estimate * SURPRISE_RATIO && real - estimate > SURPRISE_MIN_SEC;
}

/** Travel times with the checked journeys put in, either way round. */
export function withChecked(travel: TravelTime, checked: ReadonlyMap<string, number>): TravelTime {
  return (from, to) => {
    if (from.id && to.id) {
      const real = checked.get(legKey(from.id, to.id)) ?? checked.get(legKey(to.id, from.id));
      if (real != null) return real;
    }
    return travel(from, to);
  };
}

/** The journeys' total on real routes, or null unless every one was checked. */
export function checkedTotal(
  legs: readonly Leg[],
  checked: ReadonlyMap<string, number>,
): number | null {
  let seconds = 0;
  for (const leg of legs) {
    const real = checked.get(legKey(leg.from.id, leg.to.id));
    if (real == null) return null;
    seconds += real;
  }
  return legs.length ? seconds : null;
}

const FIXED_KINDS = new Set(["flight", "hotel", "reservation", "lodging"]);

/** A stop the planner may move: pinned, a place to visit, not booked or travel. */
export function isMovable(s: OptStop): s is Pinned {
  if (!isPinned(s)) return false;
  if (FIXED_KINDS.has(s.kind.trim().toLowerCase())) return false;
  const glyph = timelineGlyph(s);
  return glyph !== "lodging" && glyph !== "transport" && glyph !== "note";
}

/** How long a visit lasts: what the stop says, else a usual length for its kind. */
export function stayMinutes(s: OptStop): number {
  const set = s.planned_stay_minutes;
  if (typeof set === "number" && Number.isFinite(set) && set > 0) return Math.min(set, 8 * 60);
  switch (timelineGlyph(s)) {
    case "meal":
      return 75;
    case "walk":
      return 45;
    default:
      return 90;
  }
}

/** "09:30" → seconds after midnight, or null. */
export function clockToSec(label: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((label ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 3600 + mi * 60;
}

/**
 * Seconds after midnight → "HH:MM", rounded up to five minutes: a visit
 * planned for 10:02 is written 10:05, never 10:00, which could be before
 * the door opens.
 */
export function secToClock(sec: number): string {
  const five = Math.ceil(Math.max(0, sec) / 300) * 300;
  const capped = Math.min(five, 23 * 3600 + 55 * 60);
  const h = Math.floor(capped / 3600);
  const m = Math.floor((capped % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * When a visit may start, from the day's open stretches in minutes: each
 * stretch ends early enough for the whole visit to fit. Null hours (unknown)
 * mean any time; "closed" means none — shut all day, or open too briefly.
 */
export function visitWindows(
  open: [number, number][] | null,
  durationSec: number,
): [number, number][] | "closed" {
  if (open == null) return [];
  const out: [number, number][] = [];
  for (const [a, b] of open) {
    const from = a * 60;
    const until = Math.min(b * 60, 24 * 3600) - durationSec;
    if (until >= from) out.push([from, until]);
  }
  return out.length ? out : "closed";
}

export const DAY_START_SEC = 9 * 3600;
export const DAY_END_SEC = 23 * 3600 + 30 * 60;

/**
 * The hotel a day starts from: a pinned stay on that day, else the latest
 * one before it. Null when the trip has none, and the day starts at its
 * first stop instead.
 */
export function lodgingFor(all: readonly OptStop[], day: string): Place | null {
  let best: Pinned | null = null;
  for (const s of all) {
    if (!isPinned(s) || !s.day_date || s.day_date > day) continue;
    const kind = s.kind.trim().toLowerCase();
    if (kind !== "hotel" && kind !== "lodging" && timelineGlyph(s) !== "lodging") continue;
    if (!best || (s.day_date ?? "") >= (best.day_date ?? "")) best = s;
  }
  return best ? { id: best.id, lat: best.lat, lon: best.lon } : null;
}

/** A point on the map, with the stop it belongs to when it is one. */
export type Place = { id?: string; lat: number; lon: number };

/** Seconds to get from one place to another. */
export type TravelTime = (from: Place, to: Place) => number;

/** Walking pace, with a little for streets not running straight. */
export function walkSeconds(metres: number): number {
  return (metres * 1.3) / 1.25;
}

/** A city drive: slower than the crow flies, and a few minutes to park. */
export function driveSeconds(metres: number): number {
  return 300 + (metres * 1.4) / 8.3;
}

/**
 * Travel times from the tables where they have them, estimated on the spot
 * where they don't: a stop past a table's size, or the hotel if it is not
 * pinned as a stop. A hop short enough to walk is timed on foot even where
 * the place as a whole is timed by car.
 */
export function travelTimeFrom(tables: readonly TravelTable[]): TravelTime {
  const where = new Map<string, { t: TravelTable; i: number }>();
  for (const t of tables) t.ids.forEach((id, i) => where.set(id, { t, i }));
  return (from, to) => {
    const metres = distanceM(from, to);
    if (metres < 1) return 0;
    const x = from.id ? where.get(from.id) : undefined;
    const y = to.id ? where.get(to.id) : undefined;
    const measured = x && y && x.t === y.t ? x.t.seconds[x.i]?.[y.i] : null;
    if (metres <= WALK_HOP_M && (measured == null || x!.t.mode === "drive")) {
      return walkSeconds(metres);
    }
    if (measured != null) return measured;
    return metres <= WALK_SPAN_M ? walkSeconds(metres) : driveSeconds(metres);
  };
}

/** A stop to fit into the day, times in seconds after that day's midnight. */
export type DayJob = Place & {
  id: string;
  durationSec: number;
  /** When the visit may start. Empty means any time the day allows. */
  windows: [number, number][];
};

/** Something fixed at a time: a booked lunch, a train, a timed unpinned stop. */
export type DayAnchor = {
  id: string;
  at: number;
  durationSec: number;
  /** Where it is, so the day includes getting there; null when unpinned. */
  place: Place | null;
};

export type DayProblem = {
  /** Where the day starts (the hotel, or the first stop), and ends if given. */
  start: Place;
  end?: Place | undefined;
  /** The part of the day to fill. */
  dayWindow: [number, number];
  anchors: DayAnchor[];
  jobs: DayJob[];
};

/** The solved day: visits in order with their start, and what did not fit. */
export type PlannedDay = {
  visits: { jobIndex: number; startSec: number }[];
  unassigned: number[];
};

export type DayRequest = {
  day: DayProblem;
  /** Stop id for each planner job, by job index. */
  jobIds: string[];
  /** Movable stops listed as closed that day; they stay where they were. */
  closedIds: string[];
};

/**
 * One day, in the order the model left it, as a problem to solve — or null
 * when there are fewer than two stops to order.
 *
 * Fixed things with a time (a booked lunch, a train, an unpinned stop the
 * model timed) become anchors: the day goes to them at their time, from
 * wherever it is, and carries on from there. They keep their own times.
 */
export function dayRequest(
  dayItems: readonly OptStop[],
  opts: {
    date: string;
    lodging: Place | null;
    /** Open stretches that day in minutes, per stop id; absent or null = unknown. */
    openById: ReadonlyMap<string, [number, number][] | null>;
  },
): DayRequest | null {
  const movable = dayItems.filter(isMovable).slice(0, PLANNER_MAX_JOBS);
  const moving = new Set(movable.map((s) => s.id));
  const jobs: DayJob[] = [];
  const jobIds: string[] = [];
  const closedIds: string[] = [];
  for (const s of movable) {
    const durationSec = stayMinutes(s) * 60;
    const windows = visitWindows(opts.openById.get(s.id) ?? null, durationSec);
    if (windows === "closed") {
      closedIds.push(s.id);
      continue;
    }
    jobs.push({ id: s.id, lat: s.lat, lon: s.lon, durationSec, windows });
    jobIds.push(s.id);
  }
  if (jobs.length < 2) return null;

  const firstTimed = movable
    .map((s) => clockToSec(s.time_label))
    .filter((t): t is number => t != null)
    .sort((a, b) => a - b)[0];
  const start = firstTimed ?? DAY_START_SEC;
  const dayWindow: [number, number] = [start, Math.max(start + 3600, DAY_END_SEC)];

  const anchors: DayAnchor[] = [];
  for (const s of dayItems) {
    if (moving.has(s.id) && !closedIds.includes(s.id)) continue;
    if (timelineGlyph(s) === "note") continue;
    const at = clockToSec(s.time_label);
    if (at == null || at < dayWindow[0] || at >= dayWindow[1]) continue;
    anchors.push({
      id: s.id,
      at,
      durationSec: stayMinutes(s) * 60,
      place: isPinned(s) ? { id: s.id, lat: s.lat, lon: s.lon } : null,
    });
  }
  anchors.sort((a, b) => a.at - b.at);

  const first = jobs[0]!;
  const home = opts.lodging;
  return {
    day: {
      start: home ?? { id: first.id, lat: first.lat, lon: first.lon },
      ...(home ? { end: home } : {}),
      dayWindow,
      anchors,
      jobs,
    },
    jobIds,
    closedIds,
  };
}

export type DayOutcome = {
  /** The day's stops in their new order, with the time each is now at. */
  order: { id: string; time_label: string | null }[];
  /** A short reason for any stop the planner could not place. */
  notes: Map<string, string>;
};

/** Late for a fixed thing by more than this, and the order that caused it is not used. */
export const ANCHOR_SLACK_SEC = 10 * 60;

/** The earliest a visit can start once there, inside its windows; null if none is left. */
function earliestStart(arrive: number, windows: readonly [number, number][]): number | null {
  if (!windows.length) return arrive;
  for (const [from, until] of windows) if (arrive <= until) return Math.max(arrive, from);
  return null;
}

/**
 * The best order for the day, tried exhaustively: as many stops as fit
 * inside their hours, then the day that finishes soonest (back at the hotel
 * when there is one), which is the one with the least travel and waiting.
 *
 * Held-Karp over subsets — for each set of stops done and the last one, the
 * earliest the traveller can be free — so twelve stops is 4,096 × 12 states,
 * not 12! orders. Anchors are kept in time order: before each visit, if doing
 * it would make the traveller late for the next anchor, they go to the anchor
 * first. Keeping only the earliest-free state is exact without anchors
 * (arriving earlier never makes a later visit impossible); with them it is a
 * close approximation, since two states can differ in which anchors are
 * behind them.
 */
export function solveDay(problem: DayProblem, travel: TravelTime): PlannedDay {
  const { jobs, anchors } = problem;
  const n = jobs.length;
  const [dayStart, dayEnd] = problem.dayWindow;

  type State = { time: number; next: number; start: number; prev: number };
  const states = new Map<number, State>();
  const key = (mask: number, last: number) => mask * n + last;

  /** Leave `from` at `time` with anchors from `next` pending, and do job `j`. */
  const visit = (time: number, from: Place, next: number, j: number) => {
    const job = jobs[j]!;
    let t = time;
    let at = from;
    let k = next;
    for (;;) {
      const start = earliestStart(t + travel(at, job), job.windows);
      if (start == null) return null;
      const end = start + job.durationSec;
      const anchor = anchors[k];
      const onTime =
        !anchor ||
        end + (anchor.place ? travel(job, anchor.place) : 0) <= anchor.at + ANCHOR_SLACK_SEC;
      if (onTime) return end > dayEnd ? null : { time: end, next: k, start };
      // Go to the fixed thing first, then try the visit again from there.
      const arrive = t + (anchor.place ? travel(at, anchor.place) : 0);
      t = Math.max(arrive, anchor.at) + anchor.durationSec;
      if (anchor.place) at = anchor.place;
      k += 1;
    }
  };

  for (let j = 0; j < n; j++) {
    const r = visit(dayStart, problem.start, 0, j);
    if (r) states.set(key(1 << j, j), { ...r, prev: -1 });
  }
  for (let mask = 1; mask < 1 << n; mask++) {
    for (let last = 0; last < n; last++) {
      const s = states.get(key(mask, last));
      if (!s) continue;
      for (let j = 0; j < n; j++) {
        if (mask & (1 << j)) continue;
        const r = visit(s.time, jobs[last]!, s.next, j);
        if (!r) continue;
        const k = key(mask | (1 << j), j);
        const seen = states.get(k);
        if (!seen || r.time < seen.time) states.set(k, { ...r, prev: key(mask, last) });
      }
    }
  }

  let best: { k: number; count: number; finish: number } | null = null;
  for (const [k, s] of states) {
    const mask = Math.floor(k / n);
    const last = k % n;
    let count = 0;
    for (let m = mask; m; m &= m - 1) count += 1;
    const finish = s.time + (problem.end ? travel(jobs[last]!, problem.end) : 0);
    if (!best || count > best.count || (count === best.count && finish < best.finish)) {
      best = { k, count, finish };
    }
  }

  const visits: PlannedDay["visits"] = [];
  for (let k = best?.k ?? -1; k >= 0;) {
    const s = states.get(k)!;
    visits.unshift({ jobIndex: k % n, startSec: s.start });
    k = s.prev;
  }
  const done = new Set(visits.map((v) => v.jobIndex));
  const unassigned = jobs.map((_, i) => i).filter((i) => !done.has(i));
  return { visits, unassigned };
}

/** Most days ordered in one Optimize. */
export const PLANNER_MAX_DAYS = 31;

/**
 * Each dated day of `ordered` (the model's arrangement) put in its best
 * order around opening hours. Days with fewer than two stops to order are
 * absent, and keep the model's order.
 */
export function planDays(
  ordered: readonly OptStop[],
  all: readonly OptStop[],
  hours: ReadonlyMap<string, string>,
  travel: TravelTime,
): Map<string, DayOutcome> {
  const byDay = new Map<string, OptStop[]>();
  for (const s of ordered) {
    if (!s.day_date) continue;
    const list = byDay.get(s.day_date) ?? [];
    list.push(s);
    byDay.set(s.day_date, list);
  }
  const out = new Map<string, DayOutcome>();
  for (const [date, dayItems] of [...byDay].slice(0, PLANNER_MAX_DAYS)) {
    const openById = new Map<string, [number, number][] | null>();
    for (const s of dayItems) openById.set(s.id, openWindowsOn(hours.get(s.id), date));
    const request = dayRequest(dayItems, { date, lodging: lodgingFor(all, date), openById });
    if (!request) continue;
    const planned = solveDay(request.day, travel);
    if (planned.visits.length === 0) continue;
    out.set(date, mergeDay(dayItems, request, planned));
  }
  return out;
}

export const CLOSED_NOTE = "Listed as closed that day — check the hours.";
export const UNFITTED_NOTE = "Couldn't fit it inside its opening hours — kept where it was.";

/**
 * The day with the planner's visits put in: planned stops at their new
 * times, everything else at the time it had. A stop with no time stays just
 * after whatever came before it in the model's order, so notes and untimed
 * stops travel with their neighbour instead of sinking to the end.
 */
export function mergeDay(
  dayItems: readonly OptStop[],
  request: DayRequest,
  planned: PlannedDay,
): DayOutcome {
  const planTime = new Map<string, number>();
  for (const v of planned.visits) {
    const id = request.jobIds[v.jobIndex];
    if (id) planTime.set(id, v.startSec);
  }
  const notes = new Map<string, string>();
  for (const id of request.closedIds) notes.set(id, CLOSED_NOTE);
  for (const i of planned.unassigned) {
    const id = request.jobIds[i];
    if (id) notes.set(id, UNFITTED_NOTE);
  }

  let lastKey = -1;
  const keyed = dayItems.map((s, index) => {
    const planned = planTime.get(s.id);
    const own = clockToSec(s.time_label);
    const at = planned ?? own;
    const key = at ?? lastKey + 0.001;
    lastKey = key;
    const time_label = planned != null ? secToClock(planned) : s.time_label;
    return { id: s.id, time_label, key, index };
  });
  keyed.sort((a, b) => a.key - b.key || a.index - b.index);
  return { order: keyed.map(({ id, time_label }) => ({ id, time_label })), notes };
}
