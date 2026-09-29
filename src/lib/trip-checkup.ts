/**
 * Trip Checkup: the mistakes worth catching before you leave.
 *
 * Béa plans, imports and reorders a trip, but nothing looked back over the
 * finished plan for the things that go wrong on the day: a dinner booked
 * before the museum lets out, two stops across town ten minutes apart, a
 * flight with no time on it, a passport that runs out mid-trip.
 *
 * Every check here reads only what the trip already holds, so it costs no
 * AI call and no map credits. Journey times are the straight-line estimates
 * Companion falls back on, and they are only used to flag a gap that is
 * clearly too short — a check that cried wolf would soon be ignored. Where a
 * fact is missing (a stop with no time, no pin, no planned stay) the check
 * says nothing about it rather than guess.
 *
 * Pure, so each rule is tested on its own.
 */

import { isBooked } from "./bookings.ts";
import { clockMinutes } from "./companion.ts";
import { isSavedDirectionItem } from "./direction-stops.ts";
import { haversine, isLatLon, type LatLon } from "./geo.ts";
import { isTravelLeg } from "./import-stop.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import { timelineGlyph } from "./timeline-kind.ts";
import { parseLocalDate } from "./trip-dates.ts";

export type CheckupItem = {
  id: string;
  title: string;
  kind: string;
  day_date: string | null;
  time_label: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  planned_stay_minutes?: number | null;
  booked?: boolean | null;
  booking_ref?: string | null;
  parent_id?: string | null;
  detail?: string | null;
};

export type CheckupDocument = {
  kind: string;
  itinerary_item_id?: string | null;
  reference?: string | null;
};

/** A document in Protected: only its kind, name and expiry are read. */
export type CheckupIdDocument = {
  kind: string;
  label: string;
  expires_on: string | null;
};

export type CheckupFinding = {
  id: string;
  /** "warn" can spoil a day; "info" is worth a look. */
  level: "warn" | "info";
  title: string;
  detail: string;
  /** The stop to open, when the finding is about one. */
  itemId?: string;
  day?: string;
};

/** Walks longer than this are not a walk, so they are not added to the day's walking. */
const WALKABLE_HOP_M = 3_000;
/** A day with more walking between stops than this is worth a word. */
export const LONG_WALK_M = 12_000;
/** A journey is flagged only when it plainly does not fit: at least this many minutes short. */
const TIGHT_SLACK_MIN = 10;
/** Many countries want this long left on a passport after you leave. */
const PASSPORT_MONTHS = 6;

const pinned = (item: CheckupItem): item is CheckupItem & { lat: number; lon: number } =>
  isLatLon(item) && !(item.lat === 0 && item.lon === 0);

/** The places in the plan: not notes, and not the journeys between places. */
function placesOf(items: readonly CheckupItem[]): CheckupItem[] {
  return items.filter(
    (item) =>
      item.title.trim() &&
      !isSavedDirectionItem(item) &&
      !isTravelLeg({ kind: item.kind, title: item.title }) &&
      timelineGlyph(item) !== "note",
  );
}

function dayWord(day: string): string {
  const date = parseLocalDate(day);
  if (!date) return day;
  return date.toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" });
}

function clock(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function listNames(names: readonly string[], max = 3): string {
  const shown = names.slice(0, max);
  const more = names.length - shown.length;
  return more > 0 ? `${shown.join(", ")} and ${more} more` : shown.join(", ");
}

function addMonths(day: string, months: number): string | null {
  const date = parseLocalDate(day);
  if (!date) return null;
  const target = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
  return `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}-${String(target.getDate()).padStart(2, "0")}`;
}

/** Stops a day earlier or later than the trip's own dates. */
export function outsideDates(
  trip: { start_date: string | null; end_date: string | null },
  items: readonly CheckupItem[],
): CheckupFinding[] {
  const start = trip.start_date;
  const end = trip.end_date ?? trip.start_date;
  if (!start || !end) return [];
  const out = placesOf(items).filter((i) => i.day_date && (i.day_date < start || i.day_date > end));
  if (!out.length) return [];
  return [
    {
      id: "outside-dates",
      level: "warn",
      title: `${out.length === 1 ? "A stop falls" : `${out.length} stops fall`} outside the trip's dates`,
      detail: `${listNames(out.map((i) => i.title))}. Move ${out.length === 1 ? "it" : "them"}, or change the trip's dates.`,
      itemId: out[0]!.id,
    },
  ];
}

/**
 * Two timed stops in a row on one day that cannot both happen: the first is
 * still going when the second starts (from its planned stay), or the
 * journey between them is plainly longer than the time left.
 */
export function timingClashes(items: readonly CheckupItem[]): CheckupFinding[] {
  const findings: CheckupFinding[] = [];
  const byDay = new Map<string, CheckupItem[]>();
  for (const item of placesOf(items)) {
    if (!item.day_date || clockMinutes(item.time_label) == null) continue;
    const list = byDay.get(item.day_date) ?? [];
    list.push(item);
    byDay.set(item.day_date, list);
  }
  for (const [day, list] of byDay) {
    const timed = [...list].sort(
      (a, b) => clockMinutes(a.time_label)! - clockMinutes(b.time_label)!,
    );
    for (let i = 0; i + 1 < timed.length; i++) {
      const a = timed[i]!;
      const b = timed[i + 1]!;
      // A stop inside another (the Cenotaph in the park) is meant to overlap.
      if (a.parent_id === b.id || b.parent_id === a.id) continue;
      const aStart = clockMinutes(a.time_label)!;
      const bStart = clockMinutes(b.time_label)!;
      const aEnd = a.planned_stay_minutes ? aStart + a.planned_stay_minutes : null;
      if (aEnd != null && aEnd > bStart) {
        findings.push({
          id: `overlap:${a.id}:${b.id}`,
          level: "warn",
          title: `${a.title} runs into ${b.title}`,
          detail: `${dayWord(day)}: ${a.title} is planned until ${clock(aEnd)}, but ${b.title} starts at ${clock(bStart)}.`,
          itemId: b.id,
          day,
        });
        continue;
      }
      if (aStart === bStart) {
        findings.push({
          id: `same-time:${a.id}:${b.id}`,
          level: "warn",
          title: `Two stops at ${clock(aStart)}`,
          detail: `${dayWord(day)}: ${a.title} and ${b.title} are both at ${clock(aStart)}.`,
          itemId: b.id,
          day,
        });
        continue;
      }
      if (!pinned(a) || !pinned(b)) continue;
      const metres = haversine(a, b);
      const mode = metres <= WALKABLE_HOP_M ? "walking" : "driving";
      const travel = Math.ceil(estimatedLegSeconds(metres, mode) / 60);
      const free = bStart - (aEnd ?? aStart);
      if (travel - free >= TIGHT_SLACK_MIN) {
        findings.push({
          id: `tight:${a.id}:${b.id}`,
          level: "warn",
          title: `Not enough time to reach ${b.title}`,
          detail: `${dayWord(day)}: about ${travel} min ${mode === "walking" ? "on foot" : "by road"} from ${a.title}, with ${Math.max(0, free)} min ${aEnd != null ? "after it ends" : "between the two"}.`,
          itemId: b.id,
          day,
        });
      }
    }
  }
  return findings;
}

/** Days with a lot of walking between stops, by the straight line stretched for streets. */
export function longWalkingDays(items: readonly CheckupItem[]): CheckupFinding[] {
  const byDay = new Map<string, CheckupItem[]>();
  for (const item of placesOf(items)) {
    if (!item.day_date || !pinned(item) || item.parent_id) continue;
    const list = byDay.get(item.day_date) ?? [];
    list.push(item);
    byDay.set(item.day_date, list);
  }
  const findings: CheckupFinding[] = [];
  for (const [day, list] of byDay) {
    let metres = 0;
    for (let i = 0; i + 1 < list.length; i++) {
      const hop = haversine(list[i] as LatLon, list[i + 1] as LatLon);
      if (hop <= WALKABLE_HOP_M) metres += hop * 1.3;
    }
    if (metres >= LONG_WALK_M) {
      findings.push({
        id: `long-walk:${day}`,
        level: "info",
        title: `A long day on foot`,
        detail: `${dayWord(day)} has about ${Math.round(metres / 1000)} km of walking between stops. Worth a taxi or transit for part of it, or a lighter day.`,
        day,
      });
    }
  }
  return findings.sort((a, b) => (a.day ?? "").localeCompare(b.day ?? ""));
}

/** Flights and transfers with no time: the one kind of stop that leaves without you. */
export function untimedTravel(items: readonly CheckupItem[]): CheckupFinding[] {
  return items
    .filter(
      (item) =>
        item.title.trim() &&
        !isSavedDirectionItem(item) &&
        timelineGlyph(item) === "transport" &&
        !isTravelLeg({ kind: item.kind, title: item.title }) &&
        clockMinutes(item.time_label) == null,
    )
    .map((item) => ({
      id: `untimed:${item.id}`,
      level: "warn" as const,
      title: `${item.title} has no time`,
      detail:
        "Add the departure or pickup time, so the day around it can be planned and Béa can remind you.",
      itemId: item.id,
      ...(item.day_date ? { day: item.day_date } : {}),
    }));
}

/** Stops Béa cannot put on the map: no pin and no address. */
export function unplacedStops(items: readonly CheckupItem[]): CheckupFinding[] {
  const lost = placesOf(items).filter(
    (item) =>
      !pinned(item) &&
      !item.address?.trim() &&
      timelineGlyph(item) !== "walk" &&
      timelineGlyph(item) !== "transport",
  );
  if (!lost.length) return [];
  return [
    {
      id: "unplaced",
      level: "info",
      title: `${lost.length === 1 ? "A stop has" : `${lost.length} stops have`} no address`,
      detail: `${listNames(lost.map((i) => i.title))}. Without a place, there are no directions or "Leave by".`,
      itemId: lost[0]!.id,
    },
  ];
}

/** Booked travel and stays with no confirmation number anywhere. */
export function missingReferences(
  items: readonly CheckupItem[],
  documents: readonly CheckupDocument[] = [],
): CheckupFinding[] {
  const withDoc = new Set(
    documents
      .filter((d) => d.itinerary_item_id && d.reference?.trim())
      .map((d) => d.itinerary_item_id),
  );
  const bare = items.filter((item) => {
    const glyph = timelineGlyph(item);
    return (
      isBooked(item) &&
      (glyph === "transport" || glyph === "lodging") &&
      !item.booking_ref?.trim() &&
      !withDoc.has(item.id)
    );
  });
  if (!bare.length) return [];
  return [
    {
      id: "no-reference",
      level: "info",
      title: `No confirmation number on ${bare.length === 1 ? "a booking" : `${bare.length} bookings`}`,
      detail: `${listNames(bare.map((i) => i.title))}. Add it to the booking, so it is at hand at the desk.`,
      itemId: bare[0]!.id,
    },
  ];
}

/** A trip of two nights or more with nowhere to sleep on it. */
export function missingStay(
  trip: { start_date: string | null; end_date: string | null },
  items: readonly CheckupItem[],
  documents: readonly CheckupDocument[] = [],
): CheckupFinding[] {
  const start = trip.start_date ? parseLocalDate(trip.start_date) : undefined;
  const end = trip.end_date ? parseLocalDate(trip.end_date) : undefined;
  if (!start || !end) return [];
  const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (nights < 2) return [];
  const hasStay =
    items.some((item) => timelineGlyph(item) === "lodging") ||
    documents.some((d) => d.kind.toLowerCase() === "accommodation");
  if (hasStay) return [];
  return [
    {
      id: "no-stay",
      level: "info",
      title: "No place to stay yet",
      detail: `${nights} nights and no hotel or rental on the trip. Add it to the timeline, or file its confirmation in Trip documents.`,
    },
  ];
}

/** Passports and visas that run out during the trip, or too soon after it. */
export function idDocumentExpiry(
  trip: { start_date: string | null; end_date: string | null },
  documents: readonly CheckupIdDocument[],
): CheckupFinding[] {
  const end = trip.end_date ?? trip.start_date;
  if (!end || !trip.start_date) return [];
  const sixMonths = addMonths(end, PASSPORT_MONTHS);
  const findings: CheckupFinding[] = [];
  for (const doc of documents) {
    const kind = doc.kind.toLowerCase();
    if ((kind !== "passport" && kind !== "visa") || !doc.expires_on) continue;
    const name = doc.label.trim() || doc.kind;
    if (doc.expires_on < trip.start_date) {
      findings.push({
        id: `expired:${kind}:${name}`,
        level: "warn",
        title: `${name} will have expired`,
        detail: `It ran out on ${doc.expires_on}, before the trip starts.`,
      });
    } else if (doc.expires_on <= end) {
      findings.push({
        id: `expires-during:${kind}:${name}`,
        level: "warn",
        title: `${name} expires during the trip`,
        detail: `It runs out on ${doc.expires_on}, before you come home on ${end}.`,
      });
    } else if (kind === "passport" && sixMonths && doc.expires_on < sixMonths) {
      findings.push({
        id: `six-months:${name}`,
        level: "info",
        title: `${name} expires within six months of the trip`,
        detail: `It runs out on ${doc.expires_on}. Many countries ask for six months left when you arrive — check the rules for where you are going.`,
      });
    }
  }
  return findings;
}

/**
 * Everything the checkup found, the ones that can spoil a day first, then
 * in the order of the trip.
 */
export function tripCheckup({
  trip,
  items,
  documents = [],
  idDocuments = [],
}: {
  trip: { start_date: string | null; end_date: string | null };
  items: readonly CheckupItem[];
  documents?: readonly CheckupDocument[];
  idDocuments?: readonly CheckupIdDocument[];
}): CheckupFinding[] {
  const all = [
    ...idDocumentExpiry(trip, idDocuments),
    ...outsideDates(trip, items),
    ...untimedTravel(items),
    ...timingClashes(items),
    ...missingStay(trip, items, documents),
    ...missingReferences(items, documents),
    ...unplacedStops(items),
    ...longWalkingDays(items),
  ];
  const rank = (f: CheckupFinding) => (f.level === "warn" ? 0 : 1);
  return all
    .map((f, i) => ({ f, i }))
    .sort(
      (a, b) => rank(a.f) - rank(b.f) || (a.f.day ?? "").localeCompare(b.f.day ?? "") || a.i - b.i,
    )
    .map(({ f }) => f);
}

/** "Béa checked the trip." with how much she found, in her voice. */
export function checkupHeadline(findings: readonly CheckupFinding[]): string {
  if (!findings.length) return "Béa went over the whole trip. Nothing to fix.";
  const n = findings.length;
  return `Béa found ${n} ${n === 1 ? "thing" : "things"} worth checking.`;
}
