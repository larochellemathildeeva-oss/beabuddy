/**
 * The places on a trip's timeline worth keeping as recommendations.
 *
 * A trip is where most good finds are actually made, and the vault is where
 * they are meant to outlive it. Each timeline card could already be saved one
 * at a time, but only from inside that trip, by a swipe or on the card's back,
 * and nothing remembered that it had been — so you could not look back over a
 * trip and pick out the places you loved. This is the shared core: which rows
 * are places (not notes or the walk between two of them), which are already in
 * the vault, and what a kept row becomes.
 */

import { findDuplicate, toNewReco, type PlaceLike } from "./captured-place.ts";
import { timelineGlyph, vaultCategory } from "./timeline-kind.ts";

export type KeeperTrip = {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type KeeperItem = {
  id: string;
  trip_id: string;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  day_date: string | null;
  position: number;
  arrived_at?: string | null | undefined;
  left_at?: string | null | undefined;
};

export type KeeperPinType = "reco" | "visited" | "nexttime" | "wishlist";

/** Béa's own directions rows, which are movement whatever their stored kind. */
const MOVEMENT_TITLE = /^(walk|drive|head|go|travel) to /i;

/** Is this row a place, rather than a note or the journey between two places? */
export function isKeepable(item: Pick<KeeperItem, "kind" | "title">): boolean {
  if (!item.title.trim()) return false;
  const glyph = timelineGlyph(item);
  if (glyph === "note" || glyph === "transport") return false;
  return !MOVEMENT_TITLE.test(item.title.trim());
}

/** The row as a place to compare against the vault: named, and where it is. */
function asPlace(item: KeeperItem, trip: KeeperTrip): PlaceLike {
  return {
    name: item.title,
    city: trip.city,
    address: item.address,
    lat: item.lat,
    lon: item.lon,
  };
}

/** Meal words in a title, for a row whose stored kind does not say. */
const MEAL_TITLE = /\b(breakfast|brunch|lunch|dinner|restaurant|caf[eé]|bar|drinks|tasting)\b/i;

/**
 * The vault category for a row, by glyph.
 *
 * A booked table comes in from a calendar as "reservation", which the glyph
 * table reads as an activity (a reservation can as well be a show), so the
 * title decides whether it was a meal.
 */
export function keeperCategory(item: Pick<KeeperItem, "kind" | "title">): string {
  if (item.kind.trim().toLowerCase() === "reservation" && MEAL_TITLE.test(item.title)) {
    return vaultCategory("meal");
  }
  return vaultCategory(timelineGlyph(item));
}

/** What a kept timeline row is saved as. The trip is where it was found. */
export function keeperToReco(item: KeeperItem, trip: KeeperTrip, pinType?: KeeperPinType) {
  return {
    ...toNewReco(
      {
        name: item.title.trim(),
        ...(item.address ? { address: item.address } : {}),
        ...(trip.city ? { city: trip.city } : {}),
        ...(trip.country ? { country: trip.country } : {}),
        ...(item.lat != null ? { lat: item.lat } : {}),
        ...(item.lon != null ? { lon: item.lon } : {}),
        source: `Trip: ${trip.title}`,
      },
      {
        // By glyph, so a row stored as "dinner" or "hotel" files itself
        // correctly rather than landing in the catch-all.
        category: keeperCategory(item),
        ...(item.detail?.trim() ? { notes: item.detail.trim() } : {}),
      },
    ),
    ...(pinType ? { pin_type: pinType } : {}),
  };
}

/** Is this row already in the vault? */
export function isAlreadyKept(
  item: KeeperItem,
  trip: KeeperTrip,
  vault: readonly PlaceLike[],
): boolean {
  return Boolean(findDuplicate(vault, asPlace(item, trip)));
}

export type KeeperPlace = {
  item: KeeperItem;
  /** Already in the vault, so there is nothing to add. */
  saved: boolean;
  /** Marked arrived or done on the day: somewhere you really went. */
  went: boolean;
};

export type KeeperGroup = { trip: KeeperTrip; places: KeeperPlace[] };

function byTimeline(a: KeeperItem, b: KeeperItem): number {
  const dayA = a.day_date ?? "￿";
  const dayB = b.day_date ?? "￿";
  if (dayA !== dayB) return dayA < dayB ? -1 : 1;
  return a.position - b.position;
}

/**
 * Trips with at least one place, most recent first, each in timeline order.
 *
 * Trips that have started come ahead of ones still to happen — you keep a
 * place you have been to, and a plan is not that yet. A place that appears
 * twice on one trip (lunch on day one, back for dinner on day three) is
 * offered once.
 */
export function keeperGroups(
  trips: readonly KeeperTrip[],
  items: readonly KeeperItem[],
  vault: readonly PlaceLike[],
  today: string,
): KeeperGroup[] {
  const byTrip = new Map<string, KeeperItem[]>();
  for (const item of items) {
    if (!isKeepable(item)) continue;
    const list = byTrip.get(item.trip_id) ?? [];
    list.push(item);
    byTrip.set(item.trip_id, list);
  }

  const groups: KeeperGroup[] = [];
  for (const trip of trips) {
    const rows = [...(byTrip.get(trip.id) ?? [])].sort(byTimeline);
    const seen: PlaceLike[] = [];
    const places: KeeperPlace[] = [];
    for (const item of rows) {
      const place = asPlace(item, trip);
      const went = Boolean(item.arrived_at || item.left_at);
      const repeat = seen.findIndex((other) => findDuplicate([other], place));
      if (repeat >= 0) {
        // Going back counts, whichever of the two visits was ticked off.
        if (went) places[repeat]!.went = true;
        continue;
      }
      seen.push(place);
      places.push({ item, saved: Boolean(findDuplicate(vault, place)), went });
    }
    if (places.length) groups.push({ trip, places });
  }

  const started = (trip: KeeperTrip) => trip.start_date != null && trip.start_date <= today;
  return groups.sort((a, b) => {
    const sa = started(a.trip);
    const sb = started(b.trip);
    if (sa !== sb) return sa ? -1 : 1;
    const da = a.trip.start_date ?? "";
    const db = b.trip.start_date ?? "";
    // Most recent first; undated trips last among their kind.
    if (da !== db) return da > db ? -1 : 1;
    return 0;
  });
}
