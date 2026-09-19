/**
 * "Day 1" and "Day 2", turned into real dates.
 *
 * Almost no itinerary anyone pastes carries calendar dates. A ChatGPT answer,
 * a travel blog, a Reddit guide — they all say "Day 1" and "Day 2", because
 * the person writing them has no idea when you are going. Béa asked the model
 * for a `day_date` and got null for every row, so every entry landed in one
 * undated pile with Day 1 and Day 2 merged: the times were right, the shape
 * of the trip was gone, and putting it back meant editing twenty rows by hand.
 *
 * The model can answer a much easier question — which numbered day is this? —
 * and the arithmetic from there is ours, not a guess. All this needs is the
 * date the trip starts, which is one field, asked once, instead of a date
 * chosen twenty times.
 */

import { parseLocalDate, toLocalISODate } from "./trip-dates.ts";

export type DayNumbered = {
  day_date: string | null;
  day_number?: number | null | undefined;
};

/** The day a row belongs to, 1-based, or null when it says nothing. */
function dayNumber(item: DayNumbered): number | null {
  const n = item.day_number;
  return typeof n === "number" && Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

/**
 * Rows that know which day they are, but not which date.
 *
 * A row that already carries a date is finished — a source that names real
 * dates is better evidence than any arithmetic we could do.
 */
export function hasRelativeDays(items: readonly DayNumbered[]): boolean {
  return items.some((item) => !item.day_date && dayNumber(item) !== null);
}

/** How many numbered days the plan covers, for "Béa found 2 days". */
export function relativeDayCount(items: readonly DayNumbered[]): number {
  const days = new Set<number>();
  for (const item of items) {
    const n = dayNumber(item);
    if (n !== null && !item.day_date) days.add(n);
  }
  return days.size;
}

/**
 * Fill in `day_date` from `day_number`, counting from the trip's first day.
 *
 * Day 1 is the start date, not the day after it. A row that already has a
 * date keeps it, and a row with neither is left alone rather than being
 * swept onto day one — an entry Béa could not place in time is honest; an
 * entry silently dated wrong is not.
 */
export function resolveDayDates<T extends DayNumbered>(items: readonly T[], startISO: string): T[] {
  const start = parseLocalDate(startISO);
  if (!start) return [...items];

  return items.map((item) => {
    if (item.day_date) return item;
    const n = dayNumber(item);
    if (n === null) return item;
    const date = new Date(start);
    date.setDate(date.getDate() + (n - 1));
    return { ...item, day_date: toLocalISODate(date) };
  });
}

/** The last day a resolved plan covers, so the trip's end date can follow. */
export function lastDayDate(items: readonly DayNumbered[]): string | null {
  let latest: string | null = null;
  for (const item of items) {
    if (item.day_date && (latest === null || item.day_date > latest)) latest = item.day_date;
  }
  return latest;
}
