/**
 * Trip Checkup: the things on a plan worth a second look before you go.
 *
 * A stop dated after the trip ends, two stops booked for the same hour, a
 * journey the gap between them cannot hold, a hotel marked booked with no
 * confirmation saved. Each of these is arithmetic on what the timeline
 * already stores, so this is pure, tested, and asks nothing of the network:
 * no geocode, no route, no model.
 *
 * It only says what it can measure. A stop with no clock time is never
 * "late"; a stop with no pin is never "far". A wrong warning about your own
 * holiday is worse than silence, and a plan the arithmetic cannot fault
 * says so plainly rather than inventing something to report. It is not a
 * score: nothing is rated, only named, and each finding points at a stop.
 */

import { haversine } from "./geo.ts";
import { normaliseKind, timeForRail, type TimelineKind } from "./timeline-kind.ts";
import { formatTimelineDayLabel } from "./timeline-groups.ts";

export type CheckupStop = {
  id: string;
  kind: string | null;
  title: string | null;
  day_date: string | null;
  time_label: string | null;
  lat?: number | null;
  lon?: number | null;
  booked?: boolean | null;
  booking_ref?: string | null;
  planned_stay_minutes?: number | null;
};

export type CheckupKind =
  | "outside"
  | "overlap"
  | "tight"
  | "not-booked"
  | "no-ref"
  | "unplaced"
  | "stray"
  | "undated"
  | "no-stay";

export type CheckupFinding = {
  /** Stable across renders: the check and the stop(s) it names. */
  key: string;
  kind: CheckupKind;
  /** "warn" is something that will go wrong as planned; "info" is missing. */
  tone: "warn" | "info";
  /** The stop to open, or null for a finding about the trip as a whole. */
  stopId: string | null;
  /** "Sat · Oct 3", or "" when the finding has no day. */
  dayLabel: string;
  text: string;
};

export type CheckupInput = {
  start_date?: string | null;
  end_date?: string | null;
  /** The timeline's stops in plan order, without its saved walk/drive rows. */
  items: readonly CheckupStop[];
  /**
   * Minutes of travel between two stops when a route has already been worked
   * out (live or saved on the phone). Null when none is known, and the check
   * falls back to a straight-line walk, which it says.
   */
  travelMinutes?: ((from: CheckupStop, to: CheckupStop) => number | null) | undefined;
  /** Stops pinned far from the rest of the trip (`strayStopIds`). */
  strayIds?: ReadonlySet<string> | undefined;
};

/** Kinds that are a booking first, so "not booked" means something. */
const MUST_BOOK = new Set<TimelineKind>(["flight", "hotel", "lodging", "reservation"]);
/** Kinds whose confirmation number is worth having at the door. */
const HAS_REF = new Set<TimelineKind>(["flight", "hotel", "lodging", "reservation", "transport"]);
/**
 * Kinds you go to, so a missing pin matters (a flight's is its airport).
 * A walk is often a route, not a point.
 */
const PLACED = new Set<TimelineKind>([
  "flight",
  "hotel",
  "lodging",
  "reservation",
  "meal",
  "sight",
  "activity",
]);
/**
 * Kinds that take part in the day's sequence of times. A bed has a check-in
 * time but you are not "at" it while you sightsee, a flight's pin is an
 * airport, and a note is not anywhere.
 */
const SEQUENCED = new Set<TimelineKind>(["reservation", "meal", "sight", "walk", "activity"]);

/** Same pace and limits as the day's tightness note: slow, and honest. */
const WALK_METRES_PER_MIN = 70;
const MAX_WALK_METRES = 5000;
/** Short by less than this is rounding, not a problem. */
const TIGHT_MARGIN_MIN = 10;
/** Past this, the gap is not the day's problem. */
const MAX_GAP_MIN = 4 * 60;

const ORDER: readonly CheckupKind[] = [
  "outside",
  "overlap",
  "tight",
  "not-booked",
  "no-ref",
  "unplaced",
  "stray",
  "undated",
  "no-stay",
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function titleOf(stop: CheckupStop): string {
  const text = (stop.title ?? "").trim();
  return text || "A stop";
}

function pointOf(stop: CheckupStop): { lat: number; lon: number } | null {
  const { lat, lon } = stop;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  // 0,0 is where a failed geocode lands, not a stop.
  if (lat === 0 && lon === 0) return null;
  return { lat, lon };
}

/**
 * Minutes past midnight for a real clock time, or null. "10:99" from an
 * import is not a time, and treating it as 11:39 would invent a clash.
 */
function clockMinutes(label: string | null | undefined): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(timeForRail(label));
  if (!m) return null;
  const hours = Number(m[1]);
  const minutes = Number(m[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function shortDay(day: string): string {
  // "Sat · Oct 3" → "Oct 3", for inside a sentence.
  const label = formatTimelineDayLabel(day);
  return label.includes(" · ") ? label.split(" · ")[1]! : label;
}

function dayLabelOf(day: string | null | undefined): string {
  return day && DAY_RE.test(day) ? formatTimelineDayLabel(day) : "";
}

/** Everything worth a second look, most pressing first, then in plan order. */
export function tripCheckup(input: CheckupInput): CheckupFinding[] {
  const out: CheckupFinding[] = [];
  const start = input.start_date && DAY_RE.test(input.start_date) ? input.start_date : null;
  const end = input.end_date && DAY_RE.test(input.end_date) ? input.end_date : start;
  const items = input.items.map((item) => ({ item, kind: normaliseKind(item.kind) }));

  const add = (
    kind: CheckupKind,
    stop: CheckupStop | null,
    text: string,
    tone: "warn" | "info",
    keyExtra = "",
  ) =>
    out.push({
      key: `${kind}:${stop?.id ?? "trip"}${keyExtra}`,
      kind,
      tone,
      stopId: stop?.id ?? null,
      dayLabel: dayLabelOf(stop?.day_date),
      text,
    });

  // Dated outside the trip.
  if (start && end) {
    for (const { item, kind } of items) {
      const day = item.day_date;
      if (!day || !DAY_RE.test(day) || kind === "note") continue;
      if (day < start) {
        add(
          "outside",
          item,
          `${titleOf(item)} is on ${shortDay(day)}, before the trip starts (${shortDay(start)}).`,
          "warn",
        );
      } else if (day > end) {
        add(
          "outside",
          item,
          `${titleOf(item)} is on ${shortDay(day)}, after the trip ends (${shortDay(end)}).`,
          "warn",
        );
      }
    }
  }

  // Overlaps and journeys too tight, between neighbours on the same day.
  const byDay = new Map<string, { item: CheckupStop; at: number }[]>();
  for (const { item, kind } of items) {
    if (!item.day_date || !SEQUENCED.has(kind)) continue;
    const at = clockMinutes(item.time_label);
    if (at === null) continue;
    const list = byDay.get(item.day_date) ?? [];
    list.push({ item, at });
    byDay.set(item.day_date, list);
  }
  for (const list of byDay.values()) {
    // By the clock: a plan's order and its times can disagree, and the
    // times are what the traveller will keep.
    const timed = [...list].sort((a, b) => a.at - b.at);
    for (let i = 0; i < timed.length - 1; i += 1) {
      const a = timed[i]!;
      const b = timed[i + 1]!;
      const pair = `>${b.item.id}`;
      const stay = a.item.planned_stay_minutes;
      const hasStay = typeof stay === "number" && stay > 0;
      if (a.at === b.at) {
        add(
          "overlap",
          b.item,
          `${titleOf(a.item)} and ${titleOf(b.item)} are both at ${clock(a.at)}.`,
          "warn",
          pair,
        );
        continue;
      }
      const free = b.at - (a.at + (hasStay ? stay : 0));
      if (hasStay && free < 0) {
        add(
          "overlap",
          b.item,
          `${titleOf(a.item)} runs until ${clock(a.at + stay)}, but ${titleOf(b.item)} starts at ${clock(b.at)}.`,
          "warn",
          pair,
        );
        continue;
      }
      if (b.at - a.at > MAX_GAP_MIN) continue;

      let need = input.travelMinutes?.(a.item, b.item) ?? null;
      let measured = need !== null;
      if (need === null) {
        const from = pointOf(a.item);
        const to = pointOf(b.item);
        if (!from || !to) continue;
        const metres = haversine(from, to);
        if (metres > MAX_WALK_METRES) continue;
        need = Math.round(metres / WALK_METRES_PER_MIN);
        measured = false;
      }
      if (need - free < TIGHT_MARGIN_MIN) continue;
      const between = hasStay
        ? `${free} min to spare after ${titleOf(a.item)}`
        : `${free} min between ${titleOf(a.item)} and ${titleOf(b.item)}`;
      const journey = measured
        ? `getting to ${titleOf(b.item)} takes about ${need} min`
        : `the walk to ${titleOf(b.item)} alone is about ${need} min`;
      add("tight", b.item, `${between}, and ${journey}.`, "warn", pair);
    }
  }

  // Bookings.
  for (const { item, kind } of items) {
    if (item.booked === true) {
      if (HAS_REF.has(kind) && !(item.booking_ref ?? "").trim()) {
        add(
          "no-ref",
          item,
          `${titleOf(item)} is marked booked, but no confirmation number is saved.`,
          "info",
        );
      }
    } else if (MUST_BOOK.has(kind)) {
      add("not-booked", item, `${titleOf(item)} isn't marked as booked yet.`, "info");
    }
  }

  // Pins.
  for (const { item, kind } of items) {
    if (PLACED.has(kind) && !pointOf(item)) {
      add("unplaced", item, `${titleOf(item)} isn't on the map yet.`, "info");
    } else if (input.strayIds?.has(item.id)) {
      add("stray", item, `${titleOf(item)} is pinned far from the rest of the trip.`, "info");
    }
  }

  // The trip as a whole.
  if (start) {
    const undated = items.filter(({ item, kind }) => kind !== "note" && !item.day_date).length;
    if (undated > 0) {
      add(
        "undated",
        null,
        undated === 1 ? "1 stop isn't on a day yet." : `${undated} stops aren't on a day yet.`,
        "info",
      );
    }
  }
  if (start && end && end > start) {
    const hasStay = items.some(({ kind }) => kind === "hotel" || kind === "lodging");
    if (!hasStay && items.length > 0) {
      add("no-stay", null, "No place to stay is on the plan yet.", "info");
    }
  }

  // Most pressing first; within a check, the order the checks found them,
  // which is plan order (and clock order within a day).
  return out
    .map((finding, index) => ({ finding, index }))
    .sort(
      (a, b) => ORDER.indexOf(a.finding.kind) - ORDER.indexOf(b.finding.kind) || a.index - b.index,
    )
    .map(({ finding }) => finding);
}

/** "Béa found 3 things worth checking." In her voice, third person. */
export function checkupHeadline(findings: readonly CheckupFinding[]): string {
  if (findings.length === 0) return "Béa checked the whole trip. Nothing needs a second look.";
  if (findings.length === 1) return "Béa found 1 thing worth checking.";
  return `Béa found ${findings.length} things worth checking.`;
}

/** The pill on the menu card: "3 to check", or "All clear". */
export function checkupPill(findings: readonly CheckupFinding[]): string {
  return findings.length ? `${findings.length} to check` : "All clear";
}
