/**
 * Doing a trip again: a copy of a trip on new dates, or one day of it
 * copied onto another day.
 *
 * Everything that describes the plan comes along — stops, times, kinds,
 * notes, addresses, pins, planned stays, what to see inside — moved by the
 * same number of days. What belonged to the last time does not: booking
 * marks and confirmation numbers (that table is not booked for the new
 * dates), and the "I'm here" record of what happened. Walk and drive rows
 * are left behind too; directions are worked out again for the new plan.
 *
 * Pure, so the copying rules are tested.
 */

import { isSavedDirectionItem } from "./direction-stops.ts";
import type { InsideEntry } from "./inside-list.ts";

export type SourceItem = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  position: number;
  planned_stay_minutes: number | null;
  parent_id?: string | null;
  inside?: InsideEntry[];
};

export type CopiedItem = {
  id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  position: number;
  planned_stay_minutes: number | null;
  parent_id?: string | null;
  inside?: InsideEntry[];
};

export type SourceStop = {
  kind: string;
  city: string;
  country: string | null;
  lat: number | null;
  lon: number | null;
  arrive_on: string | null;
  depart_on: string | null;
  position: number;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Whole days from one date to another; null unless both are dates. */
export function dayOffset(
  from: string | null | undefined,
  to: string | null | undefined,
): number | null {
  if (!from || !to || !ISO_DAY.test(from) || !ISO_DAY.test(to)) return null;
  const a = Date.UTC(+from.slice(0, 4), +from.slice(5, 7) - 1, +from.slice(8, 10));
  const b = Date.UTC(+to.slice(0, 4), +to.slice(5, 7) - 1, +to.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

/** A date moved by `offset` days; anything that is not a date is kept as it is. */
export function shiftDay(day: string | null, offset: number): string | null {
  if (!day || !ISO_DAY.test(day)) return day;
  const d = new Date(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10) + offset));
  return d.toISOString().slice(0, 10);
}

/**
 * The rows for the copy, with fresh ids so a stop inside another still
 * points at its copy. `newId` is injected so tests are repeatable.
 */
export function copyItems(
  items: readonly SourceItem[],
  placeDay: (day: string | null) => string | null,
  newId: () => string,
  firstPosition = 0,
): CopiedItem[] {
  const kept = items
    .filter((item) => item.title.trim() && !isSavedDirectionItem(item))
    .sort((a, b) => a.position - b.position);
  const ids = new Map(kept.map((item) => [item.id, newId()]));
  return kept.map((item, i) => {
    const parent = item.parent_id ? ids.get(item.parent_id) : undefined;
    return {
      id: ids.get(item.id)!,
      day_date: placeDay(item.day_date),
      time_label: item.time_label,
      kind: item.kind,
      title: item.title,
      detail: item.detail,
      address: item.address,
      lat: item.lat,
      lon: item.lon,
      position: firstPosition + i,
      planned_stay_minutes: item.planned_stay_minutes,
      ...(parent ? { parent_id: parent } : {}),
      ...(item.inside?.length ? { inside: item.inside } : {}),
    };
  });
}

/** A whole trip's stops on new dates, `offset` days later (or earlier). */
export function duplicateTripItems(
  items: readonly SourceItem[],
  offset: number,
  newId: () => string,
): CopiedItem[] {
  return copyItems(items, (day) => shiftDay(day, offset), newId);
}

/** One day's stops onto `target`, after what is already there. */
export function copyDayItems(
  items: readonly SourceItem[],
  sourceDay: string,
  target: string,
  newId: () => string,
  firstPosition: number,
): CopiedItem[] {
  return copyItems(
    items.filter((item) => item.day_date === sourceDay),
    () => target,
    newId,
    firstPosition,
  );
}

/** The trip's cities on the new dates. */
export function duplicateStops(stops: readonly SourceStop[], offset: number): SourceStop[] {
  return [...stops]
    .sort((a, b) => a.position - b.position)
    .map((stop, position) => ({
      ...stop,
      arrive_on: shiftDay(stop.arrive_on, offset),
      depart_on: shiftDay(stop.depart_on, offset),
      position,
    }));
}

/** "Lisbon" → "Lisbon again"; "Lisbon again" stays as it is. */
export function againTitle(title: string): string {
  const t = title.trim();
  return /\bagain$/i.test(t) ? t : `${t} again`;
}
