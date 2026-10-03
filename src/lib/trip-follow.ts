/**
 * A trip someone shared with a Béa traveller, as their Following list shows
 * it: what the share link shows, cut down to a card. Pure, so what a card
 * carries (and does not) is tested.
 */

import { sharedNow, type SharedTrip } from "./trip-share.ts";

/** Where a traveller stands with a shared trip; "unavailable" until its migration is in. */
export type FollowState = "following" | "not-following" | "gone" | "unavailable";

export type FollowedTrip = {
  /** The link's token: the card opens the shared page, nothing else. */
  token: string;
  title: string;
  place: string;
  startDate: string | null;
  endDate: string | null;
  /** True when the link follows along. */
  live: boolean;
  /** The stop they are at, on a link that follows along. */
  nowAt: string | null;
};

export function followedTripCard(token: string, trip: SharedTrip): FollowedTrip {
  return {
    token,
    title: trip.title,
    place: trip.place,
    startDate: trip.startDate,
    endDate: trip.endDate,
    live: trip.following,
    nowAt: trip.following ? (sharedNow(trip)?.stop.title ?? null) : null,
  };
}
