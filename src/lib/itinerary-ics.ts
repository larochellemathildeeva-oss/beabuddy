/**
 * Reading an itinerary from a calendar file (.ics).
 *
 * A calendar export — from TripIt, an airline, a hotel, Google or Apple
 * Calendar — already says what happens, when and where, in a fixed format.
 * Asking a model to read it would only add a chance of getting a time wrong,
 * so this reads it directly: no AI call, nothing sent anywhere, and the same
 * result every time.
 *
 * The output has the shape the AI import returns, so the review, placing and
 * saving that follow are the same whichever way the plan came in.
 */
import type { ParsedItinerary, ParsedItineraryItem } from "./itinerary.functions.ts";

/** The most stops one import makes, as for the AI import. */
const MAX_ITEMS = 60;

export class IcsReadError extends Error {}

type Prop = { name: string; params: Record<string, string>; value: string };

/** True when the text is a calendar file rather than a page or a plan. */
export function looksLikeIcs(text: string): boolean {
  return /^\uFEFF?\s*BEGIN:VCALENDAR/i.test(text);
}

/**
 * Turn a calendar file into a plan to review.
 *
 * Times are kept as the calendar shows them where the event is: a time given
 * in a named zone ("TZID=Asia/Tokyo") or with no zone at all is the local
 * clock time, which is what a traveller reads. A time given only in UTC is
 * converted to the calendar's own zone when it names one; when it does not,
 * the local time cannot be known, so the time is left off and the UTC time
 * goes in the detail rather than a guess going on the timeline.
 */
export function icsToParsedItinerary(text: string): ParsedItinerary {
  if (!looksLikeIcs(text)) throw new IcsReadError("That file isn't a calendar Béa can read.");
  const lines = unfold(text);
  const calendarZone = lines.map(parseProp).find((p) => p?.name === "X-WR-TIMEZONE")?.value;
  const calendarName = lines.map(parseProp).find((p) => p?.name === "X-WR-CALNAME")?.value;

  const events: Prop[][] = [];
  let current: Prop[] | null = null;
  let depth = 0;
  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === "BEGIN:VEVENT") {
      current = [];
      depth = 0;
      continue;
    }
    if (upper === "END:VEVENT") {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    // Alarms and other blocks inside an event carry their own DESCRIPTION
    // and SUMMARY ("Reminder"), which are not the event's.
    if (upper.startsWith("BEGIN:")) depth++;
    else if (upper.startsWith("END:")) depth = Math.max(0, depth - 1);
    else if (depth === 0) {
      const prop = parseProp(line);
      if (prop) current.push(prop);
    }
  }

  const items: (ParsedItineraryItem & { sortKey: string })[] = [];
  for (const props of events) {
    const get = (name: string) => props.find((p) => p.name === name);
    if (get("STATUS")?.value.toUpperCase() === "CANCELLED") continue;
    const title = unescapeText(get("SUMMARY")?.value ?? "").trim();
    const startProp = get("DTSTART");
    if (!title || !startProp) continue;
    const start = readWhen(startProp, calendarZone);
    if (!start) continue;
    const endProp = get("DTEND");
    const end = endProp ? readWhen(endProp, calendarZone) : null;

    const description = unescapeText(get("DESCRIPTION")?.value ?? "");
    const location = unescapeText(get("LOCATION")?.value ?? "").trim();
    const booked = BOOKED.test(description) || BOOKED.test(title);
    const kind = kindFor(title, booked, start.allDay);

    const extras: string[] = [];
    if (start.utcNote) extras.push(`Starts ${start.utcNote}`);
    const lastDay = end && lastDayOf(start, end);
    if (lastDay) extras.push(`Until ${lastDay}`);
    const firstLine = description
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l && !/^https?:\/\//i.test(l));
    if (firstLine) extras.push(firstLine);
    const detail = extras.join(" · ").slice(0, 300) || null;

    const sameDay = end && !end.allDay && end.date === start.date;
    const endTime = sameDay ? end.time : null;
    const duration = start.time && endTime ? minutesBetween(start.time, endTime) : null;
    const [placeName, ...rest] = location.split(",").map((s) => s.trim());

    items.push({
      sortKey: `${start.date} ${start.time ?? "00:00"}`,
      day_date: start.date,
      day_number: null,
      time_label: start.time,
      end_time: endTime,
      duration_minutes: duration,
      kind,
      title: title.slice(0, 200),
      detail,
      place: placeName || null,
      address: rest.length ? location : null,
      city: null,
      estimated_cost: null,
      currency: null,
      source: null,
      booked,
    });
  }

  if (items.length === 0) {
    throw new IcsReadError("That calendar has no events Béa can read.");
  }
  items.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const kept = items.slice(0, MAX_ITEMS).map(({ sortKey: _sortKey, ...item }) => item);
  const dates = kept.map((i) => i.day_date).filter((d): d is string => Boolean(d));
  const count = kept.length;
  return {
    summary:
      items.length > MAX_ITEMS
        ? `The first ${MAX_ITEMS} of ${items.length} events from your calendar, in order.`
        : `${count} ${count === 1 ? "event" : "events"} from your calendar, in order.`,
    trip_title: unescapeText(calendarName ?? "").trim() || "Imported calendar",
    start_date: dates[0] ?? null,
    end_date: dates[dates.length - 1] ?? null,
    estimated_total: null,
    currency: null,
    costs: [],
    items: kept,
  };
}

/** A confirmation number, a booking reference, a ticket: something already booked. */
const BOOKED =
  /\b(confirmation|confirmed|booking (ref(erence)?|number|code)|reservation (number|code)|record locator|PNR|e-?ticket|ticket number)\b/i;

function kindFor(title: string, booked: boolean, allDay: boolean): string {
  // "Flight to Tokyo", or a flight number up front: "AC 3", "NH204", "U2 1234".
  const isFlight =
    /\bflight\b|✈/i.test(title) || /^([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?\d{1,4}\b/.test(title);
  if (isFlight) return booked ? "flight" : "transport";
  if (/\b(hotel|check[- ]?in|check[- ]?out|stay|airbnb|hostel|ryokan|lodging|inn)\b/i.test(title)) {
    return booked ? "hotel" : "lodging";
  }
  if (
    /\b(train|rail|ferry|bus|coach|shinkansen|transfer|car rental|pick-?up|taxi)\b/i.test(title)
  ) {
    return "transport";
  }
  if (/\b(breakfast|brunch|lunch|dinner|restaurant|caf[eé]|bar|drinks|tasting)\b/i.test(title)) {
    return booked ? "reservation" : "meal";
  }
  if (/\b(museum|gallery|temple|shrine|castle|palace|cathedral|tour)\b/i.test(title))
    return "sight";
  if (/\b(walk|hike|trail)\b/i.test(title)) return "walk";
  if (allDay && !booked) return "note";
  return booked ? "reservation" : "activity";
}

type When = { date: string; time: string | null; allDay: boolean; utcNote: string | null };

function readWhen(prop: Prop, calendarZone: string | undefined): When | null {
  const value = prop.value.trim();
  const dateOnly = /^(\d{4})(\d{2})(\d{2})$/.exec(value);
  if (dateOnly || prop.params["VALUE"]?.toUpperCase() === "DATE") {
    const m = dateOnly ?? /^(\d{4})(\d{2})(\d{2})/.exec(value);
    if (!m) return null;
    return { date: `${m[1]}-${m[2]}-${m[3]}`, time: null, allDay: true, utcNote: null };
  }
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/i.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi, , z] = m;
  if (!z) {
    // A named zone or none: the clock time where the event happens.
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}`, allDay: false, utcNote: null };
  }
  const instant = new Date(Date.UTC(+y!, +mo! - 1, +d!, +h!, +mi!));
  const local = calendarZone ? inZone(instant, calendarZone) : null;
  if (local) return { ...local, allDay: false, utcNote: null };
  return { date: `${y}-${mo}-${d}`, time: null, allDay: false, utcNote: `${h}:${mi} UTC` };
}

function inZone(instant: Date, timeZone: string): { date: string; time: string } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(instant);
    const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return {
      date: `${part("year")}-${part("month")}-${part("day")}`,
      time: `${part("hour")}:${part("minute")}`,
    };
  } catch {
    // An unknown zone name: say UTC rather than guess.
    return null;
  }
}

/** The last day an event covers, when it runs past its first. All-day ends are exclusive. */
function lastDayOf(start: When, end: When): string | null {
  let last = end.date;
  if (end.allDay) {
    const d = new Date(`${end.date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    last = d.toISOString().slice(0, 10);
  }
  return last > start.date ? last : null;
}

function minutesBetween(from: string, to: string): number | null {
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  const diff = th! * 60 + tm! - (fh! * 60 + fm!);
  return diff > 0 ? diff : null;
}

/** Lines continued with a leading space or tab are one line (RFC 5545 §3.1). */
function unfold(text: string): string[] {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n|\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter(Boolean);
}

function parseProp(line: string): Prop | null {
  // The value starts at the first colon that is not inside a quoted parameter.
  let quoted = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') quoted = !quoted;
    else if (c === ":" && !quoted) {
      colon = i;
      break;
    }
  }
  if (colon <= 0) return null;
  const [name, ...paramParts] = line.slice(0, colon).split(";");
  const params: Record<string, string> = {};
  for (const part of paramParts) {
    const eq = part.indexOf("=");
    if (eq > 0) params[part.slice(0, eq).toUpperCase()] = part.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: (name ?? "").toUpperCase(), params, value: line.slice(colon + 1) };
}

function unescapeText(value: string): string {
  return value.replace(/\\([\\;,nN])/g, (_, c: string) => (c === "n" || c === "N" ? "\n" : c));
}
