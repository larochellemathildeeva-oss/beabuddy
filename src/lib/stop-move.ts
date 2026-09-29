/**
 * Moving stops to another place in the plan: up or down a day, onto another
 * day, or anywhere Béa was asked to put them.
 *
 * Every move is worked out here, without the database, as the rows whose day,
 * time or position must change. Rows sort by day first and position second,
 * so a position only has to be in order within its own day: a move rewrites
 * the days it touches and nothing else, reusing the positions those days
 * already hold, so a swap of two neighbours is still two writes.
 */
import { parseLocalDate, toLocalISODate } from "./trip-dates.ts";

export type MovableStop = {
  id: string;
  day_date: string | null;
  position: number;
  time_label: string | null;
};

/** Where in the target day: first, last, straight after a stop, or at an index. */
export type MoveAt = "start" | "end" | { after: string } | { index: number };

export type StopMove = {
  id: string;
  /** The day it goes to; null for the undated list. */
  day_date: string | null;
  at: MoveAt;
  /** A new time; left out, the stop keeps its own. */
  time_label?: string | null;
};

export type ScheduleUpdate = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
};

const dayKey = (day: string | null | undefined) => day ?? "";

/** One day's stops in list order. */
export function stopsOfDay<T extends MovableStop>(
  stops: readonly T[],
  day: string | null,
  exceptId?: string,
): T[] {
  return stops
    .map((stop, index) => ({ stop, index }))
    .filter(({ stop }) => dayKey(stop.day_date) === dayKey(day) && stop.id !== exceptId)
    .sort((a, b) => a.stop.position - b.stop.position || a.index - b.index)
    .map(({ stop }) => stop);
}

/** The index a stop lands at in a day's list that no longer holds it. */
export function indexFor(list: readonly { id: string }[], at: MoveAt): number {
  if (at === "start") return 0;
  if (at === "end") return list.length;
  if ("index" in at) return Math.max(0, Math.min(list.length, Math.round(at.index)));
  const anchor = list.findIndex((stop) => stop.id === at.after);
  return anchor < 0 ? list.length : anchor + 1;
}

/** Where a stop sits now, as a move that would put it back. */
export function placeOf<T extends MovableStop>(stops: readonly T[], id: string): StopMove | null {
  const stop = stops.find((s) => s.id === id);
  if (!stop) return null;
  const list = stopsOfDay(stops, stop.day_date);
  return {
    id,
    day_date: stop.day_date,
    at: { index: list.findIndex((s) => s.id === id) },
    time_label: stop.time_label,
  };
}

/**
 * The rows to write so that each move lands where it says, applied in order.
 *
 * Only the days a move leaves or enters are renumbered. Each takes back the
 * positions its rows already held, in the new order, when they are all
 * different; when two rows share one (older plans have that), the day is
 * numbered afresh from its lowest. Rows that end up as they were are left out.
 */
export function rearrange<T extends MovableStop>(
  stops: readonly T[],
  moves: readonly StopMove[],
): ScheduleUpdate[] {
  const byId = new Map(stops.map((stop) => [stop.id, stop]));
  const days = new Map<string, string[]>();
  const dayOf = new Map<string, string | null>();
  const timeOf = new Map<string, string | null>();
  for (const stop of stops) {
    dayOf.set(stop.id, stop.day_date);
    timeOf.set(stop.id, stop.time_label);
  }
  const listFor = (day: string | null) => {
    const key = dayKey(day);
    let list = days.get(key);
    if (!list) {
      list = stopsOfDay(stops, day).map((stop) => stop.id);
      days.set(key, list);
    }
    return list;
  };
  const touched = new Set<string>();

  for (const move of moves) {
    if (!byId.has(move.id)) continue;
    const from = listFor(dayOf.get(move.id) ?? null);
    const fromIndex = from.indexOf(move.id);
    if (fromIndex >= 0) from.splice(fromIndex, 1);
    touched.add(dayKey(dayOf.get(move.id)));
    const to = listFor(move.day_date);
    const at = indexFor(
      to.map((id) => ({ id })),
      move.at,
    );
    to.splice(at, 0, move.id);
    touched.add(dayKey(move.day_date));
    dayOf.set(move.id, move.day_date);
    if (move.time_label !== undefined) timeOf.set(move.id, move.time_label);
  }

  const updates: ScheduleUpdate[] = [];
  const moved = new Set(moves.map((move) => move.id));
  for (const key of touched) {
    const list = days.get(key) ?? [];
    const held = list.map((id) => byId.get(id)!.position).sort((a, b) => a - b);
    const distinct = new Set(held).size === held.length;
    const base = held[0] ?? 0;
    list.forEach((id, index) => {
      const stop = byId.get(id)!;
      const position = distinct ? held[index]! : base + index;
      const day = dayOf.get(id) ?? null;
      const time = timeOf.get(id) ?? null;
      if (
        position !== stop.position ||
        dayKey(day) !== dayKey(stop.day_date) ||
        (moved.has(id) && time !== stop.time_label)
      ) {
        updates.push({ id, day_date: day, time_label: time, position });
      }
    });
  }
  return updates;
}

/**
 * The trip's days for moving between: every date from start to end, and any
 * day a stop already sits on outside them, in order.
 */
export function tripDays(
  start: string | null | undefined,
  end: string | null | undefined,
  stops: readonly { day_date: string | null }[],
  maxDays = 60,
): string[] {
  const days = new Set<string>();
  const from = start ? parseLocalDate(start) : undefined;
  const to = end ? parseLocalDate(end) : undefined;
  if (from && to && from <= to) {
    const day = new Date(from);
    for (let i = 0; i < maxDays && day <= to; i++) {
      days.add(toLocalISODate(day));
      day.setDate(day.getDate() + 1);
    }
  }
  for (const stop of stops) if (stop.day_date) days.add(stop.day_date);
  return [...days].sort();
}

/**
 * One step up or down. Inside a day it swaps with the neighbour; at the top
 * of a day Up goes to the end of the day before, and at the bottom Down to
 * the start of the day after. Undated stops only move among themselves.
 */
export function stepMove<T extends MovableStop>(
  stops: readonly T[],
  id: string,
  direction: -1 | 1,
  days: readonly string[],
): StopMove | null {
  const stop = stops.find((s) => s.id === id);
  if (!stop) return null;
  const list = stopsOfDay(stops, stop.day_date);
  const index = list.findIndex((s) => s.id === id);
  const next = index + direction;
  if (next >= 0 && next < list.length) {
    return { id, day_date: stop.day_date, at: { index: next } };
  }
  if (!stop.day_date) return null;
  const dayIndex = days.indexOf(stop.day_date);
  const otherDay = dayIndex < 0 ? undefined : days[dayIndex + direction];
  if (!otherDay) return null;
  return { id, day_date: otherDay, at: direction < 0 ? "end" : "start" };
}

const clock = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/**
 * Whether a timed stop's own time is out of order where it lands, and a time
 * that would fit: halfway between the timed stops either side (to the
 * quarter hour), or an hour after the one before / before the one after.
 * Null when the stop has no time or its time already fits.
 */
export function timeFit<T extends MovableStop>(
  stops: readonly T[],
  move: StopMove,
  minutesOf: (label: string | null | undefined) => number | null,
): { time: string; suggestion: string | null } | null {
  const stop = stops.find((s) => s.id === move.id);
  if (!stop) return null;
  const time = move.time_label !== undefined ? move.time_label : stop.time_label;
  const at = minutesOf(time);
  if (at == null || !time) return null;
  const list = stopsOfDay(stops, move.day_date, move.id);
  const index = indexFor(list, move.at);
  const before = list
    .slice(0, index)
    .map((s) => minutesOf(s.time_label))
    .filter((m): m is number => m != null);
  const after = list
    .slice(index)
    .map((s) => minutesOf(s.time_label))
    .filter((m): m is number => m != null);
  const prev = before.length ? Math.max(...before) : null;
  const next = after.length ? Math.min(...after) : null;
  if ((prev == null || at >= prev) && (next == null || at <= next)) return null;
  let suggestion: number | null = null;
  if (prev != null && next != null) {
    const mid = Math.round((prev + next) / 2 / 15) * 15;
    suggestion = Math.min(next, Math.max(prev, mid));
  } else if (prev != null) {
    suggestion = Math.min(prev + 60, 23 * 60 + 45);
  } else if (next != null) {
    suggestion = Math.max(next - 60, 0);
  }
  // Only a time that really sits between them: late at night there may be none.
  const fits =
    suggestion != null &&
    (prev == null || suggestion >= prev) &&
    (next == null || suggestion <= next);
  return { time, suggestion: fits ? clock(suggestion!) : null };
}

/**
 * A stop dragged onto another in the same day: dropped below it when it came
 * from above, and above it when it came from below, the way a list reads the
 * gesture. Null for a drop on itself or on another day.
 */
export function dropMove<T extends MovableStop>(
  stops: readonly T[],
  activeId: string,
  overId: string,
): StopMove | null {
  if (activeId === overId) return null;
  const active = stops.find((s) => s.id === activeId);
  const over = stops.find((s) => s.id === overId);
  if (!active || !over || dayKey(active.day_date) !== dayKey(over.day_date)) return null;
  const list = stopsOfDay(stops, active.day_date);
  const from = list.findIndex((s) => s.id === activeId);
  const to = list.findIndex((s) => s.id === overId);
  if (from < to) return { id: activeId, day_date: active.day_date, at: { after: overId } };
  const without = stopsOfDay(stops, active.day_date, activeId);
  return {
    id: activeId,
    day_date: active.day_date,
    at: { index: without.findIndex((s) => s.id === overId) },
  };
}
