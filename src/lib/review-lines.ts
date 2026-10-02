/**
 * The words on the Review changes sheet, kept pure so what the traveller is
 * told is tested: only the stops they acted on are "Your change", a move to
 * another day shows its new time too, and Apply is never off without a reason.
 */
import { timeModeFor, type ConsequenceResult, type ScheduleStop } from "./itinerary-change.ts";
import type { ReviewableChange, ReviewChangeSet } from "./itinerary-review.ts";
import { stayLabel } from "./planned-stay.ts";
import { formatTimelineDayLabel } from "./timeline-groups.ts";

export type NamedStop = ScheduleStop & { title: string };

export type ReviewLine = { stopId: string; title: string; before?: string; after?: string };

export function stopName(stops: readonly NamedStop[], id: string): string {
  return stops.find((stop) => stop.id === id)?.title ?? "This stop";
}

function dayLabel(day: string | null): string {
  return day ? formatTimelineDayLabel(day) : "No date";
}

/** What the card shows for that lock: an unset lock reads as Béa's default. */
function lockLabel(stop: NamedStop | undefined, locked: boolean | null): string {
  if (!stop) return locked === true ? "Fixed" : locked === false ? "Flexible" : "Default";
  const mode = timeModeFor({ ...stop, time_locked: locked });
  return mode === "fixed" ? "Fixed" : mode === "flexible" ? "Flexible" : "Sequence only";
}

function dayAndTime(day: string | null, time: string | null): string {
  return time ? `${dayLabel(day)} · ${time}` : dayLabel(day);
}

const signed = new Intl.NumberFormat(undefined, { signDisplay: "exceptZero" });
const plain = new Intl.NumberFormat(undefined);

/** "+30 min", "−15 min", in the traveller's own number format. */
export function formatShiftMinutes(delta: number): string {
  return `${signed.format(delta)} min`;
}

/** "45 min", for how short a gap is. */
export function formatShortMinutes(minutes: number): string {
  return `${plain.format(minutes)} min`;
}

function changeLine(change: ReviewableChange, stops: readonly NamedStop[]): ReviewLine {
  const stopId = change.stopId;
  const stop = stops.find((row) => row.id === stopId);
  const title = stop?.title ?? "This stop";
  if (change.type === "lock") {
    return {
      stopId,
      title,
      before: lockLabel(stop, change.fromLocked),
      after: lockLabel(stop, change.toLocked),
    };
  }
  if (change.type === "duration") {
    return {
      stopId,
      title,
      before: change.fromMinutes == null ? "No duration" : stayLabel(change.fromMinutes),
      after: change.toMinutes == null ? "No duration" : stayLabel(change.toMinutes),
    };
  }
  if (change.type === "retime") {
    return {
      stopId,
      title,
      before: change.fromTime ?? "No set time",
      after: change.toTime ?? "No set time",
    };
  }
  const current = stop?.time_label ?? null;
  if (change.from.dayDate !== change.to.dayDate) {
    const next = change.to.preferredTime !== undefined ? change.to.preferredTime : current;
    return {
      stopId,
      title,
      before: dayAndTime(change.from.dayDate, current),
      after: dayAndTime(change.to.dayDate, next),
    };
  }
  if (change.to.preferredTime !== undefined) {
    return {
      stopId,
      title,
      before: current ?? "No set time",
      after: change.to.preferredTime ?? "No set time",
    };
  }
  return { stopId, title, after: "Moves to a new place in the day" };
}

/** "Your change": the stops the traveller acted on, never the rows that made room. */
export function reviewLines(
  changeSet: ReviewChangeSet,
  directIds: ReadonlySet<string>,
  stops: readonly NamedStop[],
): ReviewLine[] {
  return changeSet.changes
    .filter((change) => directIds.has(change.stopId))
    .map((change) => changeLine(change, stops));
}

/** Why Apply is off, in words: never a greyed-out button on its own. */
export function blockedReason(result: Pick<ConsequenceResult, "reasons">): string {
  if (result.reasons.includes("invalid-change")) {
    return "This can’t be applied: a stop it changes was moved or removed since, or this kind of change can’t be saved from here. Keep the current itinerary and try again.";
  }
  return "This can’t be applied as it is. Keep the current itinerary and try again.";
}
