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
import { mapsPlaceUrl } from "./direction-stops.ts";
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

function bookingCell(row: PrintRow): string {
  if (row.booked) {
    const ref = row.booking_ref?.trim();
    return `<span class="booked">Booked${ref ? ` · ${escapeHtml(ref)}` : ""}</span>`;
  }
  return BOOKABLE.has(row.kind) ? `<span class="tobook">To book</span>` : "";
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
  const url = mapsPlaceUrl(row.title, row, address ?? null);
  return `${where}<div class="pin">Map pin: <a href="${escapeHtml(url)}">${pinText(row.lat, row.lon)}</a></div>`;
}

function rowHtml(row: PrintRow): string {
  const time = row.time_label?.trim() ? escapeHtml(row.time_label.trim()) : "";
  const kind = KIND_LABEL[row.kind] ?? "";
  const lines = [
    `<div class="title">${escapeHtml(row.title)}${kind ? ` <span class="kind">${kind}</span>` : ""}</div>`,
    locationHtml(row),
    row.detail?.trim() ? `<div class="detail">${escapeHtml(row.detail.trim())}</div>` : "",
  ].filter(Boolean);
  return `<tr><td class="time">${time}</td><td>${lines.join("")}</td><td class="status">${bookingCell(row)}</td></tr>`;
}

export function itineraryPrintHtml(trip: PrintTrip, rows: readonly PrintRow[]): string {
  const groups = groupTimelineByDay([...rows]);
  const days = groups
    .map((group, i) => {
      const label = group.key ? formatTimelineDayLabel(group.key) : "No date";
      const heading = group.key ? `Day ${i + 1} · ${escapeHtml(label)}` : escapeHtml(label);
      return `<section><h2>${heading}</h2><table>${group.items.map(rowHtml).join("")}</table></section>`;
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
td { vertical-align: top; padding: 4pt 6pt 4pt 0; border-bottom: 1px solid #ebe6dc; }
td.time { width: 52pt; font-variant-numeric: tabular-nums; font-weight: bold; }
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
