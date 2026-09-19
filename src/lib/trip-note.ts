/**
 * What Béa makes of a trip, on its own card.
 *
 * The card used to be a row of facts — a title, a place, two dates, a status
 * pill — which told you everything except whether anything needed doing. This
 * is the line that answers that, and it is built from the trip's real state
 * rather than written once and left: how close it is, whether Béa knows where
 * you are going, and whether anything is planned.
 *
 * Third person throughout, per WHAT_BEA_BELIEVES. She is a small dog with an
 * opinion about your weekend, not a system reporting status.
 *
 * It stays quiet when it has nothing useful to say. A trip that has been and
 * gone does not need a nudge, and a card that always carries a sentence
 * teaches people to stop reading it.
 */

import { parseLocalDate } from "./trip-dates.ts";

export type TripNoteState = {
  startDate?: string | null | undefined;
  endDate?: string | null | undefined;
  /** Cities and stopovers on the trip. */
  stopCount: number;
  /**
   * Entries on the timeline, or null where the caller has not loaded them.
   *
   * The trips list knows each trip's stops but not its timeline — counting
   * those would be a query per card — so it passes null, and Béa says nothing
   * about the plan rather than announcing there isn't one. Claiming a trip is
   * unplanned because nobody looked is worse than saying less.
   */
  plannedCount: number | null;
};

/** Close enough that an empty plan is worth mentioning. */
export const SOON_DAYS = 14;

function daysUntil(from: string, to: string): number | null {
  const a = parseLocalDate(from);
  const b = parseLocalDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function beaTripNote(state: TripNoteState, today: string): string | null {
  const { startDate, endDate, stopCount, plannedCount } = state;
  const start = startDate && parseLocalDate(startDate) ? startDate : null;
  const end = endDate && parseLocalDate(endDate) ? endDate : start;

  // Undated: the one case where there is nothing to count down to, but plenty
  // Béa can still hold.
  if (!start) {
    if (stopCount === 0) return "No dates, nowhere yet. Béa is happy to wait.";
    return "No dates on this one yet. Béa is holding the places.";
  }

  if (end && today > end) return null;
  if (today >= start) {
    if (plannedCount === null) return "You are on this one right now.";
    return plannedCount > 0
      ? "You are on this one. Béa has the plan if you need it."
      : "You are on this one. Nothing planned, which is also a plan.";
  }

  const days = daysUntil(today, start);
  const soon = days !== null && days <= SOON_DAYS;
  const away =
    days === null
      ? ""
      : days === 0
        ? "today"
        : days === 1
          ? "tomorrow"
          : `in ${plural(days, "day", "days")}`;

  if (stopCount === 0) {
    return soon
      ? `Leaving ${away} and Béa does not know where to yet.`
      : "Béa does not know where you are going yet. Add a stop and she can start.";
  }

  if (plannedCount === null) {
    // Stops are known, the timeline is not. Say the part that is true.
    return soon ? `Leaving ${away}.` : null;
  }

  if (plannedCount === 0) {
    return soon
      ? `Leaving ${away}, with nothing on the timeline yet.`
      : "Somewhere to go, nothing planned. Béa can build the rest.";
  }

  return soon
    ? `Leaving ${away}, with ${plural(plannedCount, "thing", "things")} planned.`
    : `${plural(plannedCount, "thing", "things")} planned. Béa will keep an eye on it.`;
}
