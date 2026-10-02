import { haversine, isLatLon } from "./geo.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import type { LegMode } from "./travel-mode.ts";

export type TimeMode = "fixed" | "flexible" | "sequence";

export type ScheduleStop = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  planned_stay_minutes?: number | null;
  lat?: number | null;
  lon?: number | null;
  booked?: boolean;
  /**
   * null/undefined = use Béa's default (booked + clock starts fixed),
   * true = traveller explicitly fixed it,
   * false = traveller explicitly made it flexible.
   *
   * Phase 1 accepts the field without requiring the migration yet; Phase 2
   * persists it.
   */
  time_locked?: boolean | null;
};

export type PlaceSnapshot = {
  lat: number | null;
  lon: number | null;
};

export type DraftScheduleStop = ScheduleStop;

export type ProposedChange =
  | {
      id: string;
      type: "move";
      stopId: string;
      from: { dayDate: string | null; position: number };
      to: { dayDate: string | null; position: number; preferredTime?: string | null };
    }
  | {
      id: string;
      type: "retime";
      stopId: string;
      fromTime: string | null;
      toTime: string | null;
    }
  | {
      id: string;
      type: "duration";
      stopId: string;
      fromMinutes: number | null;
      toMinutes: number | null;
    }
  | {
      id: string;
      type: "place";
      stopId: string;
      from: PlaceSnapshot | null;
      to: PlaceSnapshot | null;
    }
  | {
      id: string;
      type: "insert";
      tempStopId: string;
      afterStopId: string | null;
      beforeStopId: string | null;
      stop: DraftScheduleStop;
    }
  | { id: string; type: "delete"; stopId: string };

export type ChangeSet = {
  id: string;
  tripId?: string;
  source: "manual" | "ask-bea";
  changes: ProposedChange[];
  /** stop id -> updated_at used by the atomic writer */
  baseVersions?: Record<string, string>;
  createdAt: number;
};

export type TravelLeg = {
  fromId: string;
  toId: string;
  seconds: number;
  estimated?: boolean;
};

export type StopShift = {
  stopId: string;
  fromDayDate: string | null;
  toDayDate: string | null;
  fromTime: string | null;
  toTime: string | null;
  deltaMinutes: number | null;
  /** True when this stop moved only because an earlier edit rippled into it. */
  downstream: boolean;
};

export type ReachabilityConflict = {
  fromStopId: string;
  toStopId: string;
  requiredMinutes: number;
  availableMinutes: number;
  estimated: boolean;
};

export type FixedConstraint = {
  stopId: string;
  time: string;
  reason: "booking" | "traveller-lock";
};

export type ReviewReason =
  | "crosses-day"
  | "too-many-shifts"
  | "large-shift"
  | "fixed-constraint"
  | "unreachable"
  | "travel-unknown"
  | "invalid-change";

export type ConsequenceResult = {
  proposedSchedule: ScheduleStop[];
  shifts: StopShift[];
  reachabilityConflicts: ReachabilityConflict[];
  fixedConstraints: FixedConstraint[];
  crossesDay: boolean;
  uncertainTravel: boolean;
  decision: "auto-apply" | "review" | "blocked";
  reasons: ReviewReason[];
};

type CheckOptions = {
  travelLegs?: readonly TravelLeg[];
  travelMode?: LegMode;
};

const MINUTES_PER_DAY = 24 * 60;

/** Clock values Béa already stores: 09:00 and 9:00 AM. Words such as Morning stay untimed. */
export function itineraryClockMinutes(label: string | null | undefined): number | null {
  const value = label?.trim();
  if (!value) return null;
  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (twentyFour) {
    const hours = Number(twentyFour[1]);
    const minutes = Number(twentyFour[2]);
    if (hours < 24 && minutes < 60) return hours * 60 + minutes;
    return null;
  }
  const twelve = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i.exec(value);
  if (!twelve) return null;
  let hours = Number(twelve[1]);
  const minutes = Number(twelve[2]);
  if (hours < 1 || hours > 12 || minutes >= 60) return null;
  const pm = twelve[3]!.toUpperCase() === "PM";
  if (hours === 12) hours = 0;
  return (hours + (pm ? 12 : 0)) * 60 + minutes;
}

/** Fixed/Flexible/Sequence is derived, never persisted as a second source of truth. */
export function timeModeFor(stop: ScheduleStop): TimeMode {
  if (itineraryClockMinutes(stop.time_label) == null) return "sequence";
  if (stop.time_locked === true) return "fixed";
  if (stop.time_locked === false) return "flexible";
  return stop.booked ? "fixed" : "flexible";
}

function dayNumber(day: string | null): number | null {
  if (!day) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(time) ? Math.floor(time / 86_400_000) : null;
}

/** Date-qualified minute value, so Tue 23:00 -> Wed 00:30 is +90, not negative. */
export function itineraryDateMinutes(
  day: string | null,
  label: string | null | undefined,
): number | null {
  const date = dayNumber(day);
  const clock = itineraryClockMinutes(label);
  return date == null || clock == null ? null : date * MINUTES_PER_DAY + clock;
}

function clockLabel(dateMinutes: number): string {
  const clock = ((dateMinutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${String(Math.floor(clock / 60)).padStart(2, "0")}:${String(clock % 60).padStart(2, "0")}`;
}

function cloneSchedule(stops: readonly ScheduleStop[]): ScheduleStop[] {
  return stops.map((stop) => ({ ...stop }));
}

function sortSchedule(stops: ScheduleStop[]): ScheduleStop[] {
  return stops.sort(
    (a, b) =>
      (a.day_date ?? "").localeCompare(b.day_date ?? "") ||
      a.position - b.position ||
      a.id.localeCompare(b.id),
  );
}

function legKey(fromId: string, toId: string) {
  return `${fromId}->${toId}`;
}

function travelResolver(stops: readonly ScheduleStop[], options: CheckOptions) {
  const known = new Map(
    (options.travelLegs ?? []).map((leg) => [legKey(leg.fromId, leg.toId), leg] as const),
  );
  const mode = options.travelMode ?? "walking";
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  return (fromId: string, toId: string): TravelLeg | null => {
    const exact = known.get(legKey(fromId, toId));
    if (exact) return exact;
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to || !isLatLon(from) || !isLatLon(to)) return null;
    const metres = haversine(from, to);
    return {
      fromId,
      toId,
      seconds: estimatedLegSeconds(metres, mode),
      estimated: true,
    };
  };
}

function applyChange(schedule: ScheduleStop[], change: ProposedChange): boolean {
  if (change.type === "insert") {
    if (schedule.some((stop) => stop.id === change.tempStopId || stop.id === change.stop.id)) return false;
    schedule.push({ ...change.stop, id: change.tempStopId || change.stop.id });
    return true;
  }
  if (change.type === "delete") {
    const at = schedule.findIndex((stop) => stop.id === change.stopId);
    if (at < 0) return false;
    schedule.splice(at, 1);
    return true;
  }
  const stop = schedule.find((row) => row.id === change.stopId);
  if (!stop) return false;
  if (change.type === "move") {
    stop.day_date = change.to.dayDate;
    stop.position = change.to.position;
    if (change.to.preferredTime !== undefined) stop.time_label = change.to.preferredTime;
    return true;
  }
  if (change.type === "retime") {
    stop.time_label = change.toTime;
    return true;
  }
  if (change.type === "duration") {
    stop.planned_stay_minutes = change.toMinutes;
    return true;
  }
  stop.lat = change.to?.lat ?? null;
  stop.lon = change.to?.lon ?? null;
  return true;
}

function conflictFor(
  from: ScheduleStop,
  to: ScheduleStop,
  travel: TravelLeg,
): ReachabilityConflict | null {
  const starts = itineraryDateMinutes(from.day_date, from.time_label);
  const next = itineraryDateMinutes(to.day_date, to.time_label);
  if (starts == null || next == null) return null;
  const stay = Math.max(0, from.planned_stay_minutes ?? 0);
  const required = stay + Math.ceil(travel.seconds / 60);
  const available = next - starts;
  if (available >= required) return null;
  return {
    fromStopId: from.id,
    toStopId: to.id,
    requiredMinutes: required,
    availableMinutes: available,
    estimated: Boolean(travel.estimated),
  };
}

/** Existing-plan conflicts: no automatic shifts, just the schedule as written. */
export function checkSchedule(
  stops: readonly ScheduleStop[],
  options: CheckOptions = {},
): Pick<ConsequenceResult, "reachabilityConflicts" | "uncertainTravel"> {
  const ordered = sortSchedule(cloneSchedule(stops));
  const travel = travelResolver(ordered, options);
  const conflicts: ReachabilityConflict[] = [];
  let uncertainTravel = false;
  for (let i = 0; i < ordered.length - 1; i += 1) {
    const from = ordered[i]!;
    const to = ordered[i + 1]!;
    if (!from.day_date || from.day_date !== to.day_date) continue;
    if (
      itineraryDateMinutes(from.day_date, from.time_label) == null ||
      itineraryDateMinutes(to.day_date, to.time_label) == null
    )
      continue;
    const leg = travel(from.id, to.id);
    if (!leg) {
      uncertainTravel = true;
      continue;
    }
    const conflict = conflictFor(from, to, leg);
    if (conflict) conflicts.push(conflict);
  }
  return { reachabilityConflicts: conflicts, uncertainTravel };
}

/**
 * Apply a proposed ChangeSet in memory, ripple only Flexible timed stops, then
 * decide whether the result is safe to apply directly or needs Review.
 */
export function checkChange(
  stops: readonly ScheduleStop[],
  changeSet: ChangeSet,
  options: CheckOptions = {},
): ConsequenceResult {
  const original = cloneSchedule(stops);
  const proposed = cloneSchedule(stops);
  const editedIds = new Set<string>();
  let invalid = false;
  let crossesDay = false;

  for (const change of changeSet.changes) {
    if ("stopId" in change) editedIds.add(change.stopId);
    if (change.type === "insert") editedIds.add(change.tempStopId);
    if (change.type === "move" && change.from.dayDate !== change.to.dayDate) crossesDay = true;
    if (!applyChange(proposed, change)) invalid = true;
  }

  sortSchedule(proposed);
  const travel = travelResolver(proposed, options);
  const fixedConstraints: FixedConstraint[] = [];
  const conflicts: ReachabilityConflict[] = [];
  let uncertainTravel = false;

  // Ripple day by day. A Flexible stop moves only as much as needed to remain
  // reachable from the stop immediately before it. Fixed times never move.
  for (let i = 0; i < proposed.length - 1; i += 1) {
    const from = proposed[i]!;
    const to = proposed[i + 1]!;
    if (!from.day_date || from.day_date !== to.day_date) continue;
    const fromStart = itineraryDateMinutes(from.day_date, from.time_label);
    const toStart = itineraryDateMinutes(to.day_date, to.time_label);
    if (fromStart == null || toStart == null) continue;
    const leg = travel(from.id, to.id);
    if (!leg) {
      uncertainTravel = true;
      continue;
    }
    const stay = Math.max(0, from.planned_stay_minutes ?? 0);
    const earliest = fromStart + stay + Math.ceil(leg.seconds / 60);
    if (toStart >= earliest) continue;

    if (timeModeFor(to) === "flexible") {
      to.time_label = clockLabel(earliest);
      continue;
    }

    const conflict = conflictFor(from, to, leg);
    if (conflict) conflicts.push(conflict);
    if (timeModeFor(to) === "fixed" && to.time_label) {
      fixedConstraints.push({
        stopId: to.id,
        time: to.time_label,
        reason: to.time_locked === true ? "traveller-lock" : "booking",
      });
    }
  }

  const originalById = new Map(original.map((stop) => [stop.id, stop]));
  const shifts: StopShift[] = [];
  for (const stop of proposed) {
    const before = originalById.get(stop.id);
    if (!before) continue;
    const fromMinutes = itineraryDateMinutes(before.day_date, before.time_label);
    const toMinutes = itineraryDateMinutes(stop.day_date, stop.time_label);
    const changedDay = before.day_date !== stop.day_date;
    const changedTime = before.time_label !== stop.time_label;
    if (!changedDay && !changedTime) continue;
    shifts.push({
      stopId: stop.id,
      fromDayDate: before.day_date,
      toDayDate: stop.day_date,
      fromTime: before.time_label,
      toTime: stop.time_label,
      deltaMinutes:
        fromMinutes == null || toMinutes == null ? null : Math.round(toMinutes - fromMinutes),
      downstream: !editedIds.has(stop.id),
    });
  }

  const downstream = shifts.filter((shift) => shift.downstream);
  const reasons: ReviewReason[] = [];
  if (invalid) reasons.push("invalid-change");
  if (crossesDay) reasons.push("crosses-day");
  if (downstream.length > 2) reasons.push("too-many-shifts");
  if (downstream.some((shift) => shift.deltaMinutes == null || Math.abs(shift.deltaMinutes) > 30))
    reasons.push("large-shift");
  if (fixedConstraints.length) reasons.push("fixed-constraint");
  if (conflicts.length) reasons.push("unreachable");
  if (uncertainTravel) reasons.push("travel-unknown");

  return {
    proposedSchedule: proposed,
    shifts,
    reachabilityConflicts: conflicts,
    fixedConstraints,
    crossesDay,
    uncertainTravel,
    decision: invalid ? "blocked" : reasons.length ? "review" : "auto-apply",
    reasons,
  };
}
