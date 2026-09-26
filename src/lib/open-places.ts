/**
 * Open Places API: Overture's place listings, searched by name near a point.
 *
 * OpenStreetMap, which Geoapify and LocationIQ both read, is thin outside big
 * cities. Barreiras' Mercado Municipal is not in it, so the only "Mercado
 * Municipal" a lookup could find was a village market 21 km away. Overture
 * carries business listings (from Meta, Microsoft and others) that cover
 * towns like that, under CDLA Permissive 2.0 — so the pin can be saved and
 * drawn on Béa's own map, which Google's terms would not allow.
 *
 * Asked only when the usual lookup found nothing, or something that does not
 * look like the stop: the free plan is 10,000 calls a month, and the service
 * stops answering at its cap rather than charging.
 *
 * Pure: builds the request and reads the answer. The request itself, and the
 * key, live in open-places.server.ts.
 */

import { distanceKm } from "./geocode-plan.ts";
import { scoreMatch } from "./match-confidence.ts";

export const OPEN_PLACES_ENDPOINT = "https://api.openplacesapi.com/v1/places";

/** How far from the middle of town to look, in miles (the API's unit). */
export const OPEN_PLACES_RADIUS_MI = 9;

/** Places the service is less sure exist are not worth pinning. */
export const OPEN_PLACES_MIN_CONFIDENCE = 0.5;

export function openPlacesUrl(query: string, near: { lat: number; lon: number }): string {
  const params = new URLSearchParams({
    q: query,
    lat: near.lat.toFixed(5),
    lon: near.lon.toFixed(5),
    radius_mi: String(OPEN_PLACES_RADIUS_MI),
    limit: "5",
    min_confidence: String(OPEN_PLACES_MIN_CONFIDENCE),
  });
  return `${OPEN_PLACES_ENDPOINT}?${params}`;
}

/** One place, as Béa uses it. */
export type OpenPlace = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** "Name, street, town" — what the card shows as the stop's address. */
  label: string;
  confidence: number | null;
};

type Json = Record<string, unknown>;

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown): number | null => {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * The street and town, however the answer spells them: a string, or an
 * object of parts (freeform/street, locality/city).
 */
function addressLine(place: Json): string {
  const raw = place["address"] ?? place["addresses"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first === "string") return first.trim();
  if (first && typeof first === "object") {
    const a = first as Json;
    const street = text(a["freeform"]) || text(a["street"]) || text(a["address_line"]);
    const town = text(a["locality"]) || text(a["city"]);
    return [street, town].filter(Boolean).join(", ");
  }
  return [text(place["street"]), text(place["locality"]) || text(place["city"])]
    .filter(Boolean)
    .join(", ");
}

/** A closed business is not somewhere to go. */
function isClosed(place: Json): boolean {
  return /closed/i.test(text(place["operating_status"]));
}

/** The places in an answer, read defensively: a bad row is skipped, not trusted. */
export function readOpenPlaces(json: unknown): OpenPlace[] {
  const rows = json && typeof json === "object" ? (json as Json)["results"] : null;
  if (!Array.isArray(rows)) return [];
  const out: OpenPlace[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const place = row as Json;
    const name = text(place["name"]);
    const lat = num(place["lat"]);
    const lon = num(place["lon"]);
    const id = text(place["place_id"]) || text(place["id"]);
    if (!name || lat == null || lon == null || !id || isClosed(place)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    const where = addressLine(place);
    out.push({
      id,
      name,
      lat,
      lon,
      label: where ? `${name}, ${where}` : name,
      confidence: num(place["confidence"]),
    });
  }
  return out;
}

/**
 * The place that is this stop, or nothing.
 *
 * Its name has to echo one of the stop's names — a search for "Cais e Porto"
 * answers with whatever is nearby and sounds alike, and a nearby wrong place
 * is still wrong. Of those that do, the nearest to the middle of town, as
 * with the other lookups: a namesake further out is the village's, not the
 * town's.
 */
export function pickOpenPlace(
  places: readonly OpenPlace[],
  names: readonly string[],
  near: { lat: number; lon: number },
): OpenPlace | null {
  const asked = names.map((name) => name.trim()).filter(Boolean);
  const matching = places.filter((place) =>
    asked.some(
      (title) =>
        scoreMatch({ title, label: place.label, alsoNamed: [place.name] }).confidence === "high",
    ),
  );
  matching.sort((a, b) => distanceKm(a, near) - distanceKm(b, near));
  return matching[0] ?? null;
}
