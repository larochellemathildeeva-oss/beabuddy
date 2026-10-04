import type { RouteLeg } from "./directions.functions.ts";
import { hasCoords, type DirectionStop } from "./direction-stops.ts";
import { haversine } from "./geo.ts";
import { plannedRideSeconds } from "./route-estimate.ts";
import { savedLegStillFits } from "./timeline-directions.ts";
import { legModeFor, type TravelChoice } from "./travel-mode.ts";

/**
 * A journey Béa already has between two neighbouring stops: worked out on
 * this screen, kept on the phone, or saved on the timeline (`onTimeline`).
 */
export type KnownLeg = { leg: RouteLeg; onTimeline: boolean };

/** A pin moved further than this is a new journey. */
const MOVED_M = 50;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Whether a leg found by its place in the list is really the journey from
 * `from` to `to`. Legs are matched by position, so after a stop is added or
 * moved the leg at a position can belong to the old neighbours — "previous
 * stop → hotel" shown, timed and opened in Maps for "hotel → next stop".
 * A row saved before it kept where it leaves from names only where it goes.
 */
export function legDescribes(
  leg: Pick<RouteLeg, "from" | "to" | "fromLat" | "fromLon" | "toLat" | "toLon">,
  from: DirectionStop,
  to: DirectionStop,
): boolean {
  if (!sameName(leg.to, to.title)) return false;
  if (leg.from.trim() && !sameName(leg.from, from.title)) return false;
  // Two stops can share a name; the pins the leg was routed between tell them apart.
  const atEnd = (lat: number | undefined, lon: number | undefined, stop: DirectionStop) =>
    lat == null || lon == null || !hasCoords(stop) || haversine({ lat, lon }, stop) <= MOVED_M;
  return atEnd(leg.fromLat, leg.fromLon, from) && atEnd(leg.toLat, leg.toLon, to);
}

/**
 * Whether a journey worked out before still describes the way from `from` to
 * `to`, travelling as chosen now. Adding one stop used to send the whole trip
 * to be looked up and routed again; journeys that still hold are kept, so only
 * the new and changed ones are asked.
 */
export function legStillHolds(
  leg: RouteLeg,
  from: DirectionStop,
  to: DirectionStop,
  travel: TravelChoice,
): boolean {
  // Never worked out: Béa stopped looking before it got there.
  if (leg.capped) return false;
  // A row saved before it kept where it leaves from may be another journey.
  if (!leg.from.trim() || !sameName(leg.from, from.title) || !sameName(leg.to, to.title)) {
    return false;
  }
  // "Exact spot unknown" is out of date once both stops are on the map.
  if (!savedLegStillFits(leg, from, to)) return false;
  // Each end where the journey had it: a pin moved or cleared since, or one
  // the journey cannot vouch for, is a new journey.
  const sameEnd = (lat: number | undefined, lon: number | undefined, stop: DirectionStop) =>
    lat == null || lon == null
      ? !hasCoords(stop)
      : hasCoords(stop) && haversine({ lat, lon }, stop) <= MOVED_M;
  if (!sameEnd(leg.fromLat, leg.fromLon, from) || !sameEnd(leg.toLat, leg.toLon, to)) return false;
  if (leg.sameSpot || leg.unknownSpot || leg.farApartKm != null) return true;
  if (!hasCoords(from) || !hasCoords(to)) return false;
  // Asked by another way of getting around than the one chosen now.
  const straight = haversine(from, to);
  const expected = legModeFor(travel, straight);
  if (leg.mode === expected) return true;
  // A timed ride between stations, which Béa takes only when transit is
  // chosen or the choice is left to her (as buildRoutes does).
  const rideAllowed = travel === "auto" || travel === "transit" || expected === "transit";
  return leg.mode === "transit" && rideAllowed && plannedRideSeconds(from, to) != null;
}

/**
 * A journey saved on the timeline keeps only where it arrives. Where it left
 * from is where the journey before it arrived, when that one led to this stop.
 */
function withStart(
  known: KnownLeg | undefined,
  before: KnownLeg | undefined,
  from: DirectionStop,
): KnownLeg | undefined {
  if (!known || known.leg.fromLat != null) return known;
  const prev = before?.leg;
  if (!prev || prev.toLat == null || prev.toLon == null || !sameName(prev.to, from.title)) {
    return known;
  }
  return { ...known, leg: { ...known.leg, fromLat: prev.toLat, fromLon: prev.toLon } };
}

/**
 * The journeys to keep, by leg (leg `i` runs from stop `i` to stop `i + 1`),
 * and the legs still to work out. When every journey still holds, all of them
 * are asked: pressing the button again is how a traveller refreshes them.
 */
export function directionsToAsk(
  stops: readonly DirectionStop[],
  known: readonly (KnownLeg | undefined)[],
  travel: TravelChoice,
): { keep: (KnownLeg | undefined)[]; ask: number[] } {
  const count = Math.max(0, stops.length - 1);
  const keep: (KnownLeg | undefined)[] = [];
  const ask: number[] = [];
  for (let i = 0; i < count; i++) {
    const k = withStart(known[i], known[i - 1], stops[i]!);
    if (k && legStillHolds(k.leg, stops[i]!, stops[i + 1]!, travel)) keep.push(k);
    else {
      keep.push(undefined);
      ask.push(i);
    }
  }
  if (ask.length === 0) return { keep: keep.map(() => undefined), ask: keep.map((_, i) => i) };
  return { keep, ask };
}

/**
 * The kept journeys with the new ones put in their places, one per leg, or
 * null when a leg is missing (the answer did not cover what was asked).
 */
export function mergeLegs(
  keep: readonly (KnownLeg | undefined)[],
  at: readonly number[],
  fresh: readonly RouteLeg[],
): RouteLeg[] | null {
  const legs = keep.map((k) => k?.leg);
  at.forEach((index, n) => {
    const leg = fresh[n];
    if (leg && index < legs.length) legs[index] = leg;
  });
  return legs.every((leg) => leg !== undefined) ? (legs as RouteLeg[]) : null;
}
