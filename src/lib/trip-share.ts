/**
 * A read-only link to a trip, for family and friends without an account.
 *
 * The link carries a 256-bit random token; Béa's server looks it up and
 * answers with this fixed, short view of the plan and nothing else: the
 * trip's name, place and dates, and each stop's day, time, kind, name and
 * address. Booking numbers, notes, documents, the people on the trip and
 * notes-to-self never leave — a "where will you be" page does not need them.
 *
 * A link made to "follow along" also says which stop the trip is at and
 * which are done, from the "I'm here" / "Leaving" taps on the trip — never
 * the phone's position, and never the times of the taps.
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
  arrived_at?: string | null;
  left_at?: string | null;
  lat?: number | null;
  lon?: number | null;
};

/** Where the trip is on a stop, for a link that follows along. */
export type SharedStopStatus = "here" | "done";

export type SharedStop = {
  time: string;
  title: string;
  kind: string;
  address: string;
  /** Only on a link that follows along, and only once the stop is reached. */
  status?: SharedStopStatus;
};
export type SharedTrip = {
  title: string;
  place: string;
  startDate: string | null;
  endDate: string | null;
  /** True when the link shows which stop the trip is at. */
  following: boolean;
  /**
   * Each day with its time zone (IANA, from the day's first pin), so a
   * friend elsewhere can read the plan's times against their own. Never the
   * pins themselves.
   */
  days: { day: string | null; zone?: string; stops: SharedStop[] }[];
};

/**
 * "I'm here" older than this with no "Leaving" is read as done: someone
 * forgot to tap, and a friend should not see them at yesterday's museum.
 */
export const SHARED_HERE_MAX_MS = 12 * 60 * 60 * 1000;

/** A stop's progress as a friend may see it: here, done, or nothing yet. */
export function sharedStopStatus(
  item: Pick<ShareSourceItem, "arrived_at" | "left_at">,
  now: number,
): SharedStopStatus | undefined {
  const arrived = item.arrived_at ? Date.parse(item.arrived_at) : NaN;
  if (!Number.isFinite(arrived)) return undefined;
  if (item.left_at || now - arrived > SHARED_HERE_MAX_MS) return "done";
  return "here";
}

/** The view a link shows; everything not named here stays private. */
export function sharedTripView(
  trip: ShareSourceTrip,
  items: readonly ShareSourceItem[],
  follow: { following: boolean; now: number } = { following: false, now: 0 },
  zoneAt?: (lat: number, lon: number) => string | null,
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
  // Stops marked "here", with when — kept out of the view, only to choose one.
  const here: { stop: SharedStop; at: number }[] = [];
  for (const item of shown) {
    let day = days.at(-1);
    if (!day || day.day !== item.day_date) {
      day = { day: item.day_date, stops: [] };
      days.push(day);
    }
    const stop: SharedStop = {
      time: timeForRail(item.time_label),
      title: item.title.trim(),
      kind: timelineGlyph(item),
      address: item.address?.trim() ?? "",
    };
    if (!day.zone && zoneAt && Number.isFinite(item.lat) && Number.isFinite(item.lon)) {
      const zone = zoneAt(item.lat!, item.lon!);
      if (zone) day.zone = zone;
    }
    const status = follow.following ? sharedStopStatus(item, follow.now) : undefined;
    if (status) stop.status = status;
    if (status === "here") here.push({ stop, at: Date.parse(item.arrived_at!) });
    day.stops.push(stop);
  }
  // Several stops "here" at once (a "Leaving" never tapped, or a tap on
  // another phone): the latest arrival is where they are, the rest are done.
  const latest = here.reduce<(typeof here)[number] | null>(
    (best, h) => (!best || h.at >= best.at ? h : best),
    null,
  );
  for (const h of here) if (h !== latest) h.stop.status = "done";
  return {
    title: trip.title,
    place: [trip.city?.split(",")[0]?.trim(), trip.country].filter(Boolean).join(", "),
    startDate: trip.start_date,
    endDate: trip.end_date,
    following: follow.following,
    days,
  };
}

/** The address of the page a token opens. */
export function shareUrl(origin: string, token: string): string {
  return `${origin.replace(/\/+$/, "")}/shared/${token}`;
}

/**
 * The key a shared-trip reader is limited by: their address, or for IPv6 its
 * /64, since one connection can be handed a whole /64 and rotate through it.
 * IPv4 inside IPv6 (`::ffff:1.2.3.4`) is read as the IPv4 address.
 */
export function shareClientKey(address: string): string {
  const raw = address
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(raw);
  if (mapped) return mapped[1]!;
  if (!raw.includes(":")) return raw || "unknown";
  const [head = "", tail = ""] = raw.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = raw.includes("::")
    ? [...left, ...Array<string>(Math.max(0, 8 - left.length - right.length)).fill("0"), ...right]
    : left;
  if (groups.length !== 8) return raw;
  return `${groups
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ""))
    .join(":")}::/64`;
}

/**
 * A maps search for a stop on a shared plan, by its name and address, so the
 * friend reading it on the go can tap through to directions. A link, not an
 * API call: nothing is looked up, and nothing beyond what the page already
 * shows is sent. Null when there is nothing to search for.
 */
export function sharedStopMapsUrl(stop: Pick<SharedStop, "title" | "address">): string | null {
  const query = [stop.title.trim(), stop.address.trim()].filter(Boolean).join(", ");
  if (!stop.address.trim() || !query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** The stop a following friend sees first: where the trip is now. */
export function sharedNow(trip: SharedTrip): { day: string | null; stop: SharedStop } | null {
  for (const day of trip.days) {
    const stop = day.stops.find((s) => s.status === "here");
    if (stop) return { day: day.day, stop };
  }
  return null;
}

type SharedPlace = { day: string | null; stop: SharedStop };

/** What a following friend sees first: where they are, where they go next. */
export type SharedLive = {
  now: SharedPlace | null;
  next: SharedPlace | null;
  /** The day the card is about, with its stops done and in all. */
  day: { day: string | null; done: number; total: number } | null;
};

/**
 * The live card of a link that follows along. Next is the first stop not
 * yet reached after the one they are at, or when they are at none, after
 * the last one done; never on a day that is over. `today` says what today
 * is: one date for every day, or, for a trip across time zones, the date
 * in a given day's own zone (each day is judged on its own calendar).
 */
export function sharedLive(
  trip: SharedTrip,
  today: string | null | ((zone: string | undefined) => string) = null,
): SharedLive {
  const flat: SharedPlace[] = trip.days.flatMap((d) =>
    d.stops.map((stop) => ({ day: d.day, stop })),
  );
  const hereAt = flat.findIndex((p) => p.stop.status === "here");
  const now = hereAt >= 0 ? flat[hereAt]! : null;
  let from = 0;
  if (now) {
    from = hereAt + 1;
  } else {
    flat.forEach((p, i) => {
      if (p.stop.status === "done") from = i + 1;
    });
  }
  // A late arrival yesterday can still read "here" after midnight; next is
  // never on a day that is over, either way.
  if (today) {
    const todayOf = (day: string) =>
      typeof today === "string" ? today : today(sharedTripZone(trip, day));
    const firstToday = flat.findIndex((p) => p.day !== null && p.day >= todayOf(p.day));
    from = Math.max(from, firstToday < 0 ? flat.length : firstToday);
  }
  const next = flat.slice(from).find((p) => !p.stop.status && p.day !== null) ?? null;
  const focus = now ?? next;
  const focusDay = focus ? trip.days.find((d) => d.day === focus.day) : undefined;
  return {
    now,
    next,
    day: focusDay
      ? {
          day: focusDay.day,
          done: focusDay.stops.filter((s) => s.status === "done").length,
          total: focusDay.stops.length,
        }
      : null,
  };
}

/**
 * The time zone a day of the trip is lived in: its own, else the last
 * pinned day before it (a day with no pins is usually spent where the one
 * before ended), else the first pinned day. Without a day, the first.
 * Undefined when no stop is pinned at all.
 */
export function sharedTripZone(trip: SharedTrip, day?: string | null): string | undefined {
  const at = day === undefined ? -1 : trip.days.findIndex((d) => d.day === day);
  for (let i = at; i >= 0; i--) {
    const zone = trip.days[i]!.zone;
    if (zone) return zone;
  }
  return trip.days.find((d) => d.zone)?.zone;
}
