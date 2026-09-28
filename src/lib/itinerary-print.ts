/**
 * The plan as a page to print, or to save as a PDF from the print dialog.
 *
 * A paper copy travels where a phone does not — a dead battery, a border
 * desk — and a PDF can be handed back to another assistant to check. Each
 * day's stops in order, with the time, the address, the note and whether it
 * is booked; plans that need a ticket and have none say "To book".
 *
 * Pure string building, so it is tested without a browser. Every value is
 * escaped: titles and notes are the traveller's own text.
 */
import { formatTimelineDayLabel, groupTimelineByDay } from "./timeline-groups.ts";

export type PrintRow = {
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
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

function rowHtml(row: PrintRow): string {
  const time = row.time_label?.trim() ? escapeHtml(row.time_label.trim()) : "";
  const kind = KIND_LABEL[row.kind] ?? "";
  const lines = [
    `<div class="title">${escapeHtml(row.title)}${kind ? ` <span class="kind">${kind}</span>` : ""}</div>`,
    row.address?.trim() ? `<div class="address">${escapeHtml(row.address.trim())}</div>` : "",
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
.booked { color: #2f6b3a; }
.tobook { color: #9a4b16; font-weight: bold; }
footer { margin-top: 16pt; font-size: 8.5pt; color: #8a8378; }
</style></head>
<body><h1>${title}</h1>${subtitle}${days || "<p>Nothing planned yet.</p>"}
<footer>Printed from Béa. Check opening hours and bookings before you go.</footer>
</body></html>`;
}
