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

import { haversine } from "./geo.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import { legModeFor } from "./travel-mode.ts";
import { timelineGlyph, type TimelineGlyph } from "./timeline-kind.ts";
import { timeForRail } from "./timeline-kind.ts";

export type ShapedItem = {
  kind?: string | null;
  title?: string | null;
  time_label?: string | null;
};

/** A shaped item that may also know where it is and how long the stop lasts. */
export type PacedItem = ShapedItem & {
  lat?: number | null;
  lon?: number | null;
  planned_stay_minutes?: number | null;
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

/**
 * The schedule has to miss by this much before it is worth interrupting the
 * traveller. A couple of minutes is rounding, not a useful warning.
 */
const MARGIN_MIN = 10;

function placedPoint(item: PacedItem): { lat: number; lon: number } | null {
  const { lat, lon } = item;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // 0,0 is where a failed geocode lands, not a stop.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/**
 * One sentence about a day that does not have enough time in it, or null.
 *
 * The old check compared only start times with a short walking estimate. That
 * missed the time spent at the first stop and deliberately ignored pairs more
 * than 5 km apart — exactly the journeys where an impossible schedule matters
 * most. This version includes the planned stay and uses Béa's standard
 * straight-line journey estimate whenever both pins are known. The shared
 * consequence engine can later replace the estimate with a routed leg.
 *
 * At most one, for the tightest pair on the day. A list of these would be a
 * report card, which is the thing this must never become.
 */
export function dayTightnessNote(items: readonly PacedItem[]): string | null {
  let worst: {
    title: string;
    nextTitle: string;
    gap: number;
    stay: number;
    travel: number;
    shortBy: number;
  } | null = null;

  for (let i = 0; i < items.length - 1; i += 1) {
    const from = items[i]!;
    const to = items[i + 1]!;

    const starts = minutesOfDay(from.time_label);
    const nextStarts = minutesOfDay(to.time_label);
    if (starts === null || nextStarts === null) continue;

    const gap = nextStarts - starts;
    // A same-day glance cannot safely interpret an overnight pair. The full
    // consequence engine uses day-qualified times for those.
    if (gap <= 0) continue;

    const a = placedPoint(from);
    const b = placedPoint(to);
    if (!a || !b) continue;

    // Walk what is close, drive the rest: a walking estimate for two stations
    // 40 km apart would read as eleven hours.
    const metres = haversine(a, b);
    const travel = Math.ceil(estimatedLegSeconds(metres, legModeFor("auto", metres)) / 60);
    const stay = Math.max(0, from.planned_stay_minutes ?? 0);
    const shortBy = stay + travel - gap;
    if (shortBy < MARGIN_MIN) continue;

    const fromTitle = (from.title ?? "").trim();
    const toTitle = (to.title ?? "").trim();
    if (!fromTitle || !toTitle) continue;

    if (!worst || shortBy > worst.shortBy) {
      worst = { title: fromTitle, nextTitle: toTitle, gap, stay, travel, shortBy };
    }
  }

  if (!worst) return null;
  if (worst.stay > 0) {
    return `${worst.gap} min between ${worst.title} and ${worst.nextTitle}, but ${worst.title} is planned for ${worst.stay} min and travel is about ${worst.travel}.`;
  }
  return `${worst.gap} min between ${worst.title} and ${worst.nextTitle}, and travel alone is about ${worst.travel}.`;
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
