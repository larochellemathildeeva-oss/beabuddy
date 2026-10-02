import {
  checkChange,
  type ChangeSet,
  type CheckOptions,
  type ConsequenceResult,
  type ProposedChange,
  type ScheduleStop,
} from "./itinerary-change.ts";
import {
  scheduleUpdatesForPatch,
  type SchedulePatch,
  type ScheduleUpdate,
} from "./itinerary-schedule-write.ts";
import { rearrange, type StopMove } from "./stop-move.ts";

/**
 * What Review can propose: the changes the atomic schedule write persists in
 * one transaction (day, position, time, duration, Fixed/Flexible). Adding,
 * removing or re-pinning a stop is not a schedule write, so it is refused
 * here rather than approved and then silently dropped.
 */
export type ReviewableChange = Extract<
  ProposedChange,
  { type: "move" | "retime" | "duration" | "lock" }
>;

export type ReviewChangeSet = Omit<ChangeSet, "changes"> & { changes: ReviewableChange[] };

export type ReviewProposal = {
  changeSet: ReviewChangeSet;
  /** Stops the traveller explicitly acted on; displaced rows are not direct edits. */
  directIds: ReadonlySet<string>;
};

const REVIEWABLE = new Set<ProposedChange["type"]>(["move", "retime", "duration", "lock"]);

export function isReviewableChange(change: ProposedChange): change is ReviewableChange {
  return REVIEWABLE.has(change.type);
}

const owns = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);

/**
 * Turn the rows a schedule write would send into the ChangeSet the
 * consequence engine reads. Rows outside `directIds` only change position.
 */
function proposalFromUpdates<T extends ScheduleStop>(
  stops: readonly T[],
  updates: readonly ScheduleUpdate[],
  directIds: ReadonlySet<string>,
  id: string,
): ReviewProposal | null {
  const before = new Map(stops.map((stop) => [stop.id, stop] as const));
  const changes: ReviewableChange[] = [];

  for (const [index, update] of updates.entries()) {
    const was = before.get(update.id);
    if (!was) continue;
    const key = `${id}:${index}`;
    const day = owns(update, "day_date") ? (update.day_date ?? null) : was.day_date;
    const position = owns(update, "position") ? (update.position ?? was.position) : was.position;
    const time = owns(update, "time_label") ? (update.time_label ?? null) : was.time_label;
    const timeChanged = time !== was.time_label;

    if ((day ?? "") !== (was.day_date ?? "") || position !== was.position) {
      changes.push({
        id: `${key}:move`,
        type: "move",
        stopId: update.id,
        from: { dayDate: was.day_date, position: was.position },
        to: { dayDate: day, position, ...(timeChanged ? { preferredTime: time } : {}) },
      });
    } else if (timeChanged) {
      changes.push({
        id: `${key}:time`,
        type: "retime",
        stopId: update.id,
        fromTime: was.time_label,
        toTime: time,
      });
    }

    if (!directIds.has(update.id)) continue;
    if (
      owns(update, "planned_stay_minutes") &&
      (update.planned_stay_minutes ?? null) !== (was.planned_stay_minutes ?? null)
    ) {
      changes.push({
        id: `${key}:duration`,
        type: "duration",
        stopId: update.id,
        fromMinutes: was.planned_stay_minutes ?? null,
        toMinutes: update.planned_stay_minutes ?? null,
      });
    }
    if (owns(update, "time_locked") && (update.time_locked ?? null) !== (was.time_locked ?? null)) {
      changes.push({
        id: `${key}:lock`,
        type: "lock",
        stopId: update.id,
        fromLocked: was.time_locked ?? null,
        toLocked: update.time_locked ?? null,
      });
    }
  }

  if (changes.length === 0) return null;
  return {
    changeSet: { id, source: "manual", changes, createdAt: Date.now() },
    directIds,
  };
}

/**
 * Drag and Move to…, as the shared ChangeSet. `rearrange` renumbers the rows
 * displaced by the move; they stay in the ChangeSet so the proposed order is
 * exact, and `directIds` keeps them out of "Your change" and the thresholds.
 */
export function changeSetForMoves<T extends ScheduleStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
  id = "manual-move",
): ReviewProposal | null {
  const known = new Set(stops.map((stop) => stop.id));
  const updates = rearrange(stops, moves);
  if (updates.length === 0) return null;
  const directIds = new Set(moves.map((move) => move.id).filter((stopId) => known.has(stopId)));
  return proposalFromUpdates(stops, updates, directIds, id);
}

/**
 * A card's day/time/duration/Fixed edit, built from exactly the rows
 * `updateItem` writes (`scheduleUpdatesForPatch`), so Review and the save
 * never disagree about where the stop lands.
 */
export function changeSetForSchedulePatch<T extends ScheduleStop>(
  stops: readonly T[],
  stopId: string,
  patch: SchedulePatch,
  id = "manual-card",
): ReviewProposal | null {
  const updates = scheduleUpdatesForPatch(stops, stopId, patch);
  if (!updates) return null;
  return proposalFromUpdates(stops, updates, new Set([stopId]), id);
}

/**
 * Run the canonical consequence engine with the traveller's own travel mode
 * and the stops they acted on. A change Review cannot persist blocks.
 */
export function checkReviewProposal<T extends ScheduleStop>(
  stops: readonly T[],
  proposal: ReviewProposal,
  options: Omit<CheckOptions, "directIds"> = {},
): ConsequenceResult {
  const checked = checkChange(stops, proposal.changeSet, {
    ...options,
    directIds: proposal.directIds,
  });
  // Typed callers cannot get here; anything assembled at run time can.
  if (proposal.changeSet.changes.every((change) => isReviewableChange(change))) return checked;
  return {
    ...checked,
    decision: "blocked",
    reasons: checked.reasons.includes("invalid-change")
      ? checked.reasons
      : ["invalid-change", ...checked.reasons],
  };
}

/**
 * The atomic write that turns `before` into `result.proposedSchedule`: day,
 * time, position, duration and Fixed/Flexible. Throws when the result adds,
 * removes or re-pins a stop, which this write cannot do.
 */
export function updatesForConsequence<T extends ScheduleStop>(
  before: readonly T[],
  result: ConsequenceResult,
): ScheduleUpdate[] {
  const was = new Map(before.map((stop) => [stop.id, stop] as const));
  const after = new Set(result.proposedSchedule.map((stop) => stop.id));
  if (after.size !== was.size || [...was.keys()].some((stopId) => !after.has(stopId))) {
    throw new Error("Review can only save changes to a stop's day, time, order or length.");
  }
  const updates: ScheduleUpdate[] = [];

  for (const stop of result.proposedSchedule) {
    const previous = was.get(stop.id)!;
    if (
      (previous.lat ?? null) !== (stop.lat ?? null) ||
      (previous.lon ?? null) !== (stop.lon ?? null)
    ) {
      throw new Error("Review can only save changes to a stop's day, time, order or length.");
    }
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
