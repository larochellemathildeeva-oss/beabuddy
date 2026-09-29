/**
 * The trip as a calendar file (.ics), for Apple, Google or Outlook Calendar.
 *
 * Béa could read calendar files but not write one. Each entry with a day
 * becomes an event: at its time for as long as its planned stay (an hour
 * when none is set), or all day when it has no clock time. The whole trip
 * is one more all-day event across its dates.
 *
 * Times are written "floating" — no time zone — on purpose. A plan's times
 * are the place's own ("dinner at 19:30" in Lisbon), and a floating time
 * shows at 19:30 on whatever clock the phone is keeping, which is the
 * place's once you are there. Pinning them to the home zone would move
 * every event by the time difference.
 *
 * Pure string building, so it is tested without a browser.
 */

import { clockMinutes } from "./companion.ts";
import { isSavedDirectionItem } from "./direction-stops.ts";

export type CalendarItem = {
  id: string;
  title: string;
  day_date: string | null;
  time_label: string | null;
  detail?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  planned_stay_minutes?: number | null;
  booking_ref?: string | null;
};

export type CalendarTrip = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

const DEFAULT_MINUTES = 60;

/** RFC 5545 text: backslash, semicolon, comma and newlines escaped. */
export function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** Lines longer than 75 octets folded, as calendars expect. */
export function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = "";
  let size = 0;
  for (const char of line) {
    const n = new TextEncoder().encode(char).length;
    const limit = out.length === 0 ? 75 : 74;
    if (size + n > limit) {
      out.push(current);
      current = "";
      size = 0;
    }
    current += char;
    size += n;
  }
  out.push(current);
  return out.join("\r\n ");
}

const compactDate = (day: string) => day.replace(/-/g, "");

function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** "20261006T193000", floating, `minutes` after the day's midnight (may run into the next day). */
function localStamp(day: string, minutes: number): string {
  const date = addDays(day, Math.floor(minutes / 1440));
  const m = ((minutes % 1440) + 1440) % 1440;
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${compactDate(date)}T${hh}${mm}00`;
}

function utcStamp(now: Date): string {
  return now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The calendar file's text, CRLF line endings, ready to download. */
export function tripCalendar(
  trip: CalendarTrip,
  items: readonly CalendarItem[],
  now: Date = new Date(),
): string {
  const stamp = utcStamp(now);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bea//Trip//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${icsText(trip.title)}`,
  ];

  const start = trip.start_date && ISO_DAY.test(trip.start_date) ? trip.start_date : null;
  const end = trip.end_date && ISO_DAY.test(trip.end_date) ? trip.end_date : start;
  if (start && end) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:trip-${trip.id}@bea`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${compactDate(start)}`,
      `DTEND;VALUE=DATE:${compactDate(addDays(end, 1))}`,
      `SUMMARY:${icsText(trip.title)}`,
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
    );
  }

  for (const item of items) {
    if (!item.title.trim() || !item.day_date || !ISO_DAY.test(item.day_date)) continue;
    if (isSavedDirectionItem(item)) continue;
    const at = clockMinutes(item.time_label);
    const notes = [
      item.booking_ref?.trim() ? `Booking: ${item.booking_ref.trim()}` : "",
      item.detail?.trim() ?? "",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push("BEGIN:VEVENT", `UID:${item.id}@bea`, `DTSTAMP:${stamp}`);
    if (at == null) {
      lines.push(
        `DTSTART;VALUE=DATE:${compactDate(item.day_date)}`,
        `DTEND;VALUE=DATE:${compactDate(addDays(item.day_date, 1))}`,
        "TRANSP:TRANSPARENT",
      );
    } else {
      const minutes =
        item.planned_stay_minutes && item.planned_stay_minutes > 0
          ? item.planned_stay_minutes
          : DEFAULT_MINUTES;
      lines.push(
        `DTSTART:${localStamp(item.day_date, at)}`,
        `DTEND:${localStamp(item.day_date, at + minutes)}`,
      );
    }
    lines.push(`SUMMARY:${icsText(item.title.trim())}`);
    if (item.address?.trim()) lines.push(`LOCATION:${icsText(item.address.trim())}`);
    if (
      typeof item.lat === "number" &&
      typeof item.lon === "number" &&
      !(item.lat === 0 && item.lon === 0)
    ) {
      lines.push(`GEO:${item.lat.toFixed(6)};${item.lon.toFixed(6)}`);
    }
    if (notes) lines.push(`DESCRIPTION:${icsText(notes)}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/** "lisbon-in-october.ics" */
export function calendarFileName(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "trip"}.ics`;
}
