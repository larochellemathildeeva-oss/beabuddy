import {
  itineraryClockMinutes,
  type ChangeSet,
  type ConsequenceResult,
  type ProposedChange,
  type ScheduleStop,
} from "./itinerary-change.ts";
import type { ScheduleUpdate } from "./itinerary-schedule-write.ts";
import { chronologicalSlot } from "./timeline-order.ts";
import { rearrange, type StopMove } from "./stop-move.ts";

type PatchableSchedule = Pick<
  ScheduleStop,
  "day_date" | "time_label" | "planned_stay_minutes"
>;

function owns<T extends object>(value: T, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Represent one old-style stop move as the shared ChangeSet model.
 *
 * `rearrange` also renumbers the rows displaced by the move. Those position
 * changes still belong in the ChangeSet so the proposed order is exact, but
 * they are marked indirect so `checkChange` does not mistake them for stops
 * the traveller explicitly edited when it counts downstream consequences.
 */
export function changeSetForMoves<T extends ScheduleStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
  id = "manual-move",
): ChangeSet | null {
  const updates = rearrange(stops, moves);
  if (updates.length === 0) return null;
  const before = new Map(stops.map((stop) => [stop.id, stop] as const));
  const directIds = new Set(moves.map((move) => move.id));
  const changes: ProposedChange[] = [];

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
        ...(update.time_label !== was.time_label ? { preferredTime: update.time_label } : {}),
      },
    });
  }

  if (changes.length === 0) return null;
  return { id, source: "manual", changes, createdAt: Date.now() };
}

/**
 * Turn a card's day/time/duration edit into the same ChangeSet used by drag.
 * Position shifts caused by a new day or time are included as indirect moves,
 * so Review and the eventual atomic write see the exact order the card would
 * produce.
 */
export function changeSetForSchedulePatch<T extends ScheduleStop>(
  stops: readonly T[],
  stopId: string,
  patch: Partial<PatchableSchedule>,
  id = "manual-card",
): ChangeSet | null {
  const current = stops.find((stop) => stop.id === stopId);
  if (!current) return null;
  const changes: ProposedChange[] = [];

  const changesDay = owns(patch, "day_date") && (patch.day_date ?? null) !== current.day_date;
  const changesTime =
    owns(patch, "time_label") && (patch.time_label ?? null) !== current.time_label;

  if (changesDay || changesTime) {
    const day = owns(patch, "day_date") ? (patch.day_date ?? null) : current.day_date;
    const time = owns(patch, "time_label") ? (patch.time_label ?? null) : current.time_label;
    const slot = chronologicalSlot(
      stops,
      { day_date: day, time_label: time },
      itineraryClockMinutes,
      stopId,
    );
    const shifted = new Map(slot.shifts.map((shift) => [shift.id, shift.position] as const));
    let index = 0;
    for (const stop of stops) {
      const position = shifted.get(stop.id);
      if (position == null || position === stop.position) continue;
      changes.push({
        id: `${id}:shift:${index++}`,
        type: "move",
        stopId: stop.id,
        indirect: true,
        from: { dayDate: stop.day_date, position: stop.position },
        to: { dayDate: stop.day_date, position },
      });
    }
    changes.push({
      id: `${id}:move`,
      type: "move",
      stopId,
      from: { dayDate: current.day_date, position: current.position },
      to: {
        dayDate: day,
        position: slot.position,
        ...(changesTime ? { preferredTime: time } : {}),
      },
    });
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

  if (changes.length === 0) return null;
  return { id, source: "manual", changes, createdAt: Date.now() };
}

/** Atomic updates that turn `before` into `result.proposedSchedule`. */
export function updatesForConsequence<T extends ScheduleStop>(
  before: readonly T[],
  result: ConsequenceResult,
): ScheduleUpdate[] {
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
