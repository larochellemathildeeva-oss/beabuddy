/**
 * A read-only link to a trip, for family and friends without an account.
 *
 * The link carries a 256-bit random token; Béa's server looks it up and
 * answers with this fixed, short view of the plan and nothing else: the
 * trip's name, place and dates, and each stop's day, time, kind, name and
 * address. Booking numbers, notes, documents, the people on the trip and
 * notes-to-self never leave — a "where will you be" page does not need them.
 *
 * Pure, so what is shown (and what is not) is tested.
 */

import { isSavedDirectionItem } from "./direction-stops.ts";
import { timelineGlyph, timeForRail } from "./timeline-kind.ts";

/** 32 random bytes, base64url: 43 characters. */
export function newShareToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let text = "";
  for (const b of bytes) text += String.fromCharCode(b);
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function isShareToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{40,64}$/.test(value);
}

export type ShareSourceTrip = {
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
};

export type ShareSourceItem = {
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  address: string | null;
  position: number;
  parent_id?: string | null;
};

export type SharedStop = { time: string; title: string; kind: string; address: string };
export type SharedTrip = {
  title: string;
  place: string;
  startDate: string | null;
  endDate: string | null;
  days: { day: string | null; stops: SharedStop[] }[];
};

/** The view a link shows; everything not named here stays private. */
export function sharedTripView(
  trip: ShareSourceTrip,
  items: readonly ShareSourceItem[],
): SharedTrip {
  const shown = items
    .filter(
      (item) =>
        item.title.trim() &&
        !item.parent_id &&
        !isSavedDirectionItem(item) &&
        timelineGlyph(item) !== "note",
    )
    .sort(
      (a, b) =>
        (a.day_date ?? "9999").localeCompare(b.day_date ?? "9999") || a.position - b.position,
    );
  const days: SharedTrip["days"] = [];
  for (const item of shown) {
    let day = days.at(-1);
    if (!day || day.day !== item.day_date) {
      day = { day: item.day_date, stops: [] };
      days.push(day);
    }
    day.stops.push({
      time: timeForRail(item.time_label),
      title: item.title.trim(),
      kind: timelineGlyph(item),
      address: item.address?.trim() ?? "",
    });
  }
  return {
    title: trip.title,
    place: [trip.city?.split(",")[0]?.trim(), trip.country].filter(Boolean).join(", "),
    startDate: trip.start_date,
    endDate: trip.end_date,
    days,
  };
}

/** The address of the page a token opens. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/shared/${token}`;
}
