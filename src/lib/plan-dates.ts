/**
 * A pasted plan whose dates are not the trip's.
 *
 * "Oct 7 — Hiroshima + Miyajima" pasted into a trip set for Sep 7: one of
 * the two is wrong, and only the traveller knows which. Saving used to
 * settle it silently — the plan's dates overwrote the trip's, so a one-day
 * import could move or shrink a whole trip without a word. Now the review
 * asks, and this is the arithmetic behind both answers.
 */

import { parseLocalDate, toLocalISODate } from "./trip-dates.ts";

export type DateRange = { start: string; end: string };

/** The first and last dates a plan's rows carry, or null when none is dated. */
export function planRange(items: readonly { day_date?: string | null }[]): DateRange | null {
  const dates = items
    .map((item) => item.day_date ?? "")
    .filter((date) => parseLocalDate(date) !== undefined)
    .sort();
  if (dates.length === 0) return null;
  return { start: dates[0]!, end: dates[dates.length - 1]! };
}

/**
 * Whether the plan falls outside the trip's dates. A trip with no dates
 * cannot disagree: it simply takes the plan's.
 */
export function planOutsideTrip(
  plan: DateRange | null,
  tripStart: string | null | undefined,
  tripEnd: string | null | undefined,
): boolean {
  if (!plan || !tripStart || !parseLocalDate(tripStart)) return false;
  const end = tripEnd && parseLocalDate(tripEnd) ? tripEnd : tripStart;
  return plan.start < tripStart || plan.end > end;
}

/** Whole days from one date to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return 0;
  // Rounded, so a clock change inside the span cannot make it 29.96 days.
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date);
  if (!d) return date;
  d.setDate(d.getDate() + days);
  return toLocalISODate(d);
}

/** Every dated row moved by the same number of days; undated rows stay as they are. */
export function shiftPlanDates<T extends { day_date?: string | null }>(
  items: readonly T[],
  days: number,
): T[] {
  if (days === 0) return [...items];
  return items.map((item) =>
    item.day_date && parseLocalDate(item.day_date)
      ? { ...item, day_date: addDays(item.day_date, days) }
      : item,
  );
}

/**
 * The trip's dates after "move the trip to the plan": it starts when the
 * plan does, and keeps its own length unless the plan is longer. Moving a
 * week-long trip to a one-day plan must not shrink it to one day.
 */
export function movedTripRange(trip: DateRange, plan: DateRange): DateRange {
  const tripDays = Math.max(0, daysBetween(trip.start, trip.end));
  const planDays = Math.max(0, daysBetween(plan.start, plan.end));
  return { start: plan.start, end: addDays(plan.start, Math.max(tripDays, planDays)) };
}
