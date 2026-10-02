import { companionState, clockMinutes, type CompanionStop } from "./companion.ts";
import { haversine } from "./geo.ts";
import type { HereFix } from "./live-location.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import { legModeFor, type LegMode, type TravelChoice } from "./travel-mode.ts";

/**
 * "Follow along" on the Now view: the pure parts.
 *
 * With the traveller's say-so, Now reads the phone's position while it is on
 * screen and offers what the taps would have said: "Looks like you're at the
 * Louvre", "Looks like you've left". It only ever offers. "I'm here" and
 * "Leaving" are saved on the trip, where everyone on it sees them, so they
 * stay a traveller's own tap and never a guess written on their behalf.
 *
 * The position stays on the phone. Nothing here is sent anywhere or kept:
 * the journey time from where you are is the straight-line estimate
 * (route-estimate.ts), worked out here, not asked of a router.
 */

export type FollowStop = CompanionStop & { lat?: number | null; lon?: number | null };

/** A reading less sure than this never suggests an arrival: ±250 m is the whole block. */
export const ARRIVE_ACCURACY_MAX_M = 75;
/** A reading less sure than this never suggests leaving either. */
export const LEAVE_ACCURACY_MAX_M = 150;
/** Within this of a stop, the reading's own doubt allowed for, counts as there. */
export function arriveRadius(accuracy: number): number {
  return Math.min(120, Math.max(50, 40 + accuracy));
}
/** This far from where you are, beyond the reading's doubt, counts as gone. */
export const LEAVE_MARGIN_M = 150;
/** So close, and so sure, that one reading is enough. */
export const SURE_INSIDE_M = 60;
/** Otherwise, readings must agree this long: walking past is not arriving. */
export const DWELL_MS = 60_000;
/**
 * How far ahead an arrival may be: the next stop, or the one after it (a
 * stop skipped). Never a stop behind, and never one at the end of the day
 * just because it happens to be nearer.
 */
export const LOOKAHEAD = 2;
/** A reading less sure than this says nothing about time to the next stop. */
export const ETA_ACCURACY_MAX_M = 500;

export type FollowKind = "arrive" | "leave";

/** What the readings have pointed at, and since when. */
export type Sighting = { kind: FollowKind; stopId: string; since: number } | null;

type Candidate<T> = { kind: FollowKind; stop: T; sure: boolean };

function pinOf(stop: FollowStop): { lat: number; lon: number } | null {
  return stop.lat != null && stop.lon != null ? { lat: stop.lat, lon: stop.lon } : null;
}

/** What one reading points at, before it has lasted. */
export function candidateFor<T extends FollowStop>(
  stops: readonly T[],
  fix: HereFix,
): Candidate<T> | null {
  const state = companionState(stops);
  const current = state.phase === "at" ? state.current : null;
  const currentPin = current ? pinOf(current) : null;
  const atCurrent = currentPin ? haversine(fix, currentPin) : null;

  if (fix.accuracy <= ARRIVE_ACCURACY_MAX_M) {
    const radius = arriveRadius(fix.accuracy);
    // Still within reach of where you are: a shop next door is not an arrival.
    const stillHere = atCurrent != null && atCurrent <= radius;
    if (!stillHere) {
      let anchor = current ? stops.indexOf(current) : -1;
      if (!current) stops.forEach((s, i) => s.arrived_at && (anchor = i));
      const ahead = stops
        .slice(anchor + 1)
        .filter((s) => !s.arrived_at)
        .slice(0, LOOKAHEAD);
      let best: { stop: T; metres: number } | null = null;
      for (const stop of ahead) {
        const pin = pinOf(stop);
        if (!pin) continue;
        const metres = haversine(fix, pin);
        if (metres <= radius && (!best || metres < best.metres)) best = { stop, metres };
      }
      if (best) {
        return {
          kind: "arrive",
          stop: best.stop,
          sure: best.metres + fix.accuracy <= SURE_INSIDE_M,
        };
      }
    }
  }

  if (current && atCurrent != null && fix.accuracy <= LEAVE_ACCURACY_MAX_M) {
    if (atCurrent - fix.accuracy > LEAVE_MARGIN_M) {
      return { kind: "leave", stop: current, sure: false };
    }
  }
  return null;
}

/**
 * One reading in: what the readings now point at, and the suggestion to
 * show, if any. A suggestion waits until readings have agreed for
 * `DWELL_MS`, unless one is close and sure enough on its own. One the
 * traveller waved away (`dismissed`, keyed "arrive:<id>" or "leave:<id>")
 * is not offered again.
 */
export function followAlong<T extends FollowStop>(
  previous: Sighting,
  stops: readonly T[],
  fix: HereFix,
  at: number,
  dismissed: ReadonlySet<string> = new Set(),
): { sighting: Sighting; suggest: { kind: FollowKind; stop: T } | null } {
  const candidate = candidateFor(stops, fix);
  if (!candidate) return { sighting: null, suggest: null };
  const same =
    previous && previous.kind === candidate.kind && previous.stopId === candidate.stop.id;
  const sighting = same ? previous : { kind: candidate.kind, stopId: candidate.stop.id, since: at };
  const lasted = at - sighting.since >= DWELL_MS;
  const ready =
    (candidate.sure || lasted) && !dismissed.has(followKey(candidate.kind, candidate.stop.id));
  return {
    sighting,
    suggest: ready ? { kind: candidate.kind, stop: candidate.stop } : null,
  };
}

export function followKey(kind: FollowKind, stopId: string): string {
  return `${kind}:${stopId}`;
}

function formatClock(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

export type FromHere = {
  /** Journey time from where you are, estimated. */
  minutes: number;
  mode: LegMode;
  /** When you would get there setting off now. */
  eta: string;
  /** Minutes past the stop's time you would arrive (negative: early), or null without a time. */
  lateBy: number | null;
  /** Minutes until you must set off to be on time, or null without a time. */
  leaveIn: number | null;
};

/**
 * How far the next stop is from where you are, by the traveller's way of
 * getting around, and how that sits against its time. Null without a pin
 * on the stop, with a reading too unsure, or when you are already there.
 */
export function fromHere(
  fix: HereFix,
  next: FollowStop,
  choice: TravelChoice,
  nowMinutes: number,
): FromHere | null {
  if (fix.accuracy > ETA_ACCURACY_MAX_M) return null;
  const pin = pinOf(next);
  if (!pin) return null;
  const straight = haversine(fix, pin);
  if (straight <= arriveRadius(Math.min(fix.accuracy, ARRIVE_ACCURACY_MAX_M))) return null;
  const mode = legModeFor(choice, straight);
  const minutes = Math.ceil(estimatedLegSeconds(straight, mode) / 60);
  const due = clockMinutes(next.time_label);
  return {
    minutes,
    mode,
    eta: formatClock(nowMinutes + minutes),
    lateBy: due == null ? null : nowMinutes + minutes - due,
    leaveIn: due == null ? null : due - nowMinutes - minutes,
  };
}

/** Within this many minutes either way of the stop's time counts as on time. */
export const ON_TIME_MINUTES = 5;

/** The one line Now says about the journey from where you are. */
export function fromHereLine(r: FromHere, atAStop: boolean): string {
  const away = `${r.minutes} min away`;
  if (r.lateBy == null) return `${away} · there about ${r.eta}`;
  if (r.lateBy > ON_TIME_MINUTES) {
    return atAStop
      ? `Leave now and you're about ${r.lateBy} min late · ${away} · ETA ${r.eta}`
      : `Running about ${r.lateBy} min late · ${away} · ETA ${r.eta}`;
  }
  if (atAStop && r.leaveIn != null && r.leaveIn > 0) {
    return `Leave in about ${r.leaveIn} min · ${away} from here`;
  }
  if (atAStop && r.leaveIn != null) return `Time to go · ${away} · ETA ${r.eta}`;
  return `On track · ${away} · ETA ${r.eta}`;
}
