/**
 * Where a trip's cities are, when the traveller typed them rather than picking
 * them from the search: each is looked up by its name once, and the stop
 * keeps the answer, so the Home map (and anything else drawn from the stops)
 * can place it.
 *
 * Everything here is plain words and numbers, so it is tested on its own;
 * `city-locate.ts` asks the map and saves the answers.
 */

export type Position = { lat: number; lon: number };

export type CityStop = {
  id?: string;
  city: string;
  country?: string | null;
  lat: number | null;
  lon: number | null;
  /** A stop at a named place (a hotel, an address) is not the city itself. */
  place_name?: string | null;
  address?: string | null;
  arrive_on?: string | null;
  depart_on?: string | null;
};

/** What the place search answers, as far as finding a city goes. */
export type CityHit = {
  name: string;
  city?: string;
  country?: string;
  placeType?: string;
  lat?: number;
  lon?: number;
  weak?: boolean;
};

/** The kinds of answer that are a town, not a venue, a region or a country. */
const TOWNS = new Set(["city", "town", "village", "hamlet", "municipality", "locality", "suburb"]);
/** An area that may be the city (Berlin is a state too) when it is named like it. */
const AREAS = new Set(["administrative", "borough", "quarter"]);

/** A position the map can use: on the globe, not a typo or a swapped pair. */
export function hasPosition(s: { lat: number | null; lon: number | null }): boolean {
  return (
    s.lat !== null &&
    s.lon !== null &&
    Number.isFinite(s.lat) &&
    Number.isFinite(s.lon) &&
    Math.abs(s.lat) <= 85 &&
    Math.abs(s.lon) <= 180
  );
}

/** Letters only, without accents or case: "Zürich" and "zurich" are one name. */
function plain(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** How a city is remembered: its name and country, as plain words. */
export function cityKey(city: string, country?: string | null): string {
  return `${plain(city)}|${plain(country ?? "")}`;
}

/** What is asked: "Berlin, Germany", or the name alone when it already says where. */
export function cityQuery(city: string, country?: string | null): string {
  const name = city.trim();
  const where = (country ?? "").trim();
  if (!where || plain(name).includes(plain(where))) return name;
  return `${name}, ${where}`;
}

/** The cities with no position, each once, in trip order, at most `max`. */
export function citiesToLocate(
  stops: readonly CityStop[],
  max = 8,
): { city: string; country: string | null; key: string }[] {
  const out: { city: string; country: string | null; key: string }[] = [];
  const seen = new Set<string>();
  for (const stop of stops) {
    const city = stop.city.trim();
    if (city.length < 2 || hasPosition(stop)) continue;
    const key = cityKey(city, stop.country);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ city, country: stop.country?.trim() || null, key });
    if (out.length >= max) break;
  }
  return out;
}

function sameName(a: string, b: string): boolean {
  const x = plain(a);
  const y = plain(b);
  if (x.length < 2 || y.length < 2) return false;
  // "Frankfurt" is "Frankfurt am Main"; "New York" is "New York City".
  return x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `);
}

/**
 * The answer that is the city: a town or area named like it, else the first
 * town or area the search was sure of (a city the map names in its own
 * language, "München" for "Munich"). Never a country, or a venue named after
 * the city ("Frankfurt Airport").
 */
export function pickCityHit(hits: readonly CityHit[], city: string): Position | null {
  const placed = hits.filter(
    (h): h is CityHit & Position =>
      typeof h.lat === "number" &&
      typeof h.lon === "number" &&
      hasPosition({ lat: h.lat, lon: h.lon }) &&
      h.placeType !== "country" &&
      // A country comes back as an "administrative" area named like itself.
      !(h.country && plain(h.country) === plain(h.name)),
  );
  const kind = (h: CityHit) => h.placeType ?? "";
  const named = placed.find(
    (h) =>
      (TOWNS.has(kind(h)) || AREAS.has(kind(h))) &&
      (sameName(h.name, city) || (!!h.city && sameName(h.city, city))),
  );
  // The map answers most cities as an "administrative" area, often in their
  // own language ("München", "京都市"): its first answer to the city's name
  // and country is taken when nothing is named like it.
  const town = named ?? placed.find((h) => !h.weak && (TOWNS.has(kind(h)) || AREAS.has(kind(h))));
  return town ? { lat: town.lat, lon: town.lon } : null;
}

/** The stops, each without a position given its city's, where one was found. */
export function withCityPositions<T extends CityStop>(
  stops: readonly T[],
  positions: ReadonlyMap<string, Position>,
): T[] {
  return stops.map((stop) => {
    if (hasPosition(stop)) return stop;
    const found = positions.get(cityKey(stop.city, stop.country));
    return found ? { ...stop, lat: found.lat, lon: found.lon } : stop;
  });
}

/**
 * The saved stops to give their city's position: only a stop that is the
 * city itself. A hotel or an address without a pin keeps none rather than
 * being pinned to the middle of town.
 */
export function stopsToPin(
  stops: readonly CityStop[],
  positions: ReadonlyMap<string, Position>,
): { id: string; lat: number; lon: number }[] {
  const out: { id: string; lat: number; lon: number }[] = [];
  for (const stop of stops) {
    if (!stop.id || hasPosition(stop) || stop.place_name?.trim() || stop.address?.trim()) continue;
    const found = positions.get(cityKey(stop.city, stop.country));
    if (found) out.push({ id: stop.id, lat: found.lat, lon: found.lon });
  }
  return out;
}

/** A one-city trip keeps its city on the trip: drawn as its only stop. */
export function tripCityStop(trip: {
  city?: string | null;
  country?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}): CityStop[] {
  const city = trip.city?.split(",")[0]?.trim() ?? "";
  if (!city) return [];
  return [
    {
      city,
      country: trip.country ?? null,
      lat: null,
      lon: null,
      arrive_on: trip.start_date ?? null,
      depart_on: trip.end_date ?? null,
    },
  ];
}
