/**
 * The Trips tab (UI revamp step 7): the device's layout choice, the countdown
 * in the next trip's circle, the tag on each row, and where the trips' tags
 * sit on the header's map. Plain words and numbers, tested on their own.
 */

import { distanceKm, SAME_PLACE_KM } from "./home-route-map.ts";

/** "big": the next trip as a large banner; "list": every trip as a row. */
export const TRIPS_LAYOUTS = ["big", "list"] as const;
export type TripsLayout = (typeof TRIPS_LAYOUTS)[number];

export const TRIPS_LAYOUT_KEY = "bea-trips-layout";

/** Big banner by default, as in the mockup; anything unknown reads as that. */
export function asTripsLayout(raw: unknown): TripsLayout {
  return raw === "list" ? "list" : "big";
}

function localDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function daysBetween(a: Date, b: Date): number {
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * The circle on the next trip: "4 / days" before it, "3 / of 5" during it,
 * "Today" on the day it starts. Null when there is nothing to count: no
 * dates, a trip that is over, or one so far off a number means nothing.
 */
export function tripCountdown(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): { value: string; unit: string; label: string } | null {
  const from = localDate(start);
  if (!from) return null;
  const to = localDate(end) ?? from;
  const until = daysBetween(now, from);
  if (until > 99) return null;
  if (until > 1) return { value: String(until), unit: "days", label: `In ${until} days` };
  if (until === 1) return { value: "1", unit: "day", label: "Tomorrow" };
  if (until === 0) return { value: "Today", unit: "", label: "Leaving today" };
  const day = daysBetween(from, now) + 1;
  const length = daysBetween(from, to) + 1;
  if (day > length) return null;
  return { value: String(day), unit: `of ${length}`, label: `Day ${day} of ${length}` };
}

export type RowTag = { text: string; tone: "live" | "soon" | "draft" };

/**
 * The small tag on a trip's row: live while it happens, how soon for the
 * next fortnight, Draft without dates, Tentative for loose dates further off.
 */
export function tripRowTag(
  trip: { start_date: string | null; end_date: string | null; dates_status?: string | null },
  now = new Date(),
): RowTag | null {
  const from = localDate(trip.start_date);
  if (!from) return { text: "Draft", tone: "draft" };
  const to = localDate(trip.end_date) ?? from;
  const until = daysBetween(now, from);
  if (until <= 0 && daysBetween(now, to) >= 0) return { text: "Underway", tone: "live" };
  if (until === 1) return { text: "Tomorrow", tone: "soon" };
  if (until > 1 && until < 14) return { text: `In ${until} days`, tone: "soon" };
  if (until > 0 && trip.dates_status === "tentative") return { text: "Tentative", tone: "draft" };
  return null;
}

/** "Oct 2026": the month a trip starts (or ends, with no start), in the reader's language. */
export function tripMonth(start: string | null | undefined, end?: string | null): string {
  const d = localDate(start) ?? localDate(end);
  return d ? d.toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "";
}

/**
 * Trips going to the same place (within `km` of the first of the group)
 * share one tag on the header's map, in the order given: four trips to Lisbon
 * are one pin, not four tags on top of each other.
 */
export function groupByPlace<T extends { lat: number; lon: number }>(
  items: readonly T[],
  km = SAME_PLACE_KM,
): T[][] {
  const groups: T[][] = [];
  for (const item of items) {
    const home = groups.find((g) => distanceKm(g[0]!, item) < km);
    if (home) home.push(item);
    else groups.push([item]);
  }
  return groups;
}

/**
 * The trips the header's map names: the ones ahead first, then the ones
 * behind, at most `max`. With nothing dated, the drafts.
 */
export function heroTrips<T>(lists: { upcoming: T[]; past: T[]; drafts: T[] }, max = 4): T[] {
  const dated = [...lists.upcoming, ...lists.past];
  return (dated.length ? dated : lists.drafts).slice(0, max);
}

export type TagBox = { x: number; y: number; width: number; height: number; left: boolean };

/**
 * Where each trip's tag sits beside its pin on the header's map: to the
 * right of the pin, or to its left near the right edge, and moved down (then
 * up) past a pin or a tag already placed rather than over it, and null when
 * there is no room. Kept inside the frame.
 */
export function placeTags(
  pins: readonly { x: number; y: number }[],
  widths: readonly number[],
  frame: { width: number; top: number; bottom: number },
  height = 44,
  gap = 6,
): (TagBox | null)[] {
  // Every pin is a box no tag may cover.
  const placed: TagBox[] = pins.map((p) => ({
    x: p.x - 7,
    y: p.y - 7,
    width: 14,
    height: 14,
    left: false,
  }));
  const overlaps = (a: TagBox) =>
    placed.some(
      (b) =>
        a.x < b.x + b.width + gap &&
        b.x < a.x + a.width + gap &&
        a.y < b.y + b.height + gap &&
        b.y < a.y + a.height + gap,
    );
  const clampY = (y: number) => Math.max(frame.top, Math.min(frame.bottom - height, y));
  return pins.map((pin, i) => {
    const width = widths[i] ?? 120;
    const left = pin.x + 10 + width > frame.width - 8;
    const x = Math.max(8, left ? pin.x - 10 - width : pin.x + 10);
    let box: TagBox = { x, y: clampY(pin.y - height / 2), width, height, left };
    // Beside the pin, else on its other side, before moving up or down.
    if (overlaps(box)) {
      const other = { ...box, x: Math.max(8, left ? pin.x + 10 : pin.x - 10 - width), left: !left };
      if (other.x + width <= frame.width - 8 && !overlaps(other)) box = other;
    }
    for (let step = 1; overlaps(box) && step <= 8; step++) {
      // Alternate below and above, further each time.
      const shift = Math.ceil(step / 2) * (height + gap) * (step % 2 ? 1 : -1);
      box = { ...box, y: clampY(pin.y - height / 2 + shift) };
    }
    // No room without covering another tag or pin: this one is left off.
    if (overlaps(box)) return null;
    placed.push(box);
    return box;
  });
}
