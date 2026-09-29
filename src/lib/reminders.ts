/**
 * Reminders, in the app: the bookings and departures coming up soon.
 *
 * Béa has no push notifications, so these are what Companion says when you
 * open it — "Your train leaves in 40 min", "Dinner at Taberna in 1 h 25 min",
 * "Check-in at the hotel from 15:00" — and, the evening before, an early
 * departure tomorrow. Only what has a clock time is reminded: a reminder
 * worked out from a guess would be worse than none.
 *
 * Read on the place's clock (`placeClock`), since the plan's times are the
 * place's own. Pure, so each rule is tested.
 */

import { isBooked } from "./bookings.ts";
import { clockMinutes } from "./companion.ts";
import { isSavedDirectionItem } from "./direction-stops.ts";
import { isTravelLeg } from "./import-stop.ts";
import { timelineGlyph } from "./timeline-kind.ts";

export type ReminderItem = {
  id: string;
  title: string;
  kind: string;
  day_date: string | null;
  time_label: string | null;
  booked?: boolean | null;
  arrived_at?: string | null;
};

export type Reminder = {
  id: string;
  itemId: string;
  /** "soon" is inside the hour; "later" is today; "tomorrow" is the evening before. */
  when: "soon" | "later" | "tomorrow";
  text: string;
};

/** Departures are reminded this far ahead; they need getting to. */
const TRAVEL_AHEAD_MIN = 4 * 60;
/** Tables and tickets this far ahead. */
const BOOKING_AHEAD_MIN = 2 * 60;
/** From this time of the evening, an early start tomorrow is worth a word. */
const EVENING_MIN = 18 * 60;
/** "Early" is before this. */
const EARLY_MIN = 10 * 60;

function inWords(minutes: number): string {
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `in ${h} h ${m} min` : `in ${h} h`;
}

function clock(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d + 1));
  return date.toISOString().slice(0, 10);
}

/**
 * What to remind, soonest first. `now` is the place's day and minutes after
 * midnight. Stops already arrived at are done with.
 */
export function remindersFor(
  items: readonly ReminderItem[],
  now: { day: string; minutes: number },
): Reminder[] {
  const out: (Reminder & { at: number })[] = [];
  const tomorrow = nextDay(now.day);
  for (const item of items) {
    if (!item.title.trim() || item.arrived_at || isSavedDirectionItem(item)) continue;
    if (isTravelLeg({ kind: item.kind, title: item.title }) && timelineGlyph(item) !== "transport")
      continue;
    const at = clockMinutes(item.time_label);
    if (at == null) continue;
    const glyph = timelineGlyph(item);
    const travel = glyph === "transport";
    const stay = glyph === "lodging";
    const booked = isBooked(item);
    if (!travel && !stay && !booked) continue;

    if (item.day_date === now.day) {
      const left = at - now.minutes;
      if (stay) {
        // Check-in is a window that opens, not a train that leaves.
        if (left > 0 && left <= TRAVEL_AHEAD_MIN) {
          out.push({
            id: `stay:${item.id}`,
            itemId: item.id,
            when: left <= 60 ? "soon" : "later",
            text: `Check-in at ${item.title} from ${clock(at)}`,
            at,
          });
        }
        continue;
      }
      const ahead = travel ? TRAVEL_AHEAD_MIN : BOOKING_AHEAD_MIN;
      if (left < -15 || left > ahead) continue;
      out.push({
        id: `today:${item.id}`,
        itemId: item.id,
        when: left <= 60 ? "soon" : "later",
        text: `${item.title} at ${clock(at)}, ${inWords(left)}`,
        at,
      });
    } else if (
      item.day_date === tomorrow &&
      travel &&
      at < EARLY_MIN &&
      now.minutes >= EVENING_MIN
    ) {
      out.push({
        id: `tomorrow:${item.id}`,
        itemId: item.id,
        when: "tomorrow",
        text: `Early start: ${item.title} at ${clock(at)} tomorrow`,
        at: at + 1440,
      });
    }
  }
  return out.sort((a, b) => a.at - b.at).map(({ at: _at, ...r }) => r);
}
