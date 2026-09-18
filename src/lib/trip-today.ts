/**
 * What the trip page should say about today.
 *
 * The calendar answers "what have I got on, across everything" — a month grid
 * over every trip. That is a different question from the one you ask standing
 * inside a trip, which is nearly always "what is on today", or, before you
 * leave, "how long have I got and what happens on day one". This works that
 * out so the trip page can answer it inline, without sending you to a month
 * view to read a single day.
 */

import { parseLocalDate } from "./trip-dates.ts";

export type TodayItem = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  position: number;
};

export type TripTodayView<T extends TodayItem = TodayItem> =
  /** Today falls inside the trip. */
  | { state: "today"; date: string; items: T[] }
  /** The trip has not started; `date` is its first day. */
  | { state: "upcoming"; date: string; daysUntil: number; items: T[] }
  /** The trip has finished. */
  | { state: "past"; date: string }
  /** No usable dates on the trip, so there is no day to show. */
  | { state: "undated" };

function dayDiff(from: string, to: string): number | undefined {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return undefined;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** Entries on one day, in the order the timeline shows them. */
export function itemsOnDay<T extends TodayItem>(items: readonly T[], day: string): T[] {
  return items.filter((i) => i.day_date === day).sort((a, b) => a.position - b.position);
}

export function tripTodayView<T extends TodayItem>(
  {
    startDate,
    endDate,
    items,
  }: {
    startDate: string | null | undefined;
    endDate: string | null | undefined;
    items: readonly T[];
  },
  today: string,
): TripTodayView<T> {
  const start = startDate ?? undefined;
  if (!start || !parseLocalDate(start)) return { state: "undated" };
  // A trip with no end date is a single day.
  const end = endDate && parseLocalDate(endDate) ? endDate : start;

  if (today >= start && today <= end) {
    return { state: "today", date: today, items: itemsOnDay(items, today) };
  }
  if (today < start) {
    const daysUntil = dayDiff(today, start);
    if (daysUntil === undefined) return { state: "undated" };
    return { state: "upcoming", date: start, daysUntil, items: itemsOnDay(items, start) };
  }
  return { state: "past", date: end };
}

/** "Today", "Tomorrow", "In 6 days" — the countdown, said the short way. */
export function untilLabel(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 7) return `In ${daysUntil} days`;
  if (daysUntil < 14) return "Next week";
  if (daysUntil < 60) return `In ${Math.round(daysUntil / 7)} weeks`;
  return `In ${Math.round(daysUntil / 30)} months`;
}
