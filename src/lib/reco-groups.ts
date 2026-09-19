/**
 * The vault, split by what each saved place is to you.
 *
 * One flat list treated a place someone recommended last week and a restaurant
 * you ate at in 2019 as the same kind of row, and the only thing separating
 * them was a coloured dot. The type is already the most useful division in the
 * data — it is what the dot encodes, what the globe filters on, and the
 * question you are actually asking when you open the vault: what could I do,
 * versus what have I done.
 *
 * Category stays a filter rather than a grouping. Two ways of cutting the same
 * list at once reads as a spreadsheet.
 */

import type { PinType } from "../data/atlas.ts";

/**
 * Most actionable first, done last. A recommendation is someone waiting for an
 * answer; visited is a memory, and it has the globe and the story for that.
 */
export const RECO_GROUP_ORDER: PinType[] = ["reco", "wishlist", "nexttime", "visited"];

export type RecoGroup<T> = { type: PinType; rows: T[] };

/**
 * Groups in a fixed order, skipping the empty ones.
 *
 * Fixed rather than by-size: a vault whose headings reorder themselves as you
 * save things is one you have to re-read every visit.
 */
export function groupRecosByType<T extends { type: PinType }>(rows: readonly T[]): RecoGroup<T>[] {
  const buckets = new Map<PinType, T[]>();
  for (const row of rows) {
    const bucket = buckets.get(row.type);
    if (bucket) bucket.push(row);
    else buckets.set(row.type, [row]);
  }
  return RECO_GROUP_ORDER.flatMap((type) => {
    const group = buckets.get(type);
    return group && group.length > 0 ? [{ type, rows: group }] : [];
  });
}

/** "12 saved" / "1 saved" — the count, said once. */
export function groupCountLabel(count: number): string {
  return `${count} saved`;
}
