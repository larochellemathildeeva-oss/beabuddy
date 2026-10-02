import {
  checkChange,
  itineraryClockMinutes,
  sameItineraryTime,
  type ChangeSet,
  type ConsequenceResult,
  type ProposedChange,
  type ReviewReason,
  type ScheduleStop,
  type TravelLeg,
} from "./itinerary-change.ts";
import type { ScheduleUpdate } from "./itinerary-schedule-write.ts";
import { rearrange, stopsOfDay, type StopMove } from "./stop-move.ts";
import type { TravelChoice } from "./travel-mode.ts";

type PatchableSchedule = Pick<
  ScheduleStop,
  "day_date" | "time_label" | "planned_stay_minutes" | "time_locked"
>;

export type ScheduleReviewChange = Extract<
  ProposedChange,
  { type: "move" | "retime" | "duration" | "time-lock" }
>;

export type ScheduleReviewChangeSet = Omit<ChangeSet, "changes"> & {
  changes: ScheduleReviewChange[];
};

export type ReviewProposal = {
  changeSet: ScheduleReviewChangeSet;
  /** Stops the traveller explicitly acted on; displaced rows are not direct edits. */
  directIds: Set<string>;
};

function owns<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function targetIndex<T extends ScheduleStop>(
  stops: readonly T[],
  stopId: string,
  day: string | null,
  time: string | null,
): number {
  const list = stopsOfDay(stops, day, stopId);
  const at = itineraryClockMinutes(time);
  if (at == null) return list.length;
  const later = list.findIndex((stop) => {
    const value = itineraryClockMinutes(stop.time_label);
    return value != null && value > at;
  });
  return later < 0 ? list.length : later;
}

function changesFromRearrange<T extends ScheduleStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
  directIds: ReadonlySet<string>,
  id: string,
): ScheduleReviewChange[] {
  const updates = rearrange(stops, moves);
  const before = new Map(stops.map((stop) => [stop.id, stop] as const));
  const changes: ScheduleReviewChange[] = [];

  for (const [index, update] of updates.entries()) {
    const was = before.get(update.id);
    if (!was) continue;
    changes.push({
      id: `${id}:${index}`,
      type: "move",
      stopId: update.id,
      indirect: !directIds.has(update.id),
      from: { dayDate: was.day_date, position: was.position },
      to: {
        dayDate: update.day_date,
        position: update.position,
        ...(!sameItineraryTime(update.time_label, was.time_label)
          ? { preferredTime: update.time_label }
          : {}),
      },
    });
  }

  return changes;
}

/**
 * Represent one old-style stop move as the shared ChangeSet model. `rearrange`
 * only renumbers the source/target days, so moving Tuesday never turns every
 * later day into part of the proposal.
 */
export function changeSetForMoves<T extends ScheduleStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
  id = "manual-move",
): ReviewProposal | null {
  const directIds = new Set(moves.map((move) => move.id));
  const changes = changesFromRearrange(stops, moves, directIds, id);
  if (changes.length === 0) return null;
  return {
    changeSet: { id, source: "manual", changes, createdAt: Date.now() },
    directIds,
  };
}

/**
 * Turn a card's day/time/duration/lock edit into the same ChangeSet used by
 * drag. A day/time edit is expressed through `rearrange`, not the older global
 * position helper, so only the day it leaves/enters gets renumbered.
 */
export function changeSetForSchedulePatch<T extends ScheduleStop>(
  stops: readonly T[],
  stopId: string,
  patch: Partial<PatchableSchedule>,
  id = "manual-card",
): ReviewProposal | null {
  const current = stops.find((stop) => stop.id === stopId);
  if (!current) return null;
  const directIds = new Set([stopId]);
  const changes: ScheduleReviewChange[] = [];

  const changesDay = owns(patch, "day_date") && (patch.day_date ?? null) !== current.day_date;
  const changesTime =
    owns(patch, "time_label") && !sameItineraryTime(patch.time_label ?? null, current.time_label);

  if (changesDay || changesTime) {
    const day = owns(patch, "day_date") ? (patch.day_date ?? null) : current.day_date;
    const time = owns(patch, "time_label") ? (patch.time_label ?? null) : current.time_label;
    const move: StopMove = {
      id: stopId,
      day_date: day,
      at: { index: targetIndex(stops, stopId, day, time) },
      ...(changesTime ? { time_label: time } : {}),
    };
    changes.push(...changesFromRearrange(stops, [move], directIds, `${id}:move`));
  }

  if (
    owns(patch, "planned_stay_minutes") &&
    (patch.planned_stay_minutes ?? null) !== (current.planned_stay_minutes ?? null)
  ) {
    changes.push({
      id: `${id}:duration`,
      type: "duration",
      stopId,
      fromMinutes: current.planned_stay_minutes ?? null,
      toMinutes: patch.planned_stay_minutes ?? null,
    });
  }

  if (
    owns(patch, "time_locked") &&
    (patch.time_locked ?? null) !== (current.time_locked ?? null)
  ) {
    changes.push({
      id: `${id}:time-lock`,
      type: "time-lock",
      stopId,
      fromLocked: current.time_locked ?? null,
      toLocked: patch.time_locked ?? null,
    });
  }

  if (changes.length === 0) return null;
  return {
    changeSet: { id, source: "manual", changes, createdAt: Date.now() },
    directIds,
  };
}

/**
 * Run the canonical consequence engine, then classify displaced rows as
 * downstream rather than explicit edits. This keeps the 2-stop / 30-minute
 * threshold about consequences, not position bookkeeping.
 */
export function checkReviewProposal<T extends ScheduleStop>(
  stops: readonly T[],
  proposal: ReviewProposal,
  options: {
    travelLegs?: readonly TravelLeg[];
    travelChoice?: TravelChoice;
  } = {},
): ConsequenceResult {
  const checked = checkChange(stops, proposal.changeSet, options);
  const shifts = checked.shifts.map((shift) => ({
    ...shift,
    downstream: !proposal.directIds.has(shift.stopId),
  }));
  const downstream = shifts.filter((shift) => shift.downstream);
  const reasons: ReviewReason[] = checked.reasons.filter(
    (reason) => reason !== "too-many-shifts" && reason !== "large-shift",
  );
  if (downstream.length > 2) reasons.push("too-many-shifts");
  if (downstream.some((shift) => shift.deltaMinutes == null || Math.abs(shift.deltaMinutes) > 30)) {
    reasons.push("large-shift");
  }
  return {
    ...checked,
    shifts,
    reasons,
    decision: checked.decision === "blocked" ? "blocked" : reasons.length ? "review" : "auto-apply",
  };
}

/**
 * Atomic updates that turn `before` into `result.proposedSchedule`.
 *
 * Phase 3 review currently persists schedule edits to existing rows only. If a
 * future caller passes an insert/delete proposal, fail loudly rather than
 * approving a result the schedule RPC cannot actually save.
 */
export function updatesForConsequence<T extends ScheduleStop>(
  before: readonly T[],
  result: ConsequenceResult,
): ScheduleUpdate[] {
  const beforeIds = new Set(before.map((stop) => stop.id));
  const afterIds = new Set(result.proposedSchedule.map((stop) => stop.id));
  const sameRows =
    beforeIds.size === afterIds.size &&
    [...beforeIds].every((id) => afterIds.has(id)) &&
    [...afterIds].every((id) => beforeIds.has(id));
  if (!sameRows) {
    throw Object.assign(new Error("This review contains a stop add or remove that isn't supported yet."), {
      code: "ITINERARY_REVIEW_UNSUPPORTED_CHANGE",
    });
  }

  const was = new Map(before.map((stop) => [stop.id, stop] as const));
  const updates: ScheduleUpdate[] = [];

  for (const stop of result.proposedSchedule) {
    const previous = was.get(stop.id);
    if (!previous) continue;
    const update: ScheduleUpdate = { id: stop.id };
    if (previous.day_date !== stop.day_date) update.day_date = stop.day_date;
    if (previous.time_label !== stop.time_label) update.time_label = stop.time_label;
    if (previous.position !== stop.position) update.position = stop.position;
    if ((previous.planned_stay_minutes ?? null) !== (stop.planned_stay_minutes ?? null)) {
      update.planned_stay_minutes = stop.planned_stay_minutes ?? null;
    }
    if ((previous.time_locked ?? null) !== (stop.time_locked ?? null)) {
      update.time_locked = stop.time_locked ?? null;
    }
    if (Object.keys(update).length > 1) updates.push(update);
  }

  return updates;
}

/** Exact schedule values needed to put an applied update back. */
export function inverseScheduleUpdates<T extends ScheduleStop>(
  before: readonly T[],
  updates: readonly ScheduleUpdate[],
): ScheduleUpdate[] {
  const byId = new Map(before.map((stop) => [stop.id, stop] as const));
  const inverse: ScheduleUpdate[] = [];

  for (const update of updates) {
    const row = byId.get(update.id);
    if (!row) continue;
    const restore: ScheduleUpdate = { id: update.id };
    if (owns(update, "day_date")) restore.day_date = row.day_date;
    if (owns(update, "time_label")) restore.time_label = row.time_label;
    if (owns(update, "position")) restore.position = row.position;
    if (owns(update, "planned_stay_minutes")) {
      restore.planned_stay_minutes = row.planned_stay_minutes ?? null;
    }
    if (owns(update, "time_locked")) restore.time_locked = row.time_locked ?? null;
    if (Object.keys(restore).length > 1) inverse.push(restore);
  }

  return inverse;
}
