/**
 * One shape for "a place someone just captured", whatever door they came in by.
 *
 * Béa had three add-forms — a trip stop, a timeline entry, a recommendation —
 * each with its own draft type, its own idea of which fields a map pick fills,
 * and its own save path. The same café typed into two of them produced two
 * unrelated records with different data. This is the common core; the
 * converters at the bottom turn it into whatever the destination table wants.
 */

import { foldAccents } from "./fuzzy.ts";
import { haversine } from "./geo.ts";
import { timelineKindForPlace, type TimelineKind } from "./place-kind.ts";

export type CapturedPlace = {
  name: string;
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  /** Nominatim `type` — "cafe", "hotel". Drives the kind of stop this becomes. */
  placeType?: string | undefined;
  /** The coarser addresstype. */
  category?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  /** Where it came from: a host name, "Web search", "Current location". */
  source?: string | undefined;
  url?: string | undefined;
  notes?: string | undefined;
};

/** Anything with a name and maybe a point on the map, for comparison. */
export type PlaceLike = {
  name?: string | null | undefined;
  title?: string | null | undefined;
  city?: string | null | undefined;
  address?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

export function displayName(place: PlaceLike): string {
  return (place.name ?? place.title ?? "").trim();
}

/** Lower-case, accent-folded, punctuation-light — for comparing two names. */
export function normalizePlaceName(raw: string): string {
  return foldAccents(raw)
    .toLowerCase()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Drop the noise words that make the same venue look like two places:
 * "The Eiffel Tower" vs "Eiffel Tower", "Café de Flore" vs "Cafe de Flore".
 */
const LEADING_NOISE = /^(the|le|la|les|el|los|las|il|lo|de|het)\s+/;

export function comparableName(raw: string): string {
  let name = normalizePlaceName(raw);
  // Only one pass: "the the" is somebody's bar name, not a mistake to fix.
  name = name.replace(LEADING_NOISE, "");
  return name.trim();
}

/** Two pins within this distance are the same venue, not two of them. */
export const SAME_PLACE_METRES = 120;

function coordsOf(place: PlaceLike): { lat: number; lon: number } | null {
  if (place.lat == null || place.lon == null) return null;
  if (!Number.isFinite(place.lat) || !Number.isFinite(place.lon)) return null;
  return { lat: place.lat, lon: place.lon };
}

/**
 * Is `candidate` already represented by `existing`?
 *
 * Name equality alone is wrong — there is a Starbucks on every corner — so a
 * matching name only counts when the two are also in the same place: within
 * ~120 m, or lacking coordinates, in the same city. Two pins on the same spot
 * count even when the names differ, which catches "Sagrada Familia" saved once
 * from a link and once by hand as "La Sagrada Família".
 */
export function isSamePlace(existing: PlaceLike, candidate: PlaceLike): boolean {
  const a = coordsOf(existing);
  const b = coordsOf(candidate);
  if (a && b && haversine(a, b) <= SAME_PLACE_METRES) return true;

  const nameA = comparableName(displayName(existing));
  const nameB = comparableName(displayName(candidate));
  if (!nameA || !nameB || nameA !== nameB) return false;

  // Same name, and both know where they are, but they are far apart.
  if (a && b) return false;

  const cityA = comparableName(existing.city ?? "");
  const cityB = comparableName(candidate.city ?? "");
  if (cityA && cityB) return cityA === cityB;

  // Nothing to separate them by but the name, which matched.
  return true;
}

/** The first existing entry that is the same place, if any. */
export function findDuplicate<T extends PlaceLike>(
  existing: readonly T[],
  candidate: PlaceLike,
): T | undefined {
  return existing.find((item) => isSamePlace(item, candidate));
}

/** Split a batch into the ones already present and the ones that are new. */
export function partitionNew<C extends PlaceLike>(
  existing: readonly PlaceLike[],
  candidates: readonly C[],
): { fresh: C[]; duplicates: C[] } {
  const fresh: C[] = [];
  const duplicates: C[] = [];
  // A batch can repeat itself, so accepted items join the comparison set.
  const seen: PlaceLike[] = [...existing];
  for (const candidate of candidates) {
    if (findDuplicate(seen, candidate)) {
      duplicates.push(candidate);
    } else {
      fresh.push(candidate);
      seen.push(candidate);
    }
  }
  return { fresh, duplicates };
}

// ── Converters ──────────────────────────────────────────────────────────────

/** A geocoder or link result, as captured. */
export function capturedFromParsedPlace(parsed: {
  name: string;
  address?: string | undefined;
  city?: string | undefined;
  country?: string | undefined;
  category?: string | undefined;
  placeType?: string | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  source?: string | undefined;
  url?: string | undefined;
}): CapturedPlace {
  return {
    name: parsed.name,
    ...(parsed.address ? { address: parsed.address } : {}),
    ...(parsed.city ? { city: parsed.city } : {}),
    ...(parsed.country ? { country: parsed.country } : {}),
    ...(parsed.category ? { category: parsed.category } : {}),
    ...(parsed.placeType ? { placeType: parsed.placeType } : {}),
    ...(parsed.lat != null ? { lat: parsed.lat } : {}),
    ...(parsed.lon != null ? { lon: parsed.lon } : {}),
    ...(parsed.source ? { source: parsed.source } : {}),
    ...(parsed.url ? { url: parsed.url } : {}),
  };
}

/** A saved recommendation, as captured — so a rec can become a trip stop. */
export function capturedFromReco(reco: {
  name: string;
  city?: string | null | undefined;
  country?: string | null | undefined;
  address?: string | null | undefined;
  category?: string | null | undefined;
  notes?: string | null | undefined;
  url?: string | null | undefined;
  source?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
}): CapturedPlace {
  return {
    name: reco.name,
    ...(reco.address ? { address: reco.address } : {}),
    ...(reco.city ? { city: reco.city } : {}),
    ...(reco.country ? { country: reco.country } : {}),
    ...(reco.category ? { category: reco.category } : {}),
    ...(reco.notes ? { notes: reco.notes } : {}),
    ...(reco.url ? { url: reco.url } : {}),
    ...(reco.lat != null ? { lat: reco.lat } : {}),
    ...(reco.lon != null ? { lon: reco.lon } : {}),
    // Keep where it originally came from; only label it when nothing is known,
    // so restoring a removed rec does not rewrite its provenance.
    source: reco.source || "Your saved places",
  };
}

/** The address line to store when the geocoder gave a city but no street. */
export function addressLine(place: CapturedPlace): string {
  return place.address || [place.city, place.country].filter(Boolean).join(", ");
}

export function toTimelineItem(
  place: CapturedPlace,
  extras: { kind?: string; day_date?: string; time_label?: string; detail?: string } = {},
): {
  kind: string;
  title: string;
  day_date?: string;
  time_label?: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
} {
  const address = addressLine(place);
  const detail = extras.detail ?? place.notes;
  return {
    kind: extras.kind ?? timelineKindForPlace(place),
    title: place.name,
    ...(extras.day_date ? { day_date: extras.day_date } : {}),
    ...(extras.time_label ? { time_label: extras.time_label } : {}),
    ...(detail ? { detail } : {}),
    ...(address ? { address } : {}),
    ...(place.lat != null ? { lat: place.lat } : {}),
    ...(place.lon != null ? { lon: place.lon } : {}),
  };
}

export function toNewStop(
  place: CapturedPlace,
  extras: { kind?: string; arrive_on?: string; depart_on?: string; notes?: string } = {},
): {
  kind: string;
  city: string;
  country: string;
  place_name: string;
  address: string;
  lat?: number;
  lon?: number;
  arrive_on: string;
  depart_on: string;
  notes: string;
} {
  // A stop is filed under its city; the venue name rides along in place_name
  // so "Hotel Lux" does not become a city called Hotel Lux.
  const city = place.city || place.name;
  const venue = place.city && place.name !== place.city ? place.name : "";
  return {
    kind: extras.kind ?? "destination",
    city,
    country: place.country ?? "",
    place_name: venue,
    address: place.address ?? "",
    ...(place.lat != null ? { lat: place.lat } : {}),
    ...(place.lon != null ? { lon: place.lon } : {}),
    arrive_on: extras.arrive_on ?? "",
    depart_on: extras.depart_on ?? "",
    notes: extras.notes ?? place.notes ?? "",
  };
}

export function toNewReco(
  place: CapturedPlace,
  extras: { category?: string; notes?: string; recommended_by?: string; pin_type?: string } = {},
): {
  name: string;
  city?: string;
  country?: string;
  address?: string;
  category?: string;
  notes?: string;
  recommended_by?: string;
  source?: string;
  url?: string;
  lat?: number;
  lon?: number;
} {
  const notes = extras.notes ?? place.notes;
  return {
    name: place.name,
    ...(place.city ? { city: place.city } : {}),
    ...(place.country ? { country: place.country } : {}),
    ...(place.address ? { address: place.address } : {}),
    ...(extras.category ? { category: extras.category } : {}),
    ...(notes ? { notes } : {}),
    ...(extras.recommended_by ? { recommended_by: extras.recommended_by } : {}),
    ...(place.source ? { source: place.source } : {}),
    ...(place.url ? { url: place.url } : {}),
    ...(place.lat != null ? { lat: place.lat } : {}),
    ...(place.lon != null ? { lon: place.lon } : {}),
  };
}

/** What this place would become on a timeline, for showing before you commit. */
export function previewKind(place: CapturedPlace): TimelineKind {
  return timelineKindForPlace(place);
}
