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
import { timelineGlyph, type TimelineGlyph } from "./timeline-kind.ts";
import { timeForRail } from "./timeline-kind.ts";

export type ShapedItem = {
  kind?: string | null;
  title?: string | null;
  time_label?: string | null;
};

/** A shaped item that may also know where it is. */
export type PacedItem = ShapedItem & {
  lat?: number | null;
  lon?: number | null;
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
 * Metres a minute on foot. A city walk with crossings and a map check, not an
 * athlete on an empty road — the number is deliberately slow, because the
 * point of the note below is to be right rather than encouraging.
 */
const WALK_METRES_PER_MIN = 70;

/**
 * The gap has to be short of the walk by this much before it is worth saying.
 * Two minutes of daylight between them is rounding, not a problem, and a note
 * that fires on rounding is a note you learn to stop reading.
 */
const MARGIN_MIN = 10;

/**
 * Past this, straight line, nobody walks it: it is a train, a ferry or a
 * taxi, and a walking time for it ("the walk alone is about 252") is noise.
 */
const MAX_WALK_METRES = 5000;

/**
 * Past a walk, the only claim worth making is that the gap is impossible,
 * not that it is tight: a ride between two pins could be a car, a metro or a
 * Shinkansen, and guessing which is how a fine plan gets a wrong warning. So
 * the ride is timed at 200 km/h along the straight line — faster than any
 * train runs door to door — and only a gap shorter than even that is named:
 * "Senso-ji 09:00, Nagoya Castle 09:30" is 269 km in half an hour.
 */
const FASTEST_RIDE_METRES_PER_MIN = 200_000 / 60;

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
 * This is deliberately not a score. It says nothing about the day as a whole,
 * ranks nothing, and rates nothing — it names two stops and two numbers that
 * are both already written down, and leaves the conclusion to you. A day the
 * arithmetic cannot fault says nothing at all, which is most days.
 *
 * It only speaks when the plan gave it both halves: two clock times and two
 * positions. Guessing the walk between an unplaced stop and a vague one is how
 * you get a warning that is confidently wrong, and a wrong warning about your
 * own holiday is worse than silence.
 *
 * At most one, for the tightest pair on the day. A list of these would be a
 * report card, which is the thing this must never become.
 */
export function dayTightnessNote(items: readonly PacedItem[]): string | null {
  let worst: {
    title: string;
    nextTitle: string;
    gap: number;
    need: number;
    km: number | null;
  } | null = null;

  for (let i = 0; i < items.length - 1; i += 1) {
    const from = items[i]!;
    const to = items[i + 1]!;

    const leaves = minutesOfDay(from.time_label);
    const arrives = minutesOfDay(to.time_label);
    if (leaves === null || arrives === null) continue;

    const gap = arrives - leaves;
    // Out of order, or so far apart the day is not the problem.
    if (gap <= 0 || gap > 4 * 60) continue;

    const a = placedPoint(from);
    const b = placedPoint(to);
    if (!a || !b) continue;

    const metres = haversine(a, b);
    const ride = metres > MAX_WALK_METRES;
    // A journey row's time is when it leaves and its pin may be either end,
    // so the gap after it says nothing about the ride itself.
    if (ride && (timelineGlyph(from) === "transport" || timelineGlyph(to) === "transport")) {
      continue;
    }
    const need = ride
      ? Math.ceil(metres / FASTEST_RIDE_METRES_PER_MIN)
      : Math.round(metres / WALK_METRES_PER_MIN);
    // The ride time is already a bound nothing beats, so any shortfall is
    // impossible; the margin is for the walk, which is only a fair guess.
    if (ride ? need <= gap : need - gap < MARGIN_MIN) continue;

    const fromTitle = (from.title ?? "").trim();
    const toTitle = (to.title ?? "").trim();
    if (!fromTitle || !toTitle) continue;

    if (!worst || need - gap > worst.need - worst.gap) {
      const km = ride ? Math.round(metres / 1000) : null;
      worst = { title: fromTitle, nextTitle: toTitle, gap, need, km };
    }
  }

  if (!worst) return null;
  const between = `${worst.gap} min between ${worst.title} and ${worst.nextTitle}`;
  return worst.km === null
    ? `${between}, and the walk alone is about ${worst.need}.`
    : `${between}, about ${worst.km} km apart: even at 200 km/h in a straight line that is about ${worst.need}.`;
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
