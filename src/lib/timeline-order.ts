/**
 * Moving a saved timeline entry up or down.
 *
 * Rows come back ordered by day first and position second, so swapping
 * positions with whatever happens to be next in the list is only meaningful
 * inside one day: across a day boundary the day still decides, and the row
 * would appear not to move at all. So a move finds its neighbour within the
 * same day, and the ends of a day are simply not movable — changing the day
 * is a different action, and it has its own control.
 *
 * Undated entries group together the same way, under a shared empty day.
 */

export type OrderedItem = { id: string; day_date: string | null; position: number };

/** The entry a move would swap with, or null at the ends of a day. */
export function neighbourInDay<T extends OrderedItem>(
  items: readonly T[],
  id: string,
  direction: -1 | 1,
): T | null {
  const index = items.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const current = items[index]!;
  const next = items[index + direction];
  if (!next) return null;
  // `?? ""` so two undated rows count as the same day rather than two nulls
  // that never match.
  return (next.day_date ?? "") === (current.day_date ?? "") ? next : null;
}

/** Whether an entry can move that way at all — for hiding a dead arrow. */
export function canMove<T extends OrderedItem>(
  items: readonly T[],
  id: string,
  direction: -1 | 1,
): boolean {
  return neighbourInDay(items, id, direction) !== null;
}

/**
 * The next position to hand a new row.
 *
 * One past the highest, not the number of rows: after a remove the list is
 * shorter than its highest position, so counting rows hands the next two
 * additions a position something already holds — and two rows sharing a
 * position cannot be told apart by a swap. trip_stops learned this the hard
 * way; the timeline had the same arithmetic and no reorder to expose it.
 */
export function nextPosition(items: readonly { position: number }[]): number {
  return items.reduce((max, item) => Math.max(max, item.position + 1), 0);
}

/**
 * Room for a new row straight after `afterId`.
 *
 * Positions are one integer sequence across the trip, so making a gap means
 * moving every row after the anchor down by one. Returns those moves and the
 * position the new row takes; with an unknown anchor, the row goes last.
 */
export function insertAfter<T extends { id: string; position: number }>(
  items: readonly T[],
  afterId: string,
): { position: number; shifts: { id: string; position: number }[] } {
  const anchor = items.find((item) => item.id === afterId);
  if (!anchor) return { position: nextPosition(items), shifts: [] };
  const shifts = items
    .filter((item) => item.position > anchor.position)
    .map((item) => ({ id: item.id, position: item.position + 1 }));
  return { position: anchor.position + 1, shifts };
}

/**
 * Where a stop belongs by its day and time, for adding one or changing its
 * time: straight after the last stop on that day at or before its time.
 *
 * A stop without a clock time goes to the end of its day. A timed stop goes
 * before the first later-timed stop, stepping over untimed ones only when
 * they sit after it. A day with nothing on it yet takes the place after the
 * last stop of the days before it. Other stops keep their times; only their
 * places in the list move, to make room.
 */
export function chronologicalSlot<
  T extends { id: string; day_date: string | null; position: number; time_label: string | null },
>(
  items: readonly T[],
  entry: { day_date?: string | null; time_label?: string | null },
  minutesOf: (label: string | null | undefined) => number | null,
  ignoreId?: string,
): { position: number; shifts: { id: string; position: number }[] } {
  const others = items.filter((item) => item.id !== ignoreId);
  const day = entry.day_date ?? "";
  const sameDay = others.filter((item) => (item.day_date ?? "") === day);
  const at = minutesOf(entry.time_label);
  let anchor: T | undefined;
  if (sameDay.length > 0) {
    if (at == null) {
      anchor = sameDay[sameDay.length - 1];
    } else {
      const later = sameDay.findIndex((item) => {
        const m = minutesOf(item.time_label);
        return m != null && m > at;
      });
      if (later === 0) {
        // Before everything on the day: after whatever comes just before it.
        const first = sameDay[0]!;
        const before = others.filter((item) => item.position < first.position);
        anchor = before.sort((a, b) => a.position - b.position)[before.length - 1];
        if (!anchor) return makeRoomAt(others, first.position);
      } else {
        anchor = later < 0 ? sameDay[sameDay.length - 1] : sameDay[later - 1];
      }
    }
  } else if (day) {
    // A new day: after the last stop on an earlier day.
    const earlier = others.filter((item) => item.day_date && item.day_date < day);
    anchor = earlier.sort((a, b) => a.position - b.position)[earlier.length - 1];
    if (!anchor) return { position: nextPosition(others), shifts: [] };
  } else {
    return { position: nextPosition(others), shifts: [] };
  }
  return anchor ? insertAfter(others, anchor.id) : { position: nextPosition(others), shifts: [] };
}

function makeRoomAt<T extends { id: string; position: number }>(
  items: readonly T[],
  position: number,
): { position: number; shifts: { id: string; position: number }[] } {
  const shifts = items
    .filter((item) => item.position >= position)
    .map((item) => ({ id: item.id, position: item.position + 1 }));
  return { position, shifts };
}
