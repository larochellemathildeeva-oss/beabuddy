/**
 * Which trips Plan with Béa offers in its "Which trip?" sheet. Pure, so the
 * rule is tested on its own.
 *
 * Build and Import start something: they offer trips still ahead or under
 * way (dated soonest first, then ones with no dates yet), never one that is
 * over, and with none of those they go straight to a new trip. Optimize and
 * Compare work on stops a trip already has, so a recent past trip may be
 * what the traveller means and is offered after the others.
 */

import { pastTrips, tripTabs } from "./home-trip.ts";

type ChoiceTrip = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status?: string | null;
};

/** Trips still ahead or under way the sheet lists at most. */
export const PLAN_CHOICES_AHEAD = 4;
/** Past trips Optimize and Compare also list. */
export const PLAN_CHOICES_PAST = 3;

/** Build and Import can begin with a trip that does not exist yet. */
export function startsNewTrip(tab: string): boolean {
  return tab === "build" || tab === "import";
}

export function planTripChoices<T extends ChoiceTrip>(
  trips: readonly T[],
  today: string,
  tab: string,
): T[] {
  const { upcoming, drafts } = tripTabs(trips, today);
  const ahead = [...upcoming, ...drafts].slice(0, PLAN_CHOICES_AHEAD);
  if (startsNewTrip(tab)) return ahead;
  return [...ahead, ...pastTrips(trips, today, PLAN_CHOICES_PAST)];
}
