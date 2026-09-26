/**
 * What the World globe draws: the places you have been, and nothing else.
 *
 * The globe used to carry every pin — wishlist, next time, recommendations —
 * which made it a second copy of the Recs tab and buried the one thing a
 * globe says well: how much of the world you have seen. So it now shows
 * three layers of the same answer: the countries you have been to, the
 * provinces or states inside them, and a dot for each city.
 *
 * A visited café is not a place on this map; its city is. Several visited
 * pins in one city are one dot, placed at their middle.
 *
 * Kept free of the globe so it can be tested under node.
 */

import { geoArea, geoBounds, geoContains } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import type { Pin } from "@/data/atlas";
import { countryCode, countryDisplayName, countryKey } from "./country-names.ts";
import { foldAccents } from "./fuzzy.ts";
import { haversine } from "./geo.ts";

/** A pin that records somewhere you have been. */
export function isVisitedPin(pin: Pick<Pin, "type" | "visited">): boolean {
  return pin.type === "visited" || pin.visited === true;
}

/**
 * A visited pin that stands for a whole country: one added with + as
 * "Japan", or saved from a country search. It shades its country and adds
 * no city dot — a dot in the middle of Japan labelled "Japan" is not a
 * city. Read from the category when there is one, and otherwise from a
 * "city" that is itself a country name ("Japan", "Japon"), which is how
 * countries added by hand were stored before they had a category.
 */
export function isCountryOnly(pin: Pick<Pin, "city" | "country" | "category" | "name">): boolean {
  if (foldAccents(pin.category ?? "") === "country") return true;
  const asCountry = countryCode(pin.city);
  if (!asCountry) return false;
  const country = countryCode(pin.country);
  return !country || country === asCountry;
}

/** The country a visited pin is in: its country field, or its name when it is one. */
export function pinCountry(pin: Pick<Pin, "city" | "country" | "category" | "name">): string {
  const given = pin.country?.trim();
  if (given) return given;
  return isCountryOnly(pin) ? pin.city?.trim() || pin.name?.trim() || "" : "";
}

export type VisitedCity = {
  key: string;
  /** The name used most often for it among your pins. */
  city: string;
  /** The country in one language (English), whatever the pins called it. */
  country: string;
  /** ISO 3166 code when the country name was recognised, else the folded name. */
  countryKey: string;
  lat: number;
  lon: number;
  /** Visited pins in this city: photos, saved places, the city itself. */
  places: number;
};

const norm = (value: string) => foldAccents(value).toLowerCase().replace(/\s+/g, " ").trim();

/** Pins this close are one city, whatever each one calls it: "Kyoto", "Kioto", "京都". */
const SAME_CITY_KM = 12;
/** Pins with the same city name are one city this far apart: a big city's two ends. */
const SAME_NAME_KM = 60;

/**
 * One entry per city you have been to, in the order first seen.
 *
 * Grouped by where the pins are, not only by what they are called: a city
 * saved as "Kyoto" from one app and "京都" from another is one city, and so
 * is "Montréal" and "Montreal". A visited pin with no city names a country
 * only: it shades the country and adds no dot, because a dot needs a town
 * to belong to.
 */
export function visitedCities(pins: readonly Pin[]): VisitedCity[] {
  type Acc = {
    names: Map<string, { name: string; count: number }>;
    countryName: string;
    countryKey: string;
    latSum: number;
    lonSum: number;
    places: number;
  };
  const found: Acc[] = [];
  const centre = (c: Acc) => ({ lat: c.latSum / c.places, lon: c.lonSum / c.places });
  for (const pin of pins) {
    if (!isVisitedPin(pin) || isCountryOnly(pin)) continue;
    const city = pin.city?.trim();
    if (!city || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lon)) continue;
    if (pin.lat === 0 && pin.lon === 0) continue; // a failed geocode, not a place
    const name = norm(city);
    const key = countryKey(pin.country);
    const here = { lat: pin.lat, lon: pin.lon };
    const match = found.find((c) => {
      const km = haversine(centre(c), here) / 1000;
      if (km <= SAME_CITY_KM) return true;
      const sameCountry = !key || !c.countryKey || c.countryKey === key;
      return km <= SAME_NAME_KM && sameCountry && c.names.has(name);
    });
    const acc: Acc = match ?? {
      names: new Map(),
      countryName: "",
      countryKey: "",
      latSum: 0,
      lonSum: 0,
      places: 0,
    };
    if (!match) found.push(acc);
    const seen = acc.names.get(name);
    if (seen) seen.count += 1;
    else acc.names.set(name, { name: city, count: 1 });
    if (!acc.countryKey && key) {
      acc.countryKey = key;
      acc.countryName = pin.country?.trim() ?? "";
    }
    acc.latSum += pin.lat;
    acc.lonSum += pin.lon;
    acc.places += 1;
  }
  const keys = new Set<string>();
  return found.map((acc) => {
    // Most used name first; the first one saved wins a tie.
    const best = [...acc.names.values()].reduce((a, b) => (b.count > a.count ? b : a));
    let key = `${acc.countryKey}|${norm(best.name)}`;
    for (let n = 2; keys.has(key); n++) key = `${acc.countryKey}|${norm(best.name)}#${n}`;
    keys.add(key);
    const { lat, lon } = centre(acc);
    return {
      key,
      city: best.name,
      country: countryDisplayName(acc.countryName) || acc.countryName,
      countryKey: acc.countryKey,
      lat,
      lon,
      places: acc.places,
    };
  });
}

/** The cities as globe pins: one visited dot each. */
export function cityPins(cities: readonly VisitedCity[]): Pin[] {
  return cities.map((city) => ({
    id: `city:${city.key}`,
    type: "visited" as const,
    name: city.city,
    city: city.city,
    country: city.country,
    lat: city.lat,
    lon: city.lon,
  }));
}

export type ProvinceProps = { name?: string; country?: string; kind?: string };
export type ProvinceFeature = Feature<Geometry, ProvinceProps>;

export type VisitedProvince = {
  id: string;
  name: string;
  country: string;
  /** "Province", "State", "Prefecture"… as the source names it. */
  kind: string;
  feature: ProvinceFeature;
  cityKeys: string[];
};

/**
 * The provinces (states, prefectures…) your cities fall in, worked out from
 * where each city is — no lookup, no service.
 *
 * The outlines are simplified to stay small, which shaves coastlines: New
 * York, Montreal and Miyajima all sit just outside theirs. So a city inside
 * no outline takes the nearest one within NEAREST_KM, measured to the
 * outline's edges. Further out than that it belongs to none, which only
 * means that province stays unshaded.
 */
/** How far outside a simplified coastline a city may sit and still count. */
const NEAREST_KM = 25;
const EARTH_KM = 6371;

function ringsOf(geometry: Geometry): number[][][] {
  if (geometry.type === "Polygon") return geometry.coordinates;
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flat();
  return [];
}

/**
 * Kilometres from a point to the nearest edge of some rings. Flat maths on
 * a local projection: exact enough within the 25 km it is asked about.
 */
function kmToRings(lat: number, lon: number, rings: number[][][]): number {
  const kmPerDeg = (Math.PI / 180) * EARTH_KM;
  const xScale = Math.cos((lat * Math.PI) / 180) * kmPerDeg;
  const toXY = (c: number[]): [number, number] => {
    // Across the antimeridian, measure the short way round.
    let dLon = c[0]! - lon;
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    return [dLon * xScale, (c[1]! - lat) * kmPerDeg];
  };
  let best = Infinity;
  for (const ring of rings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = toXY(ring[i]!);
      const [bx, by] = toXY(ring[i + 1]!);
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best;
}

export function visitedProvinces(
  cities: readonly VisitedCity[],
  provinces: readonly ProvinceFeature[],
): VisitedProvince[] {
  if (cities.length === 0 || provinces.length === 0) return [];
  // An outline wound the wrong way contains the whole planet except itself,
  // and would claim every city. Left out rather than trusted.
  const usable = provinces.filter((feature) => geoArea(feature) <= 2 * Math.PI);
  // A box test first: geoContains is exact but slow, and 4,600 provinces
  // times every city adds up on a phone.
  const boxes = usable.map((feature) => geoBounds(feature));
  const pad = (NEAREST_KM / EARTH_KM) * (180 / Math.PI);
  const inBox = (i: number, lat: number, lon: number, margin: number) => {
    const [[west, south], [east, north]] = boxes[i]!;
    if (lat < south - margin || lat > north + margin) return false;
    // A box that crosses the antimeridian has west > east.
    return west <= east
      ? lon >= west - margin && lon <= east + margin
      : lon >= west - margin || lon <= east + margin;
  };

  const found = new Map<string, VisitedProvince>();
  const add = (feature: ProvinceFeature, city: VisitedCity) => {
    const id = String(feature.id ?? `${feature.properties?.country}|${feature.properties?.name}`);
    const seen = found.get(id);
    if (seen) seen.cityKeys.push(city.key);
    else {
      found.set(id, {
        id,
        name: feature.properties?.name ?? "",
        country: feature.properties?.country ?? city.country,
        kind: feature.properties?.kind ?? "Province",
        feature,
        cityKeys: [city.key],
      });
    }
  };

  for (const city of cities) {
    const point: [number, number] = [city.lon, city.lat];
    let inside: ProvinceFeature | null = null;
    for (let i = 0; i < usable.length && !inside; i++) {
      if (inBox(i, city.lat, city.lon, 0) && geoContains(usable[i]!, point)) inside = usable[i]!;
    }
    if (inside) {
      add(inside, city);
      continue;
    }
    let nearest: { feature: ProvinceFeature; km: number } | null = null;
    for (let i = 0; i < usable.length; i++) {
      if (!inBox(i, city.lat, city.lon, pad)) continue;
      const km = kmToRings(city.lat, city.lon, ringsOf(usable[i]!.geometry));
      if (km <= NEAREST_KM && (!nearest || km < nearest.km)) nearest = { feature: usable[i]!, km };
    }
    if (nearest) add(nearest.feature, city);
  }
  return [...found.values()];
}

export type CountryVisits = {
  /** ISO 3166 code, or the folded name when the country was not recognised. */
  key: string;
  /** In one language, whatever the pins called it. */
  country: string;
  cities: VisitedCity[];
  provinces: VisitedProvince[];
};

/**
 * Where you have been, by country, for the list under the globe: countries
 * A–Z, each with its cities A–Z and the provinces they fall in. A country
 * is one country in any language ("Japon" and "日本" are Japan), and a city
 * saved with no country takes the one its province is in. Countries you
 * have been to without a city (a visited pin naming only the country) are
 * listed too.
 */
export function visitsByCountry(
  pins: readonly Pin[],
  cities: readonly VisitedCity[],
  provinces: readonly VisitedProvince[],
): CountryVisits[] {
  const byCountry = new Map<string, CountryVisits>();
  const entry = (name: string) => {
    const key = countryKey(name);
    let seen = byCountry.get(key);
    if (!seen) {
      seen = { key, country: countryDisplayName(name) || name, cities: [], provinces: [] };
      byCountry.set(key, seen);
    }
    return seen;
  };
  const provinceByCity = new Map<string, VisitedProvince>();
  for (const province of provinces) {
    for (const key of province.cityKeys) provinceByCity.set(key, province);
  }
  for (const pin of pins) {
    const country = isVisitedPin(pin) ? pinCountry(pin) : "";
    if (country) entry(country);
  }
  for (const city of cities) {
    const country = city.country || provinceByCity.get(city.key)?.country;
    if (country) entry(country).cities.push(city);
  }
  for (const visits of byCountry.values()) {
    const seen = new Set<string>();
    for (const city of visits.cities) {
      const province = provinceByCity.get(city.key);
      if (province && !seen.has(province.id)) {
        seen.add(province.id);
        visits.provinces.push(province);
      }
    }
    visits.cities.sort((a, b) => a.city.localeCompare(b.city));
    visits.provinces.sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...byCountry.values()].sort((a, b) => a.country.localeCompare(b.country));
}

/** The countries you have been to, as ISO codes where recognised: for the globe's shading. */
export function visitedCountryKeys(
  pins: readonly Pin[],
  provinces: readonly VisitedProvince[],
): Set<string> {
  const keys = new Set<string>();
  for (const pin of pins) {
    const country = isVisitedPin(pin) ? pinCountry(pin) : "";
    if (country) keys.add(countryKey(country));
  }
  // A city saved without a country still shades the one it is in.
  for (const province of provinces) keys.add(countryKey(province.country));
  return keys;
}

/** One line of public/geo/admin1/index.json. */
export type ProvinceFileEntry = {
  /** ISO 3166-1 alpha-3 (Natural Earth's adm0_a3): the file's name. */
  a3: string;
  country: string;
  /** [west, south, east, north]; west > east when it crosses the antimeridian. */
  bbox: [number, number, number, number];
};

/**
 * The country files worth fetching: those whose box holds one of your
 * cities, with a little room for a coast. By position rather than by the
 * country name on a pin, which is free text ("USA", "United States",
 * "États-Unis"). A box can catch a neighbour's city too; that only costs a
 * small extra file, never a wrong province.
 */
export function provinceFilesFor(
  index: readonly ProvinceFileEntry[],
  cities: readonly Pick<VisitedCity, "lat" | "lon">[],
  pad = 0.3,
): string[] {
  return index
    .filter(({ bbox: [west, south, east, north] }) =>
      cities.some(({ lat, lon }) => {
        if (lat < south - pad || lat > north + pad) return false;
        return west <= east
          ? lon >= west - pad && lon <= east + pad
          : lon >= west - pad || lon <= east + pad;
      }),
    )
    .map((entry) => entry.a3);
}

export type CountryMark = { key: string; name: string; lat: number; lon: number };

/**
 * Where to name a country on the globe: every country you have been to that
 * has no city dot of its own — one added by hand as "Iceland", say. Its
 * shading alone was too quiet to find, especially a small country, so it
 * gets a marker and its name at the point it was saved with.
 */
export function countryMarks(
  pins: readonly Pin[],
  visits: readonly CountryVisits[],
): CountryMark[] {
  const marks: CountryMark[] = [];
  for (const visit of visits) {
    if (visit.cities.length > 0) continue;
    const pin = pins.find(
      (p) =>
        isVisitedPin(p) &&
        countryKey(pinCountry(p)) === visit.key &&
        Number.isFinite(p.lat) &&
        Number.isFinite(p.lon) &&
        !(p.lat === 0 && p.lon === 0),
    );
    if (pin) marks.push({ key: visit.key, name: visit.country, lat: pin.lat, lon: pin.lon });
  }
  return marks;
}
