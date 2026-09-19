/**
 * What a day is made of, and where you are in it.
 *
 * A day heading used to read "Wed · Oct 7 — 18 things", which tells you the
 * size of the day and nothing about its shape. Eighteen museums and eighteen
 * meals are not the same Tuesday. Now that an entry's kind survives an import
 * rather than arriving as "Plan", the heading can say what the day actually
 * holds, and it costs nothing but counting.
 *
 * The other half is the line that says where you are. A plan you are standing
 * in the middle of is a different document from a plan you are reading at
 * home: what matters is what is next, not what the day contains. That needs
 * no schema and no ticking things off — only the clock and the times already
 * written down.
 */

import { timelineGlyph, type TimelineGlyph } from "./timeline-kind.ts";
import { timeForRail } from "./timeline-kind.ts";

export type ShapedItem = {
  kind?: string | null;
  title?: string | null;
  time_label?: string | null;
};

/** Plural-aware names for the glyphs, for a heading rather than a tooltip. */
const PLURAL: Record<TimelineGlyph, [string, string]> = {
  meal: ["meal", "meals"],
  lodging: ["stay", "stays"],
  transport: ["journey", "journeys"],
  sight: ["sight", "sights"],
  walk: ["walk", "walks"],
  note: ["note", "notes"],
  activity: ["thing", "things"],
};

/**
 * "4 sights · 2 meals · 1 walk", most of it first.
 *
 * Capped at three groups: past that it stops being a glance and becomes a
 * list, and the list is directly underneath.
 */
export function dayShapeLine(items: readonly ShapedItem[], limit = 3): string {
  const counts = new Map<TimelineGlyph, number>();
  for (const item of items) {
    const glyph = timelineGlyph(item);
    counts.set(glyph, (counts.get(glyph) ?? 0) + 1);
  }
  const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const shown = ordered.slice(0, limit);
  const rest = ordered.slice(limit).reduce((sum, [, n]) => sum + n, 0);

  const parts = shown.map(([glyph, n]) => {
    const [one, many] = PLURAL[glyph];
    return `${n} ${n === 1 ? one : many}`;
  });
  if (rest > 0) parts.push(`${rest} more`);
  return parts.join(" · ");
}

/** Minutes past midnight for a row, or null when it names no clock time. */
export function minutesOfDay(timeLabel: string | null | undefined): number | null {
  const rail = timeForRail(timeLabel);
  const match = /^(\d{2}):(\d{2})$/.exec(rail);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Where the "now" line belongs: before the first entry still to come.
 *
 * Returns an index into `items` — 0 means the day has not started, and
 * `items.length` means it is behind you. Null means the day cannot say,
 * because nothing in it carries a time; drawing a line through an untimed
 * list would be inventing an order the plan never claimed.
 */
export function nowDivider(items: readonly ShapedItem[], minutesNow: number): number | null {
  let seenTime = false;
  for (let i = 0; i < items.length; i += 1) {
    const at = minutesOfDay(items[i]?.time_label);
    if (at === null) continue;
    seenTime = true;
    if (at > minutesNow) return i;
  }
  return seenTime ? items.length : null;
}

/** The next thing, for a day in progress. */
export function nextUp<T extends ShapedItem>(items: readonly T[], minutesNow: number): T | null {
  const at = nowDivider(items, minutesNow);
  if (at === null || at >= items.length) return null;
  return items[at] ?? null;
}

/** "in 30 min", "in 2 h 10", or null when it is not worth saying. */
export function minutesUntilLabel(item: ShapedItem | null, minutesNow: number): string | null {
  if (!item) return null;
  const at = minutesOfDay(item.time_label);
  if (at === null) return null;
  const delta = at - minutesNow;
  if (delta <= 0 || delta > 6 * 60) return null;
  if (delta < 60) return `in ${delta} min`;
  const hours = Math.floor(delta / 60);
  const mins = delta % 60;
  return mins === 0 ? `in ${hours} h` : `in ${hours} h ${String(mins).padStart(2, "0")}`;
}
