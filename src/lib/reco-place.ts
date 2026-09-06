import { foldAccents } from "./fuzzy.ts";

/**
 * Nominatim locality kinds, plus the "City" tag AddVisitedCity writes.
 * These rows are places you filter by — not venue recommendations.
 */
const CITY_CATEGORIES = new Set([
  "city",
  "town",
  "village",
  "hamlet",
  "municipality",
  "suburb",
  "neighbourhood",
  "neighborhood",
  "quarter",
  "isolated dwelling",
  "island",
]);

const GENERIC_CATEGORIES = new Set(["", "place", "places"]);

export type RecoPlaceFields = {
  name: string;
  city?: string | null;
  country?: string | null;
  category?: string | null;
};

export function placeChipLabel(city: string): string {
  return city.trim().split(",")[0]?.trim() ?? city.trim();
}

/** True when the saved row is a country pin, not a city or a venue. */
export function isCountryLevelPlace(place: RecoPlaceFields): boolean {
  const category = foldAccents(place.category ?? "").replace(/_/g, " ");
  if (category === "country") return true;
  const name = foldAccents(place.name);
  const country = foldAccents(place.country ?? "");
  const city = foldAccents(place.city ?? "");
  return Boolean(name && country && name === country && (!city || city === country) && GENERIC_CATEGORIES.has(category));
}

/** True when the saved row *is* a city/town, not a restaurant, hotel, etc. */
export function isCityLevelPlace(place: RecoPlaceFields): boolean {
  if (isCountryLevelPlace(place)) return false;
  const category = foldAccents(place.category ?? "").replace(/_/g, " ");
  if (CITY_CATEGORIES.has(category)) return true;

  const name = foldAccents(place.name);
  const city = foldAccents(place.city ?? "");
  if (!name || !city || !GENERIC_CATEGORIES.has(category)) return false;

  const cityHead = city.split(",")[0]?.trim() ?? "";
  return name === city || name === cityHead;
}

/** Unique city/place chips from saved recs' city fields — not from city-as-pin rows. */
export function uniqueRecCities(places: readonly RecoPlaceFields[]): string[] {
  const items: { head: string; country: string }[] = [];
  const seen = new Set<string>();

  for (const place of places) {
    if (isCountryLevelPlace(place)) continue;
    const raw = place.city?.trim() || (isCityLevelPlace(place) ? place.name.trim() : "");
    if (!raw) continue;
    const head = placeChipLabel(raw);
    const country = (place.country ?? "").trim();
    const key = `${foldAccents(head)}|${foldAccents(country)}`;
    if (!head || seen.has(key)) continue;
    seen.add(key);
    items.push({ head, country });
  }

  const headCounts = new Map<string, number>();
  for (const item of items) {
    const key = foldAccents(item.head);
    headCounts.set(key, (headCounts.get(key) ?? 0) + 1);
  }

  return items
    .map((item) =>
      (headCounts.get(foldAccents(item.head)) ?? 0) > 1 && item.country
        ? `${item.head}, ${item.country}`
        : item.head,
    )
    .sort((a, b) => a.localeCompare(b));
}

export function recMatchesPlace(place: RecoPlaceFields, filter: string): boolean {
  if (!filter || filter === "All places") return true;
  const needle = foldAccents(filter);
  const raw = place.city?.trim() || (isCityLevelPlace(place) ? place.name.trim() : "");
  const head = foldAccents(placeChipLabel(raw));
  const country = foldAccents(place.country ?? "");
  const withCountry = [head, country].filter(Boolean).join(", ");
  return needle === head || needle === withCountry;
}
