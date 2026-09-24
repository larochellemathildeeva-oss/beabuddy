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
