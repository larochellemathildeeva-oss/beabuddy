import { placeQueryParts } from "./place-query.ts";
import { minimumNameLength, startsLikeAName, wordCount } from "./script.ts";

export type DirectionStop = {
  /**
   * The timeline row this came from, when it came from one.
   *
   * Carried so the coordinates the router resolves can be written back onto
   * the row that needed them. City stops have no timeline id and simply do
   * not set it.
   */
  id?: string;
  title: string;
  day_date?: string | null;
  time_label?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
};

type CityStop = {
  city: string;
  place_name?: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
  arrive_on?: string | null;
};

type TimelineItem = {
  id?: string;
  title: string;
  kind?: string | null;
  day_date?: string | null;
  time_label?: string | null;
  address?: string | null;
  detail?: string | null;
  lat?: number | null;
  lon?: number | null;
};

/** Detail lines that describe the booking or the journey, never a place. */
const STATUS_LINE =
  /^(?:booked|reserved|confirmed|booking|reservation|conf(?:irmation)?\b|ticket(?:s|ed)?\b|paid|getting there|afterwards|optional|no booking)/i;

/** Walk/Drive rows Béa already saved from Get directions — skip them on the next lookup. */
export function isSavedDirectionItem(item: {
  kind?: string | null;
  title?: string | null;
}): boolean {
  return /^(walk|drive) to /i.test((item.title ?? "").trim());
}

export function looksLikeStreetAddress(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  return /^\d+[a-z]?\s+\S+/i.test(text);
}

const ACTIVITY_SUFFIX =
  /\s+(?:(?:luxury|designer|artisanal|&|and)\s+)*(?:shopping|boutiques?(?:\s*(?:&|and)\s+(?:art\s+)?galleries)?|art\s+galleries|galleries|treatment|experience|spa(?:\s+treatment)?)$/i;

/** "Alberni Street Luxury Shopping" / "Granville St between 5th and 16th" → the street. */
export function streetNameFromText(value: string): string | null {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const match = text.match(
    /\b([A-ZÀ-ÖØ-ÿ0-9][\w.'-]*(?:\s+[A-ZÀ-ÖØ-ÿ0-9][\w.']*){0,4}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Place|Pl|Way|Lane|Ln|Crescent|Cres)\.?)\b/i,
  );
  const street = match?.[1]?.replace(/\.$/, "").trim();
  return street && street.length >= 4 ? street : null;
}

function titlePlaceCandidates(title: string): string[] {
  const base = title
    .split("·")[0]!
    .replace(/\([^)]*\)/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  const stripVerb = (v: string) =>
    v
      .replace(
        /^(?:(?:purchase|buy|hike|explore|visit|walk|stroll|browse|shop|self-guided|guided|classic|historic|picnic|lunch|dinner|breakfast|brunch|coffee|drinks?|tour|day\s+trip|check\s+in(?:\s+at)?|check\s+out(?:\s+of)?|arrive(?:\s+(?:at|in))?|arrival(?:\s+(?:at|in))?|depart(?:\s+from)?)\b\s*(?:[/:,&]\s*)?)+/i,
        "",
      )
      .trim();
  const out: string[] = [];
  const push = (v: string | undefined) => {
    const t = (v ?? "").replace(/^[-,&:/\s]+|[-,&:/\s]+$/g, "").trim();
    if (t.length >= minimumNameLength(t) - 1 && !out.includes(t)) out.push(t);
  };
  const stripTail = (v: string) =>
    v
      .replace(
        /\s+(?:walking|walk|tour|dinner|lunch|breakfast|brunch|drinks?|coffee|hike|visit|exploration)$/i,
        "",
      )
      .trim();
  const at = base.match(/\b(?:at|in|to|around|near)\s+(.+)$/i);
  if (at?.[1]) push(stripTail(stripVerb(at[1]).split(/\s*&\s*/)[0] ?? ""));
  if (at?.[1]) push(at[1]);
  const stripped = base.replace(ACTIVITY_SUFFIX, "").trim();
  if (stripped && stripped !== base) push(stripped);
  push(stripTail(stripVerb(base).split(/\s*&\s*/)[0] ?? ""));
  push(stripVerb(base).split(/\s*&\s*/)[0]);
  push(stripVerb(base));
  push(base.split(/\s*&\s*/)[0]);
  push(base);
  return out;
}

/**
 * Queries to try, best first: a real street or venue, then a cleaned title.
 * "Alberni Street Luxury Shopping" becomes "Alberni Street" before the long phrase.
 *
 * Order matters more than it looks. The geocoder asks for one result and takes
 * the first query that returns anything, so whatever sits at the front of this
 * list is what the stop becomes. A prose detail used to sit there: an imported
 * plan writes "Breakfast in Old Montréal" under "Olive et Gourmando", and the
 * restaurant was pinned to the neighbourhood centroid — not blank, which you
 * would notice and fix, but confidently wrong, which you would not.
 *
 * So only something genuinely more precise than the name outranks the name: a
 * street address, or a street pulled out of the text. Prose stays, but last,
 * where it can still rescue "Dinner in Little Italy" without hijacking a
 * venue that has a name of its own.
 */
export function placeQueryCandidates(title: string, hint?: string | null): string[] {
  const out: string[] = [];
  const push = (value?: string | null) => {
    const text = (value ?? "")
      .replace(/^[-,&\s]+|[-,&\s]+$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length >= minimumNameLength(text) - 1 && !out.includes(text)) out.push(text);
  };
  const h = hint?.trim() ?? "";
  if (looksLikeStreetAddress(h)) push(h);
  push(streetNameFromText(h));
  push(streetNameFromText(title));
  for (const name of titlePlaceCandidates(title)) push(name);
  // "Peace Park / Atomic Bomb Dome", "Shrine (厳島神社)": each name on its own.
  for (const name of placeQueryParts(title)) push(name);
  if (h && !looksLikeStreetAddress(h) && h.split(/\s+/).length <= 10) push(h);
  return looksLikeStreetAddress(out[0] ?? "") ? out.slice(0, 1) : out.slice(0, 4);
}

export function reuseKeyForStop(stop: {
  title: string;
  address?: string | null | undefined;
}): string {
  const address = stop.address?.trim();
  if (!address) return stop.title.trim().toLowerCase();
  const street = looksLikeStreetAddress(address) ? address.split(",")[0]!.trim() : address;
  return street.toLowerCase().replace(/\s+/g, " ");
}

/**
 * Planner items stash the venue or street in `detail` ("1038 Canada Place, Vancouver; suggest…")
 * and leave `address` / coords empty. Pull the first clause when it looks like a place.
 */
export function placeHintFromDetail(detail?: string | null): string | null {
  if (!detail?.trim()) return null;
  const first = detail
    .split(/[;·|]|\bsuggest\b/i)[0]!
    .replace(/\s+/g, " ")
    .trim();
  if (first.length < minimumNameLength(first) || first.length > 180) return null;
  if (looksLikeStreetAddress(first)) return first;
  // A booking's status or a folded travel note, not somewhere to look up:
  // "Booked 09:30" was being searched for as a place.
  if (STATUS_LINE.test(first)) return null;
  const street = streetNameFromText(first);
  if (street) return street;
  if (
    /^(browse|explore|suggest|book|reserve|enjoy|visit|walk|stroll|head|take|grab)\b/i.test(first)
  ) {
    return null;
  }
  if (/\b(including|flagships)\b/i.test(first)) return null;
  if (readsLikeProse(first)) return null;
  if (startsLikeAName(first) && wordCount(first) <= 12) return first;
  return null;
}

/** Small words a place name may carry in lower case: "Pão de Açúcar", "Isle of Skye". */
const NAME_JOINERS = new Set([
  "a",
  "an",
  "and",
  "at",
  "da",
  "das",
  "de",
  "del",
  "della",
  "der",
  "des",
  "di",
  "do",
  "dos",
  "du",
  "e",
  "el",
  "et",
  "la",
  "las",
  "le",
  "les",
  "lo",
  "los",
  "of",
  "on",
  "the",
  "und",
  "van",
  "von",
  "y",
]);

/**
 * A sentence about the stop rather than the name of a place.
 *
 * Names are capitalised; a description is mostly not. "Drive up for panoramic
 * sunset views overlooking Barreiras" was saved as the stop's address and
 * searched for as a place, because it starts with a capital. Only lower-case
 * letters count against it, so scripts without case are never prose here.
 */
export function readsLikeProse(text: string): boolean {
  const words = text
    .split(/[\s,;:/()]+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+/u, ""))
    .filter((word) => /^\p{L}/u.test(word) && !NAME_JOINERS.has(word.toLowerCase()));
  const lower = words.filter((word) => /^\p{Ll}/u.test(word)).length;
  return lower >= 2 && lower * 3 > words.length;
}

export function addressForStop(item: {
  address?: string | null;
  detail?: string | null;
}): string | null {
  const stored = item.address?.trim();
  if (stored) return stored;
  return placeHintFromDetail(item.detail);
}

export function hasCoords(
  point?: { lat?: number | null; lon?: number | null } | null,
): point is { lat: number; lon: number } {
  return (
    typeof point?.lat === "number" &&
    typeof point?.lon === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    (point.lat !== 0 || point.lon !== 0)
  );
}

function mapsPoint(
  name: string,
  point: { lat?: number | null; lon?: number | null } | null | undefined,
  area: string,
): string {
  if (hasCoords(point)) return `${point.lat},${point.lon}`;
  const region = area
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();
  const query = region ? `${name}, ${region}` : name;
  return encodeURIComponent(query);
}

export function mapsDirUrl(
  from: { title: string; lat?: number | null; lon?: number | null },
  to: { title: string; lat?: number | null; lon?: number | null },
  area: string,
  mode: "walking" | "driving" = "walking",
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${mapsPoint(from.title, from, area)}&destination=${mapsPoint(to.title, to, area)}&travelmode=${mode}`;
}

/**
 * A link that opens the place in whatever maps app the phone has.
 *
 * The "Map" link beside a timeline entry pointed at openstreetmap.org, which
 * on a phone is a website: no "directions" button, no transit, no handover to
 * the app already holding your route. Directions have used this universal
 * maps URL all along — a place link had simply never been brought along with
 * them, so one tap landed somewhere useful and its neighbour did not.
 *
 * The name rides along so the pin has a label rather than a bare coordinate.
 */
export function mapsPlaceUrl(
  name: string,
  point: { lat?: number | null; lon?: number | null } | null | undefined,
  /** The place's street address, when known: with the name, Maps finds the place itself. */
  address?: string | null,
): string {
  const label = name.trim();
  const street = address?.trim() ?? "";
  // Name and street: Maps opens the place — its card, hours, photos — rather
  // than a dropped pin with a coordinate for a title.
  if (label && street) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${label}, ${street}`)}`;
  }
  // A pin and a name: the name searched at the pin, so the result is labelled
  // and lands on the place there. A bare "34.88,135.77" is what people saw.
  if (hasCoords(point) && label) {
    return `https://maps.google.com/?q=${encodeURIComponent(label)}@${point.lat},${point.lon}`;
  }
  const query = hasCoords(point) ? `${point.lat},${point.lon}` : label;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function asDirectionStop(item: TimelineItem): DirectionStop {
  const address = addressForStop(item);
  const stop: DirectionStop = { title: item.title.trim() };
  if (item.id) stop.id = item.id;
  if (item.day_date) stop.day_date = item.day_date;
  if (item.time_label) stop.time_label = item.time_label;
  if (address) stop.address = address;
  if (item.lat != null) stop.lat = item.lat;
  if (item.lon != null) stop.lon = item.lon;
  return stop;
}

/** Timeline activities only — ignore Walk/Drive rows we already added. */
export function timelineStopsForDirections(items: TimelineItem[]): DirectionStop[] {
  return items
    .filter((item) => item.title.trim() && !isSavedDirectionItem(item))
    .map(asDirectionStop);
}

/** Cities when the trip has a route; otherwise the timeline. */
export function stopsForDirections(cities: CityStop[], items: TimelineItem[]): DirectionStop[] {
  if (cities.length >= 2) {
    return cities.map((stop) => {
      const title = (stop.place_name || stop.city).trim() || stop.city;
      const next: DirectionStop = { title };
      if (stop.arrive_on) next.day_date = stop.arrive_on;
      if (stop.address?.trim()) next.address = stop.address.trim();
      if (stop.lat != null) next.lat = stop.lat;
      if (stop.lon != null) next.lon = stop.lon;
      return next;
    });
  }
  return timelineStopsForDirections(items);
}

/**
 * Two stops on the same day this far apart, in a straight line, are almost
 * certainly one wrong pin, not a drive to take. 150 km: a day trip by train
 * (Hiroshima to Miyajima is 20 km, Kyoto to Nara 35) fits well inside it; a
 * stop looked up in the wrong city (Kyoto for a Hiroshima lunch, 300+ km)
 * does not.
 */
export const SAME_DAY_FAR_APART_M = 150_000;

/**
 * For each stop, the pin of the nearest stop on the same day that has one —
 * the one before it first, then the one after. That is where to look up a
 * stop with no pin: next to the rest of its day, not in the trip's home
 * city, which on a multi-city trip is often the wrong place entirely.
 */
export function sameDayAnchors(
  stops: readonly {
    day_date?: string | null | undefined;
    lat?: number | null | undefined;
    lon?: number | null | undefined;
  }[],
): ({ lat: number; lon: number } | null)[] {
  const pin = (i: number) => {
    const s = stops[i];
    return s &&
      typeof s.lat === "number" &&
      typeof s.lon === "number" &&
      hasCoords({ lat: s.lat, lon: s.lon })
      ? { lat: s.lat, lon: s.lon }
      : null;
  };
  return stops.map((stop, i) => {
    const day = stop.day_date ?? null;
    if (!day) return null;
    for (let j = i - 1; j >= 0 && (stops[j]!.day_date ?? null) === day; j--) {
      const p = pin(j);
      if (p) return p;
    }
    for (let j = i + 1; j < stops.length && (stops[j]!.day_date ?? null) === day; j++) {
      const p = pin(j);
      if (p) return p;
    }
    return null;
  });
}
