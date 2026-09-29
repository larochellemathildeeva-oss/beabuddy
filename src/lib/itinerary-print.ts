/**
 * The plan as a page to print, or to save as a PDF from the print dialog.
 *
 * A paper copy travels where a phone does not — a dead battery, a border
 * desk — and a PDF can be handed back to another assistant to check. Each
 * day's stops in order, with the time, the address, the note and whether it
 * is booked; plans that need a ticket and have none say "To book".
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
import { looksLikeStreetAddress } from "./direction-stops.ts";
import { formatTimelineDayLabel, groupTimelineByDay } from "./timeline-groups.ts";

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
  /** How long the stop lasts: with the time, when it ends ("09:00–09:40"). */
  planned_stay_minutes?: number | null | undefined;
};

export type PrintTrip = {
  title: string;
  /** "Paris, France · Oct 12 – 18". */
  subtitle?: string | undefined;
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
/** Leaving, or dropping bags: things done at a stay, not the stay to book. */
const STAY_ACTION =
  /\bcheck[- ]?out\b|\b(?:luggage|bag)s? drop\b|\b(?:drop|collect|pick up|leave)(?: off)? (?:the |our |your )?(?:bags|luggage)\b/i;

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

/**
 * Where "To book" goes: once per stay, on its first row that is not leaving
 * it. A night's room is one booking; saying it again on the check-out and on
 * the next morning's breakfast made three bookings of one. Coming back to the
 * same hotel after a night somewhere else is a stay of its own.
 */
export function toBookRows(rows: readonly PrintRow[]): Set<PrintRow> {
  const out = new Set<PrintRow>();
  /** The stay the plan is in, and whether its booking has been said. */
  let stay = null as { key: string; marked: boolean } | null;
  for (const row of rows) {
    if (!BOOKABLE.has(row.kind)) continue;
    if (!STAY_KINDS.has(row.kind)) {
      if (!row.booked) out.add(row);
      continue;
    }
    const key = stayKey(row);
    if (stay?.key !== key) stay = { key, marked: false };
    if (row.booked) stay.marked = true;
    if (stay.marked) continue;
    const text = `${row.title} ${row.detail ?? ""}`;
    if (STAY_ACTION.test(text) && !/\bcheck[- ]?in\b/i.test(text)) continue;
    stay.marked = true;
    out.add(row);
  }
  return out;
}

function bookingCell(row: PrintRow, toBook: ReadonlySet<PrintRow>): string {
  if (row.booked) {
    const ref = row.booking_ref?.trim();
    return `<span class="booked">Booked${ref ? ` · ${escapeHtml(ref)}` : ""}</span>`;
  }
  return toBook.has(row) ? `<span class="tobook">To book</span>` : "";
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
  const kind = KIND_LABEL[row.kind] ?? "";
  const lines = [
    `<div class="title">${escapeHtml(row.title)}${kind ? ` <span class="kind">${kind}</span>` : ""}</div>`,
    locationHtml(row),
    row.detail?.trim() ? `<div class="detail">${escapeHtml(row.detail.trim())}</div>` : "",
  ].filter(Boolean);
  return `<tr><td class="time">${time}</td><td>${lines.join("")}</td><td class="status">${bookingCell(source, toBook)}</td></tr>`;
}

export function itineraryPrintHtml(trip: PrintTrip, rows: readonly PrintRow[]): string {
  const groups = groupTimelineByDay([...rows]);
  const toBook = toBookRows(groups.flatMap((group) => group.items));
  const days = groups
    .map((group, i) => {
      const label = group.key ? formatTimelineDayLabel(group.key) : "No date";
      const heading = group.key ? `Day ${i + 1} · ${escapeHtml(label)}` : escapeHtml(label);
      return `<section><h2>${heading}</h2><table>${group.items.map((row) => rowHtml(row, toBook)).join("")}</table></section>`;
    })
    .join("");
  const title = escapeHtml(trip.title.trim() || "Trip");
  const subtitle = trip.subtitle?.trim()
    ? `<p class="sub">${escapeHtml(trip.subtitle.trim())}</p>`
    : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>
@page { margin: 16mm 14mm; }
* { box-sizing: border-box; }
body { font: 11pt/1.4 Georgia, "Times New Roman", serif; color: #1d1b18; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 2pt; }
.sub { margin: 0 0 12pt; color: #5c574f; }
h2 { font-size: 13pt; margin: 14pt 0 4pt; padding-bottom: 3pt; border-bottom: 1px solid #b9b2a6; break-after: avoid; }
table { width: 100%; border-collapse: collapse; }
tr { break-inside: avoid; }
/* A day's last stop does not go over the page alone. */
tr:last-child { break-before: avoid; }
td { vertical-align: top; padding: 4pt 6pt 4pt 0; border-bottom: 1px solid #ebe6dc; }
td.time { width: 76pt; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: bold; }
td.status { width: 92pt; text-align: right; font-size: 9.5pt; }
.title { font-weight: bold; }
.kind { font-weight: normal; font-size: 8.5pt; color: #6b655b; text-transform: uppercase; letter-spacing: .06em; margin-left: 4pt; }
.address, .detail { font-size: 9.5pt; color: #4a463f; }
.pin { font: 9pt/1.4 "Courier New", monospace; color: #4a463f; }
.pin a { color: inherit; }
.nopin { color: #9a4b16; }
.booked { color: #2f6b3a; }
.tobook { color: #9a4b16; font-weight: bold; }
footer { margin-top: 16pt; font-size: 8.5pt; color: #8a8378; }
</style></head>
<body><h1>${title}</h1>${subtitle}${days || "<p>Nothing planned yet.</p>"}
<footer>Printed from Béa. Map pins are latitude, longitude as Béa placed each stop — check them against the plan, along with opening hours and bookings, before you go.</footer>
</body></html>`;
}
