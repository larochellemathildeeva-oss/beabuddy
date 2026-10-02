import { haversine, isLatLon } from "./geo.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import { clockMinutes } from "./timeline-kind.ts";
import { legModeFor, type TravelChoice } from "./travel-mode.ts";

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
  | { id: string; type: "delete"; stopId: string }
  | {
      id: string;
      type: "lock";
      stopId: string;
      fromLocked: boolean | null;
      toLocked: boolean | null;
    };

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
  /** The new time rests on a travel time worked out from the distance ("~"). */
  estimated?: boolean;
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

export type CheckOptions = {
  travelLegs?: readonly TravelLeg[];
  /** How the traveller gets around; missing legs are estimated for that. */
  travelChoice?: TravelChoice;
  /**
   * The stops the traveller acted on. Other rows in the ChangeSet only made
   * room (a renumbered position) and are neither edits nor a reason to check
   * their day. Left out, every stop the ChangeSet names counts as edited.
   */
  directIds?: ReadonlySet<string>;
  /**
   * Saved "Walk to …" rows: renumbered with everything else, but they are the
   * journey between two stops, not a stop, so the ripple steps over them.
   */
  travelRowIds?: ReadonlySet<string>;
};

const MINUTES_PER_DAY = 24 * 60;

/**
 * A stop's clock time, read exactly as the Timeline reads it ("09:00",
 * "9:00 AM", "2pm", "14h30"). Words such as Morning stay untimed.
 */
export const itineraryClockMinutes = clockMinutes;

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
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  return (fromId: string, toId: string): TravelLeg | null => {
    const exact = known.get(legKey(fromId, toId));
    if (exact) return exact;
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (!from || !to || !isLatLon(from) || !isLatLon(to)) return null;
    const metres = haversine(from, to);
    // No chosen mode: walk what is close, drive the rest, as directions do.
    const mode = legModeFor(options.travelChoice ?? "auto", metres);
    return {
      fromId,
      toId,
      seconds: estimatedLegSeconds(metres, mode),
      estimated: true,
    };
  };
}

/**
 * Give `stop` a whole-number position just after or before `anchor` on the
 * anchor's day, moving the stops past it up by one so no two share a position.
 */
function placeBeside(
  schedule: ScheduleStop[],
  stop: ScheduleStop,
  anchor: ScheduleStop,
  side: "after" | "before",
) {
  const day = sortSchedule(schedule.filter((row) => row.day_date === anchor.day_date));
  const at = day.indexOf(anchor) + (side === "after" ? 1 : 0);
  const start = day.length ? Math.min(...day.map((row) => row.position)) : 0;
  day.forEach((row, index) => {
    row.position = start + index + (index >= at ? 1 : 0);
  });
  stop.position = start + at;
}

function applyChange(schedule: ScheduleStop[], change: ProposedChange): boolean {
  if (change.type === "insert") {
    if (schedule.some((stop) => stop.id === change.tempStopId || stop.id === change.stop.id))
      return false;
    const inserted = { ...change.stop, id: change.tempStopId || change.stop.id };
    // The neighbours say where it goes; its own position is only a fallback,
    // since a position equal to an existing stop's would fall back to ids.
    const after = schedule.find((stop) => stop.id === change.afterStopId);
    const before = schedule.find((stop) => stop.id === change.beforeStopId);
    if ((change.afterStopId && !after) || (change.beforeStopId && !before)) return false;
    const anchor = after ?? before;
    if (anchor) {
      inserted.day_date = anchor.day_date;
      placeBeside(schedule, inserted, anchor, after ? "after" : "before");
    }
    schedule.push(inserted);
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
  if (change.type === "lock") {
    stop.time_locked = change.toLocked;
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
  // Stops whose clock time the traveller set in this ChangeSet. The ripple
  // never rewrites those: a time they typed is reported, not replaced.
  const chosenTimeIds = new Set<string>();
  // Only the days this ChangeSet touches are checked. A tight pair elsewhere
  // on the trip is not this edit's consequence.
  const affectedDays = new Set<string | null>();
  const originalDay = new Map(original.map((stop) => [stop.id, stop.day_date] as const));
  let invalid = false;
  let crossesDay = false;
  const direct = (id: string) => !options.directIds || options.directIds.has(id);

  for (const change of changeSet.changes) {
    // A row renumbered to make room is not an edit: its day is not checked,
    // so a change on day 1 never ripples into day 2. Nor is "9:00 AM" →
    // "09:00": the label is written, but the time and the day are the same.
    const relabel =
      change.type === "retime" &&
      itineraryClockMinutes(change.fromTime) != null &&
      itineraryClockMinutes(change.fromTime) === itineraryClockMinutes(change.toTime);
    if ("stopId" in change && direct(change.stopId) && !relabel) {
      editedIds.add(change.stopId);
      affectedDays.add(originalDay.get(change.stopId) ?? null);
    }
    if (change.type === "insert") {
      editedIds.add(change.tempStopId);
      chosenTimeIds.add(change.tempStopId);
    }
    if (change.type === "retime") chosenTimeIds.add(change.stopId);
    if (change.type === "move") {
      if (change.from.dayDate !== change.to.dayDate) crossesDay = true;
      if (change.to.preferredTime !== undefined) chosenTimeIds.add(change.stopId);
    }
    if (!applyChange(proposed, change)) invalid = true;
  }
  for (const stop of proposed) if (editedIds.has(stop.id)) affectedDays.add(stop.day_date);

  sortSchedule(proposed);
  const travel = travelResolver(proposed, options);
  const fixedConstraints: FixedConstraint[] = [];
  const conflicts: ReachabilityConflict[] = [];
  const estimatedIds = new Set<string>();
  let uncertainTravel = false;

  // Ripple day by day. A Flexible stop moves only as much as needed to remain
  // reachable from the stop immediately before it. Fixed times never move.
  const stopsInOrder = options.travelRowIds
    ? proposed.filter((stop) => !options.travelRowIds!.has(stop.id))
    : proposed;
  for (let i = 0; i < stopsInOrder.length - 1; i += 1) {
    const from = stopsInOrder[i]!;
    const to = stopsInOrder[i + 1]!;
    if (!from.day_date || from.day_date !== to.day_date) continue;
    if (!affectedDays.has(from.day_date)) continue;
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

    // A Flexible stop slides later, but only within its own day: past
    // midnight its clock would wrap to the morning and sort before the stop
    // it follows. Those, and times the traveller just chose, stay put and are
    // reported instead.
    const endOfDay = (dayNumber(to.day_date) ?? 0) * MINUTES_PER_DAY + MINUTES_PER_DAY;
    if (timeModeFor(to) === "flexible" && !chosenTimeIds.has(to.id) && earliest < endOfDay) {
      to.time_label = clockLabel(earliest);
      if (leg.estimated || estimatedIds.has(from.id)) estimatedIds.add(to.id);
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
    // "9:00 AM" → "09:00" is the same time, not a shift.
    const changedTime =
      fromMinutes != null && toMinutes != null
        ? fromMinutes !== toMinutes
        : before.time_label !== stop.time_label;
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
      ...(estimatedIds.has(stop.id) ? { estimated: true } : {}),
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
