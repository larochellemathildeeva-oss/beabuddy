/**
 * The plan as a page to print, or to save as a PDF from the print dialog.
 *
 * A paper copy travels where a phone does not — a dead battery, a border
 * desk — and a PDF can be handed back to another assistant to check. It
 * reads as a travel document rather than a printout of the app, and answers
 * the offline questions in order: where am I going, when, how do I get to
 * the next thing, and do I have a reservation.
 *
 * - The cover: the trip, its dates and nights, who is going and where they
 *   sleep, then each day in one line and the bookings with their references.
 * - One section per day: each stop with its time, address, note and whether
 *   it is booked; plans that need a ticket and have none say "To book".
 *   Between two pinned stops, how far and how long, estimated from the pins
 *   (`route-estimate.ts`): free, and marked "~" because it is an estimate.
 * - The last page: where you are staying, the confirmation numbers, and the
 *   way back to the trip in Béa.
 *
 * Every stop also carries exactly where Béa has it: the address and the
 * map pin as coordinates, written out as text and linked to the map. That
 * way the PDF can be handed back to whoever built the plan to check that
 * each pin is the right place — a namesake across town shows up at once.
 * A stop with no pin says so, rather than leaving a gap that looks fine.
 *
 * Pure string building, so it is tested without a browser. Every value is
 * escaped: titles and notes are the traveller's own text.
 */
import { dayShapeLine } from "./day-shape.ts";
import { looksLikeStreetAddress } from "./direction-stops.ts";
import { formatMetres, haversine } from "./geo.ts";
import { stayLabel } from "./planned-stay.ts";
import { estimatedLegMeters, estimatedLegSeconds } from "./route-estimate.ts";
import { DIRECTIONS_WALK_M } from "./route-optimize.ts";
import { formatTimelineDayLabel, groupTimelineByDay } from "./timeline-groups.ts";
import { parseLocalDate } from "./trip-dates.ts";

export type PrintRow = {
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
  booked?: boolean | null | undefined;
  booking_ref?: string | null | undefined;
  /** What to show at the door: seats, party size, check-in time. */
  booking_details?: string | null | undefined;
  /** How long the stop lasts: with the time, when it ends ("09:00–09:40"). */
  planned_stay_minutes?: number | null | undefined;
};

export type PrintTrip = {
  title: string;
  /** "Paris, France · Oct 12 – 18". */
  subtitle?: string | undefined;
  /** YYYY-MM-DD, for the number of nights. */
  start_date?: string | null | undefined;
  end_date?: string | null | undefined;
  /** Who is on the trip, by name. */
  travellers?: readonly string[] | undefined;
  /** The trip in Béa, for the last page. */
  link?: string | undefined;
  /** When the copy was made: a paper plan says how fresh it is. */
  printedAt?: Date | undefined;
};

/** Kinds that need a ticket or a room: unbooked, they are still to do. */
const BOOKABLE = new Set(["flight", "hotel", "lodging", "reservation", "transport"]);

const KIND_LABEL: Record<string, string> = {
  flight: "Flight",
  hotel: "Stay",
  lodging: "Stay",
  reservation: "Booking",
  transport: "Travel",
  meal: "Meal",
  sight: "Sight",
  walk: "Walk",
  note: "Note",
  activity: "Activity",
};

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const STAY_KINDS = new Set(["hotel", "lodging"]);
/**
 * Leaving a stay, or coming back for the bags after: its booking is behind
 * the traveller. Dropping bags on arrival is not: it is the stay starting,
 * however the check-in is worded ("The Silo Hotel — drop bags").
 */
const STAY_ACTION =
  /\bcheck[- ]?out\b|\b(?:collect|pick up|leave|get)(?: back)? (?:the |our |your )?(?:bags|luggage)\b/i;
/** Dropping bags before the room is ready: the stay starting, marked on its check-in when one follows. */
const BAG_DROP =
  /\b(?:luggage|bag)s? drop\b|\bdrop (?:off )?(?:the |our |your )?(?:bags|luggage)\b/i;

/** "Motel One Berlin-Hauptbahnhof" however the row puts it, for telling one stay from another. */
function stayKey(row: PrintRow): string {
  // "Hotel Granvia Osaka (ホテルグランヴィア大阪)" is the same stay as "Hotel Granvia Osaka".
  return row.title
    .replace(/\s*[(（][^()（）]*[)）]/g, "")
    .split(/\s+[-–—]\s+|,/)[0]!
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** An address as written, for telling whether two rows are the same door. */
function addressKey(row: PrintRow): string {
  return (row.address ?? "")
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

/**
 * One stay: the same hotel by name, or at the same address however the row
 * names it — "Hotel (Rest)" and "Citadines (Rest)" are the nights' own hotel.
 */
function sameStay(a: PrintRow, b: PrintRow): boolean {
  if (stayKey(a) === stayKey(b)) return true;
  const where = addressKey(a);
  return where.length > 0 && where === addressKey(b);
}

/**
 * Where "To book" goes: once per stay, on its first row that is not leaving
 * it. A night's room is one booking; saying it again on the check-out and on
 * the next morning's breakfast made three bookings of one. Coming back to the
 * same hotel after a night somewhere else is a stay of its own.
 */
export function toBookRows(rows: readonly PrintRow[]): Set<PrintRow> {
  const out = new Set<PrintRow>();
  /** The stay the plan is in, and whether its booking has been said. */
  let stay = null as { last: PrintRow; marked: boolean; drop?: PrintRow } | null;
  /** A stay that only dropped its bags is still a stay to book: on that row. */
  const settle = () => {
    if (stay && !stay.marked && stay.drop) out.add(stay.drop);
  };
  for (const row of rows) {
    if (!BOOKABLE.has(row.kind)) continue;
    if (!STAY_KINDS.has(row.kind)) {
      if (!row.booked) out.add(row);
      continue;
    }
    if (!stay || !sameStay(stay.last, row)) {
      settle();
      stay = { last: row, marked: false };
    }
    stay.last = row;
    if (row.booked) stay.marked = true;
    if (stay.marked) continue;
    const text = `${row.title} ${row.detail ?? ""}`;
    if (STAY_ACTION.test(text) && !/\bcheck[- ]?in\b/i.test(text)) {
      // Checking out: the room was the nights before, booked or not, and
      // coming back for the bags later is the same stay, not a new one.
      if (/\bcheck[- ]?out\b/i.test(text)) stay.marked = true;
      continue;
    }
    if (BAG_DROP.test(text) && !/\bcheck[- ]?in\b/i.test(text)) {
      stay.drop ??= row;
      continue;
    }
    stay.marked = true;
    out.add(row);
  }
  settle();
  return out;
}

function bookingCell(row: PrintRow, toBook: ReadonlySet<PrintRow>): string {
  return bookingStatus(row, toBook.has(row));
}

function bookingStatus(row: PrintRow, stillToBook: boolean): string {
  if (row.booked) {
    const ref = row.booking_ref?.trim();
    return `<span class="booked">Booked${ref ? ` · ${escapeHtml(ref)}` : ""}</span>`;
  }
  return stillToBook ? `<span class="tobook">To book</span>` : "";
}

/** "09:00–09:40" when the stop's length is known, else its start. */
export function timeRange(time: string, stayMinutes: number | null | undefined): string {
  const m = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!m || !stayMinutes || stayMinutes <= 0) return time;
  const end = Number(m[1]) * 60 + Number(m[2]) + Math.round(stayMinutes);
  // Past midnight it is the next day, and a range would read backwards.
  if (end >= 24 * 60) return time;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${time}–${pad(Math.floor(end / 60))}:${pad(end % 60)}`;
}

/**
 * The row as it reads on paper: a street address written into the title
 * ("Neues Museum, Bodestraße 1-3") shown as the address, and a note written
 * both after the title and in the detail shown once.
 */
export function tidyPrintRow(row: PrintRow): PrintRow {
  let title = row.title.trim();
  let address = row.address?.trim() || null;
  let detail = row.detail?.trim() || null;
  // "Städel Museum - 700 years of European art" with the same note below.
  const dash = title.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (dash && detail?.toLowerCase().includes(dash[2]!.trim().toLowerCase()))
    title = dash[1]!.trim();
  const parts = title.split(/\s*,\s*/);
  const at = parts.findIndex(
    (part, i) => i > 0 && looksLikeStreetAddress(part.split(/\s+[-–—]\s+/)[0]!),
  );
  if (at > 0) {
    const [street, ...rest] = parts[at]!.split(/\s+[-–—]\s+/);
    if (!address) address = street!;
    // What followed the address in the title is kept, after the name.
    parts.splice(at, 1);
    title = [parts.join(", "), ...rest].join(" - ");
  }
  if (detail) {
    // A detail part the title already says ("Berlin Wall murals · getting there…").
    const lowerTitle = title.toLowerCase();
    const notes = detail
      .split(" · ")
      .filter((note) => !lowerTitle.includes(note.trim().toLowerCase()));
    detail = notes.join(" · ") || null;
  }
  return { ...row, title, address, detail };
}

function hasPin(row: PrintRow): row is PrintRow & { lat: number; lon: number } {
  return (
    typeof row.lat === "number" &&
    typeof row.lon === "number" &&
    Number.isFinite(row.lat) &&
    Number.isFinite(row.lon) &&
    (row.lat !== 0 || row.lon !== 0)
  );
}

/** "48.86061, 2.33764": five decimals is about a metre, enough to tell two doors apart. */
export function pinText(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

/** Where Béa has the stop: its address, then its pin, or that it has none. */
function locationHtml(row: PrintRow): string {
  const address = row.address?.trim();
  const where = address ? `<div class="address">${escapeHtml(address)}</div>` : "";
  if (row.kind === "note") return where;
  if (!hasPin(row)) {
    return `${where}<div class="pin nopin">Not on the map yet${address ? "" : " · no address"}</div>`;
  }
  // The link opens the pin itself, not a search by name: it is there to
  // check that point, and a search could land on the right place and hide
  // a wrong pin.
  const url = `https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lon}`;
  return `${where}<div class="pin">Map pin: <a href="${escapeHtml(url)}">${pinText(row.lat, row.lon)}</a></div>`;
}

function rowHtml(source: PrintRow, toBook: ReadonlySet<PrintRow>): string {
  const row = tidyPrintRow(source);
  const time = row.time_label?.trim()
    ? escapeHtml(timeRange(row.time_label.trim(), row.planned_stay_minutes))
    : "";
  const stay =
    row.planned_stay_minutes && row.planned_stay_minutes > 0 && !STAY_KINDS.has(row.kind)
      ? stayLabel(Math.round(row.planned_stay_minutes))
      : "";
  const kind = [KIND_LABEL[row.kind], stay].filter(Boolean).join(" · ");
  const lines = [
    `<div class="title">${escapeHtml(row.title)}${kind ? ` <span class="kind">${kind}</span>` : ""}</div>`,
    locationHtml(row),
    row.detail?.trim() ? `<div class="detail">${escapeHtml(row.detail.trim())}</div>` : "",
  ].filter(Boolean);
  return `<tr><td class="time">${time}</td><td>${lines.join("")}</td><td class="status">${bookingCell(source, toBook)}</td></tr>`;
}

/** Kinds that end somewhere else: the next stop is not a walk from where they start. */
const JOURNEY_KINDS = new Set(["flight", "transport", "train"]);

/** Past this, two stops are in different towns and the day's travel row says how. */
const LEG_MAX_M = 50_000;

export type PrintLeg = {
  mode: "walking" | "ride";
  /** Along the way, estimated. */
  meters: number;
  /** Walking; for a ride, by transit. */
  seconds: number;
  /** A ride by car, for comparison. */
  driveSeconds?: number | undefined;
};

/**
 * How to get from one stop to the next, estimated from the two pins: a walk
 * when it is close enough to walk (the directions sheet's own line), else a
 * ride. Null when either has no pin, one is a note, the first is itself a
 * journey (a flight lands somewhere else), or they are the same door.
 */
export function legBetween(from: PrintRow, to: PrintRow): PrintLeg | null {
  if (!hasPin(from) || !hasPin(to)) return null;
  if (from.kind === "note" || to.kind === "note" || JOURNEY_KINDS.has(from.kind)) return null;
  const straight = haversine(from, to);
  if (straight < 60 || straight > LEG_MAX_M) return null;
  const walk = estimatedLegMeters(straight, "walking");
  if (walk <= DIRECTIONS_WALK_M) {
    return { mode: "walking", meters: walk, seconds: estimatedLegSeconds(straight, "walking") };
  }
  return {
    mode: "ride",
    meters: estimatedLegMeters(straight, "driving"),
    seconds: estimatedLegSeconds(straight, "transit"),
    driveSeconds: estimatedLegSeconds(straight, "driving"),
  };
}

/** "12 min", "1 h 5 min". */
function minutesText(seconds: number): string {
  return stayLabel(Math.max(1, Math.round(seconds / 60)));
}

/** "~12 min walk · 850 m", or "~4.1 km · ~22 min by transit, ~12 min by car". */
export function legText(leg: PrintLeg): string {
  if (leg.mode === "walking")
    return `~${minutesText(leg.seconds)} walk · ${formatMetres(leg.meters)}`;
  const car = leg.driveSeconds ? `, ~${minutesText(leg.driveSeconds)} by car` : "";
  return `~${formatMetres(leg.meters)} · ~${minutesText(leg.seconds)} by transit${car}`;
}

/** Nights between two YYYY-MM-DD dates, or null when either is missing. */
export function tripNights(
  start: string | null | undefined,
  end: string | null | undefined,
): number | null {
  const from = start ? parseLocalDate(start) : undefined;
  const to = end ? parseLocalDate(end) : undefined;
  if (!from || !to) return null;
  const nights = Math.round((to.getTime() - from.getTime()) / 86_400_000);
  return nights >= 0 ? nights : null;
}

function isStayAction(row: PrintRow): boolean {
  const text = `${row.title} ${row.detail ?? ""}`;
  return STAY_ACTION.test(text) && !/\bcheck[- ]?in\b/i.test(text);
}

/**
 * The stay rows grouped into stays: the nights at one hotel in a row, until
 * the plan moves to another. Coming back to the same hotel after a night
 * somewhere else is a stay of its own, as in `toBookRows`.
 */
export function stayRuns(rows: readonly PrintRow[]): PrintRow[][] {
  const runs: PrintRow[][] = [];
  let last: PrintRow | null = null;
  for (const row of rows) {
    if (!STAY_KINDS.has(row.kind)) continue;
    if (!last || !sameStay(last, row)) runs.push([]);
    last = row;
    runs[runs.length - 1]!.push(row);
  }
  return runs;
}

/** A stay as one row: its first night, with the address, booking and reference any night carries. */
function mergedStay(run: readonly PrintRow[]): PrintRow {
  const first = run.find((row) => !isStayAction(row)) ?? run[0]!;
  const pick = (get: (row: PrintRow) => string | null | undefined) =>
    run.map((row) => get(row)?.trim()).find(Boolean) ?? null;
  return {
    ...first,
    address: first.address?.trim() || pick((row) => row.address),
    booked: run.some((row) => row.booked),
    booking_ref: pick((row) => row.booking_ref),
    booking_details: pick((row) => row.booking_details),
  };
}

/** Each stay once, in order: where the traveller sleeps. A stay that is only its check-out is left out. */
export function staysOf(rows: readonly PrintRow[]): PrintRow[] {
  return stayRuns(rows)
    .filter((run) => run.some((row) => !isStayAction(row)))
    .map(mergedStay);
}

export type BookingLine = { row: PrintRow; toBook: boolean };

/**
 * Lines under Bookings: whatever is booked, carries a reference, or is still
 * to book. A stay is one line however many nights it has, with the
 * reference from whichever night it was written on.
 */
export function bookingRows(
  rows: readonly PrintRow[],
  toBook: ReadonlySet<PrintRow>,
): BookingLine[] {
  const runStart = new Map<PrintRow, PrintRow[]>();
  for (const run of stayRuns(rows)) runStart.set(run[0]!, run);
  const out: BookingLine[] = [];
  for (const row of rows) {
    if (STAY_KINDS.has(row.kind)) {
      const run = runStart.get(row);
      if (!run) continue;
      const stay = mergedStay(run);
      const still = run.some((night) => toBook.has(night));
      if (stay.booked || stay.booking_ref || still)
        out.push({ row: stay, toBook: still && !stay.booked });
      continue;
    }
    if (row.booked || row.booking_ref?.trim() || toBook.has(row)) {
      out.push({ row, toBook: toBook.has(row) });
    }
  }
  return out;
}

function whenText(row: PrintRow): string {
  const day = row.day_date ? formatTimelineDayLabel(row.day_date) : "";
  return [day, row.time_label?.trim()].filter(Boolean).join(" · ");
}

function bookingLineHtml({ row: source, toBook: still }: BookingLine): string {
  const row = tidyPrintRow(source);
  const kind = KIND_LABEL[row.kind] ?? "Booking";
  const details = source.booking_details?.trim();
  return `<tr><td class="bkind">${kind}</td><td><div class="title">${escapeHtml(row.title)}</div>${
    whenText(row) ? `<div class="detail">${escapeHtml(whenText(row))}</div>` : ""
  }${details ? `<div class="detail">${escapeHtml(details)}</div>` : ""}</td><td class="status">${bookingStatus(source, still)}</td></tr>`;
}

function legHtml(leg: PrintLeg): string {
  return `<tr class="leg"><td></td><td colspan="2">↓ ${escapeHtml(legText(leg))}</td></tr>`;
}

function dayHtml(
  items: readonly PrintRow[],
  heading: string,
  toBook: ReadonlySet<PrintRow>,
): string {
  const parts: string[] = [];
  let walked = 0;
  items.forEach((row, i) => {
    const prev = i > 0 ? items[i - 1] : undefined;
    const leg = prev ? legBetween(tidyPrintRow(prev), tidyPrintRow(row)) : null;
    if (leg) {
      parts.push(legHtml(leg));
      if (leg.mode === "walking") walked += leg.meters;
    }
    parts.push(rowHtml(row, toBook));
  });
  const stops = items.filter((row) => row.kind !== "note").length;
  const summary = [
    stops ? `${stops} ${stops === 1 ? "stop" : "stops"}` : "",
    walked ? `~${formatMetres(walked)} walking` : "",
    dayShapeLine(items),
  ].filter(Boolean);
  return `<section class="day"><h2>${heading}</h2>${
    summary.length ? `<p class="daysum">${escapeHtml(summary.join(" · "))}</p>` : ""
  }<table>${parts.join("")}</table></section>`;
}

function printedText(at: Date): string {
  const date = at.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = at.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} at ${time}`;
}

export function itineraryPrintHtml(trip: PrintTrip, rows: readonly PrintRow[]): string {
  const groups = groupTimelineByDay([...rows]);
  const ordered = groups.flatMap((group) => group.items);
  const toBook = toBookRows(ordered);
  const dayHeading = (key: string, i: number) => {
    const label = key ? formatTimelineDayLabel(key) : "No date";
    return key ? `Day ${i + 1} · ${escapeHtml(label)}` : escapeHtml(label);
  };
  const days = groups
    .map((group, i) => dayHtml(group.items, dayHeading(group.key, i), toBook))
    .join("");

  const title = escapeHtml(trip.title.trim() || "Trip");
  const subtitle = trip.subtitle?.trim()
    ? `<p class="sub">${escapeHtml(trip.subtitle.trim())}</p>`
    : "";
  const nights = tripNights(trip.start_date, trip.end_date);
  const travellers = (trip.travellers ?? []).map((name) => name.trim()).filter(Boolean);
  const facts = [
    nights ? `${nights} ${nights === 1 ? "night" : "nights"}` : "",
    travellers.length > 1 ? `${travellers.length} travellers` : "",
  ].filter(Boolean);
  const stays = staysOf(ordered).map(tidyPrintRow);
  const stayList = stays.length
    ? `<div class="block"><h3>Staying at</h3>${stays
        .map(
          (stay) =>
            `<p><b>${escapeHtml(stay.title)}</b>${
              stay.day_date
                ? ` <span class="muted">from ${escapeHtml(formatTimelineDayLabel(stay.day_date))}</span>`
                : ""
            }${stay.address ? `<br><span class="muted">${escapeHtml(stay.address)}</span>` : ""}</p>`,
        )
        .join("")}</div>`
    : "";
  const withWho =
    travellers.length > 1
      ? `<div class="block"><h3>Travelling with</h3><p>${escapeHtml(travellers.join(" · "))}</p></div>`
      : "";
  const glance = groups.length
    ? `<div class="block"><h3>At a glance</h3><table class="glance">${groups
        .map(
          (group, i) =>
            `<tr><td class="gday">${dayHeading(group.key, i)}</td><td>${escapeHtml(dayShapeLine(group.items))}</td></tr>`,
        )
        .join("")}</table></div>`
    : "";
  const bookings = bookingRows(ordered, toBook);
  const bookingList = bookings.length
    ? `<div class="block"><h3>Bookings</h3><table>${bookings.map(bookingLineHtml).join("")}</table></div>`
    : "";
  const printed = trip.printedAt
    ? `<p class="muted small">Prepared in Béa · ${escapeHtml(printedText(trip.printedAt))}</p>`
    : "";

  const refs = bookings
    .map((line) => line.row)
    .filter((row) => row.booked && row.booking_ref?.trim());
  const keyInfo = [
    stays.length
      ? `<div class="block"><h3>Where you are staying</h3>${stays
          .map(
            (stay) =>
              `<p><b>${escapeHtml(stay.title)}</b>${stay.address ? `<br>${escapeHtml(stay.address)}` : ""}</p>`,
          )
          .join("")}</div>`
      : "",
    refs.length
      ? `<div class="block"><h3>Confirmation numbers</h3><table>${refs
          .map(
            (row) =>
              `<tr><td>${escapeHtml(tidyPrintRow(row).title)}</td><td class="ref">${escapeHtml(row.booking_ref!.trim())}</td></tr>`,
          )
          .join("")}</table></div>`
      : "",
    trip.link
      ? `<div class="block"><h3>Open this trip in Béa</h3><p><a href="${escapeHtml(trip.link)}">${escapeHtml(trip.link)}</a></p></div>`
      : "",
  ].join("");
  const keyPage = keyInfo ? `<section class="key"><h2>Key details</h2>${keyInfo}</section>` : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font: 11pt/1.4 Georgia, "Times New Roman", serif; color: #1d1b18; margin: 0; }
h1 { font-size: 26pt; margin: 0 0 2pt; letter-spacing: .02em; }
.sub { margin: 0 0 2pt; font-size: 12pt; color: #5c574f; }
.facts { margin: 0 0 10pt; color: #5c574f; }
h2 { font-size: 13pt; margin: 14pt 0 4pt; padding-bottom: 3pt; border-bottom: 1px solid #b9b2a6; break-after: avoid; }
h3 { font-size: 9pt; margin: 12pt 0 3pt; color: #6b655b; text-transform: uppercase; letter-spacing: .08em; break-after: avoid; }
.block p { margin: 0 0 4pt; }
.days, .key { break-before: page; }
.days > section:first-child h2 { margin-top: 0; }
.daysum { margin: 0 0 4pt; font-size: 9.5pt; color: #5c574f; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
/* A day's last stop does not go over the page alone. */
tr:last-child { break-before: avoid; }
td { vertical-align: top; padding: 4pt 6pt 4pt 0; border-bottom: 1px solid #ebe6dc; }
td.time { width: 76pt; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: bold; }
td.status { width: 92pt; text-align: right; font-size: 9.5pt; }
td.gday { width: 130pt; white-space: nowrap; font-weight: bold; }
td.bkind { width: 64pt; font-size: 8.5pt; color: #6b655b; text-transform: uppercase; letter-spacing: .06em; padding-top: 6pt; }
td.ref { text-align: right; font: bold 10pt/1.4 "Courier New", monospace; }
tr.leg td { border-bottom: 0; padding: 1pt 0 1pt; font-size: 9pt; color: #6b655b; font-style: italic; }
tr:has(+ tr.leg) td { border-bottom: 0; }
.title { font-weight: bold; }
.kind { font-weight: normal; font-size: 8.5pt; color: #6b655b; text-transform: uppercase; letter-spacing: .06em; margin-left: 4pt; }
.address, .detail { font-size: 9.5pt; color: #4a463f; }
.muted { color: #5c574f; }
.small { font-size: 8.5pt; }
.pin { font: 9pt/1.4 "Courier New", monospace; color: #4a463f; }
.pin a, .key a { color: inherit; }
.nopin { color: #9a4b16; }
.booked { color: #2f6b3a; }
.tobook { color: #9a4b16; font-weight: bold; }
footer { margin-top: 16pt; font-size: 8.5pt; color: #8a8378; }
</style></head>
<body><header><h1>${title}</h1>${subtitle}${facts.length ? `<p class="facts">${escapeHtml(facts.join(" · "))}</p>` : ""}${printed}</header>
${stayList}${withWho}${glance}${bookingList}
<div class="days">${days || "<p>Nothing planned yet.</p>"}</div>
${keyPage}
<footer>Printed from Béa. Times and distances between stops are estimates from the map, not a route. Map pins are latitude, longitude as Béa placed each stop — check them against the plan, along with opening hours and bookings, before you go.</footer>
</body></html>`;
}
