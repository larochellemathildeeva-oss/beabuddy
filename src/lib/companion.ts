/**
 * Where you are in a day, and what is next.
 *
 * Progress is manual: the traveller taps "I'm here" on arrival and "Leaving"
 * on the way out. Nothing is inferred from the clock. A clock-driven view
 * needs every stop to carry a time, which most do not; it goes wrong the
 * moment anyone runs late; and it records what was planned rather than what
 * happened. A tap needs none of that and is true by construction.
 *
 * Everything here is pure, so the view can be tested without a database or a
 * browser. The route reads `arrived_at` / `left_at` from the rows and hands
 * them in; the writes that change them live in the trip board.
 */

import type { RouteLeg } from "./directions.functions.ts";
import { isSavedDirectionItem } from "./direction-stops.ts";
import { isTravelLeg } from "./import-stop.ts";
import { timeForRail } from "./timeline-kind.ts";

export type CompanionStop = {
  id: string;
  title: string;
  kind?: string | null;
  time_label?: string | null;
  arrived_at?: string | null;
  left_at?: string | null;
  planned_stay_minutes?: number | null;
};

/**
 * The places in a day, without the Walk / Drive rows that saved directions
 * add between them, or journeys a plan wrote as rows of their own ("Travel
 * to Peace Memorial Park"). Those are the way between stops, not somewhere
 * to arrive, and counting them would make every other "up next" a walk.
 */
export function companionStops<T extends CompanionStop>(items: readonly T[]): T[] {
  return items.filter(
    (item) =>
      item.title.trim() &&
      !isSavedDirectionItem(item) &&
      !isTravelLeg({ kind: item.kind ?? "", title: item.title }),
  );
}

export type CompanionPhase =
  /** Nothing marked yet today. */
  | "not-started"
  /** Arrived somewhere and not yet left it. */
  | "at"
  /** Left the last place, not yet arrived at the next. */
  | "between"
  /** Every stop after the furthest one reached has been reached or passed. */
  | "done";

export type CompanionState<T extends CompanionStop> = {
  phase: CompanionPhase;
  /** Where you are, while `phase` is "at". */
  current: T | null;
  /** Where you left most recently, while `phase` is "between". */
  previous: T | null;
  /** The next place you have not reached, after the furthest you have. */
  next: T | null;
  /** How many stops have an arrival, out of all of them. */
  reached: number;
  total: number;
};

function time(value: string | null | undefined): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? t : -Infinity;
}

/**
 * Read the day's progress off its stops.
 *
 * "Next" is the first unreached stop *after the furthest one reached*, not
 * the first unreached stop overall. Skipping the museum to go straight to
 * lunch means the museum is behind you; offering it as "up next" would send
 * you backwards through a day you have already rearranged on your feet.
 */
export function companionState<T extends CompanionStop>(stops: readonly T[]): CompanionState<T> {
  const total = stops.length;
  const reached = stops.filter((s) => s.arrived_at).length;

  // Still there: arrived and not left. If two are open (two phones, or an
  // arrival tapped without leaving), the most recent arrival is where you are.
  let current: T | null = null;
  for (const stop of stops) {
    if (stop.arrived_at && !stop.left_at && time(stop.arrived_at) >= time(current?.arrived_at)) {
      current = stop;
    }
  }

  let furthest = -1;
  stops.forEach((stop, i) => {
    if (stop.arrived_at) furthest = i;
  });
  const anchor = current ? stops.indexOf(current) : furthest;
  const next = stops.slice(anchor + 1).find((s) => !s.arrived_at) ?? null;

  if (current) return { phase: "at", current, previous: null, next, reached, total };
  if (furthest === -1) {
    return { phase: "not-started", current: null, previous: null, next, reached, total };
  }
  if (!next) return { phase: "done", current: null, previous: null, next: null, reached, total };

  // Between places: the one you left last, by when you left it.
  let previous: T | null = null;
  for (const stop of stops) {
    if (stop.left_at && time(stop.left_at) >= time(previous?.left_at)) previous = stop;
  }
  return { phase: "between", current: null, previous, next, reached, total };
}

/** "14:05" → minutes after midnight, or null for anything that is not a clock time. */
export function clockMinutes(timeLabel: string | null | undefined): number | null {
  const rail = timeForRail(timeLabel);
  const m = /^(\d{2}):(\d{2})$/.exec(rail);
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export type LeaveBy =
  | { kind: "time"; at: string; travelMinutes: number; mode: RouteLeg["mode"] }
  /** Same pin at both ends: nothing to travel, so nothing to leave by. */
  | { kind: "same-spot" };

/**
 * When to set off for the next stop: its time, minus the routed journey.
 *
 * Returns null — and the view says nothing — whenever either half is not a
 * real number. No clock time on the next stop ("Morning", or blank); no leg;
 * a leg that was capped before routing or whose ends could not be placed.
 * Those legs have a duration of 0, and "Leave by 14:00" for a 14:00 stop
 * would read as "no travel needed", which is a guess dressed as a fact.
 *
 * Rounded down to the minute, because being told to leave a minute early is
 * harmless and a minute late is not.
 */
export function leaveBy(
  nextTimeLabel: string | null | undefined,
  leg:
    Pick<RouteLeg, "duration" | "mode" | "capped" | "unknownSpot" | "sameSpot"> | null | undefined,
): LeaveBy | null {
  if (!leg) return null;
  if (leg.sameSpot) return { kind: "same-spot" };
  if (leg.capped || leg.unknownSpot) return null;
  if (!(leg.duration > 0)) return null;
  const due = clockMinutes(nextTimeLabel);
  if (due == null) return null;
  const travelMinutes = Math.ceil(leg.duration / 60);
  return { kind: "time", at: formatClock(due - travelMinutes), travelMinutes, mode: leg.mode };
}

/**
 * How long you have been somewhere. Silent without an arrival.
 */
export function stayLine(stop: Pick<CompanionStop, "arrived_at">, now: Date): string | null {
  const since = time(stop.arrived_at);
  if (since === -Infinity) return null;
  const elapsed = Math.max(0, Math.floor((now.getTime() - since) / 60_000));
  const spent =
    elapsed < 60 ? `${elapsed} min` : `${Math.floor(elapsed / 60)} h ${elapsed % 60} min`;
  return `Here ${spent}`;
}

/**
 * The writes for "I'm here" at a stop.
 *
 * Arriving somewhere means you left wherever you were, so an open stop is
 * closed in the same gesture — otherwise two stops would both read as
 * "here". `left_at` is never earlier than that stop's own arrival (another
 * phone's clock may run ahead), because the database refuses it.
 */
export function arrivalWrites(
  stops: readonly CompanionStop[],
  arrivingId: string,
  now: Date,
): { id: string; patch: { arrived_at?: string | null; left_at?: string | null } }[] {
  const writes: { id: string; patch: { arrived_at?: string | null; left_at?: string | null } }[] =
    [];
  for (const stop of stops) {
    if (stop.id === arrivingId || !stop.arrived_at || stop.left_at) continue;
    writes.push({ id: stop.id, patch: { left_at: notBefore(now, stop.arrived_at) } });
  }
  writes.push({ id: arrivingId, patch: { arrived_at: now.toISOString(), left_at: null } });
  return writes;
}

/** The write for "Leaving" at a stop you are at. */
export function leavingWrite(
  stop: CompanionStop,
  now: Date,
): { id: string; patch: { left_at: string } } {
  return { id: stop.id, patch: { left_at: notBefore(now, stop.arrived_at) } };
}

/**
 * Undo an arrival. Both columns clear together: the database refuses a
 * departure with no arrival, so clearing only `arrived_at` would fail.
 */
export function undoArrivalWrite(stop: CompanionStop): {
  id: string;
  patch: { arrived_at: null; left_at: null };
} {
  return { id: stop.id, patch: { arrived_at: null, left_at: null } };
}

function notBefore(now: Date, arrivedAt: string | null | undefined): string {
  const floor = time(arrivedAt);
  return new Date(Math.max(now.getTime(), floor)).toISOString();
}

/**
 * The saved leg from one stop to another, if the download has one.
 *
 * Saved directions are one leg per consecutive pair of the trip's direction
 * stops — the same list `companionStops` makes from the whole timeline — so
 * leg i runs from stop i to stop i + 1. When the next stop is not the one
 * straight after (a stop was skipped), there is no leg for that journey and
 * this says so rather than borrowing a neighbour's.
 */
export function legBetween<L>(
  tripStops: readonly { id: string }[],
  legs: readonly L[] | null | undefined,
  fromId: string,
  toId: string,
): L | null {
  if (!legs) return null;
  const from = tripStops.findIndex((s) => s.id === fromId);
  if (from < 0 || tripStops[from + 1]?.id !== toId) return null;
  return legs[from] ?? null;
}

type Placeable = { lat?: number | null; lon?: number | null };

function isPlaced(point: Placeable): point is { lat: number; lon: number } {
  return (
    typeof point.lat === "number" &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    (point.lat !== 0 || point.lon !== 0)
  );
}

/**
 * Whether Now should route this one journey itself.
 *
 * Only when nothing saved covers it, and only between two stops that are
 * already on the map. Routing by name would mean guessing where a place is,
 * and a "Leave by" built on a guessed pin is the number-over-a-guess this
 * view refuses. Unlike a saved leg, it does not need the stops to be
 * consecutive: it is the journey you are actually about to make.
 */
export function needsLiveLeg(
  savedLeg: unknown,
  from: Placeable | null | undefined,
  to: Placeable | null | undefined,
): boolean {
  return savedLeg == null && from != null && to != null && isPlaced(from) && isPlaced(to);
}

/**
 * One key per journey between two pins, so the same walk is routed once a
 * session however often the view re-renders — and again if either stop moves.
 */
export function liveLegKey(
  from: { id: string } & Placeable,
  to: { id: string } & Placeable,
): string {
  const at = (p: Placeable) => `${p.lat?.toFixed(5)},${p.lon?.toFixed(5)}`;
  return `${from.id}@${at(from)}>${to.id}@${at(to)}`;
}

export type StopStatus =
  /** Reached and moved on from. */
  | "done"
  /** Where you are now. */
  | "here"
  /** Passed without arriving: it sits before the furthest stop reached. */
  | "skipped"
  /** The next place to go. */
  | "next"
  /** Later in the day. */
  | "upcoming";

/**
 * One status per stop, for the journey tracker and the ribbon.
 *
 * Read from the same state as the Now card, so the three never disagree
 * about where you are.
 */
export function stopStatuses<T extends CompanionStop>(stops: readonly T[]): StopStatus[] {
  const state = companionState(stops);
  let furthest = -1;
  stops.forEach((stop, i) => {
    if (stop.arrived_at) furthest = i;
  });
  return stops.map((stop, i) => {
    if (stop === state.current) return "here";
    if (stop.arrived_at) return "done";
    if (stop === state.next) return "next";
    if (i < furthest) return "skipped";
    return "upcoming";
  });
}

export type PartOfDay = "morning" | "afternoon" | "evening";

/**
 * Morning before noon, afternoon before five, evening after. Null for a stop
 * with no clock time ("Lunch"), which the ribbon shows only under All rather
 * than guessing which part of the day it belongs to.
 */
export function partOfDay(timeLabel: string | null | undefined): PartOfDay | null {
  const minutes = clockMinutes(timeLabel);
  if (minutes == null) return null;
  if (minutes < 12 * 60) return "morning";
  if (minutes < 17 * 60) return "afternoon";
  return "evening";
}

/** Arrived and left: the stop is behind you. */
export function isDone(stop: Pick<CompanionStop, "arrived_at" | "left_at">): boolean {
  return Boolean(stop.arrived_at && stop.left_at);
}

/**
 * The write for marking a stop done from the day list, or undoing that.
 *
 * Done means arrived and left, the same record "I'm here" and "Leaving"
 * make, so a swipe on the Day tab and taps on Now tell one story. An
 * arrival already recorded is kept. `undo` puts back exactly what was there.
 */
export function toggleDoneWrite(
  stop: CompanionStop,
  now: Date,
): {
  id: string;
  patch: { arrived_at: string | null; left_at: string | null };
  undo: { arrived_at: string | null; left_at: string | null };
} {
  const undo = { arrived_at: stop.arrived_at ?? null, left_at: stop.left_at ?? null };
  if (isDone(stop)) return { id: stop.id, patch: { arrived_at: null, left_at: null }, undo };
  const arrived = stop.arrived_at ?? now.toISOString();
  return { id: stop.id, patch: { arrived_at: arrived, left_at: notBefore(now, arrived) }, undo };
}

/**
 * A time halfway between two stops, for a stop added between them. Empty
 * unless both have a clock time: halfway between "Lunch" and 15:00 is not a
 * time anyone wrote down.
 */
export function midpointTime(
  before: string | null | undefined,
  after: string | null | undefined,
): string {
  const a = clockMinutes(before);
  const b = clockMinutes(after);
  if (a == null || b == null || b <= a) return "";
  return formatClock(Math.round((a + b) / 2 / 5) * 5);
}
