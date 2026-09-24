/**
 * Which day of the trip you are looking at.
 *
 * The timeline renders every day stacked, which is the right shape for
 * planning and the wrong one for standing in a city at nine in the morning.
 * A day is what you actually execute: it is one place, at walking scale, with
 * a handful of stops — and once the screen is scoped to it, several other
 * things stop being ambiguous. A map of one day needs no choice between
 * cities and stops. A leg between consecutive stops is a real walk rather
 * than an intercity hop. "Leave by" has a next stop to count back from.
 *
 * So this is a filter over the groups `groupTimelineByDay` already returns,
 * not a second way of organising them.
 *
 * `ALL_DAYS` stays, and stays the default outside the trip: a plan you are
 * still writing is read whole. Only a trip you are *on* opens to a single
 * day, because then there is a right answer and it is today.
 */

import type { TimelineDayGroup } from "./timeline-groups.ts";

/** The whole trip, every day at once — the view this screen has always had. */
export const ALL_DAYS = "__all__";

/** `ALL_DAYS`, or a group key: a `YYYY-MM-DD`, or "" for the undated pile. */
export type DayChoice = string;

export type DayChip = {
  /** The group key this chip selects. */
  key: string;
  /** "Day 1", or "" for the undated group, which is no day in particular. */
  ordinal: string;
  /** "Sat · Sep 12", or "No date". */
  label: string;
  count: number;
  isToday: boolean;
};

/**
 * One chip per day, numbered.
 *
 * The number counts dated days only. An undated pile is not "Day 4" — it is
 * the rows Béa could not place in time, and calling it a day would be a
 * claim about when they happen.
 */
export function dayChips<T extends { day_date: string | null }>(
  groups: readonly TimelineDayGroup<T>[],
  todayKey: string,
): DayChip[] {
  let dated = 0;
  return groups.map((group) => {
    const isDated = group.key !== "";
    if (isDated) dated += 1;
    return {
      key: group.key,
      ordinal: isDated ? `Day ${dated}` : "",
      label: group.label,
      count: group.items.length,
      isToday: isDated && group.key === todayKey,
    };
  });
}

/**
 * Which day to open on.
 *
 * Today when the trip is running, because that is the only day with a right
 * answer. Otherwise the whole trip: a plan being written is read whole, and
 * opening a future trip on its first day would hide the rest of it behind a
 * control the person has not noticed yet.
 */
export function defaultDayChoice<T extends { day_date: string | null }>(
  groups: readonly TimelineDayGroup<T>[],
  todayKey: string,
): DayChoice {
  // The key has to be a real date. The undated pile's key is "", and an empty
  // `todayKey` would otherwise match it and open the trip on the rows Béa
  // could not place in time — which is the one group that is never today.
  const onToday = groups.some((group) => group.key !== "" && group.key === todayKey);
  return onToday ? todayKey : ALL_DAYS;
}

/**
 * The groups to render for a choice.
 *
 * A choice that no longer matches anything falls back to the whole trip
 * rather than an empty screen — the day can disappear underneath it when the
 * last row on it is removed, or when a collaborator moves one.
 */
export function visibleGroups<T extends { day_date: string | null }>(
  groups: readonly TimelineDayGroup<T>[],
  choice: DayChoice,
): TimelineDayGroup<T>[] {
  if (choice === ALL_DAYS) return [...groups];
  const picked = groups.filter((group) => group.key === choice);
  return picked.length ? picked : [...groups];
}

/**
 * Whether the strip is worth showing at all.
 *
 * One day is not a choice, and a trip with nothing on it is not a trip yet.
 * Both would render a control that does nothing, which is worse than no
 * control.
 */
export function shouldOfferDays<T extends { day_date: string | null }>(
  groups: readonly TimelineDayGroup<T>[],
): boolean {
  return groups.length > 1;
}
