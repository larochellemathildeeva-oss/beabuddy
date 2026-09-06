import { foldAccents } from "./fuzzy.ts";

export const DAY_TRIP_PACES = [
  { id: "relaxed", label: "Slow", hint: "One or two things, lots of air." },
  { id: "balanced", label: "Balanced", hint: "A highlight plus room to breathe." },
  { id: "full", label: "Full", hint: "Pack the day, rest at home." },
] as const;

export type DayTripPace = (typeof DAY_TRIP_PACES)[number]["id"];

export type DayTripPlace = {
  id: string;
  name: string;
  city?: string;
  country?: string;
  category?: string;
  notes?: string;
  tags?: string[];
  lat: number;
  lon: number;
};

export function dayTripCity(places: { city?: string | null }[]): string {
  const counts = new Map<string, number>();
  for (const place of places) {
    const city = place.city?.trim();
    if (!city) continue;
    counts.set(city, (counts.get(city) ?? 0) + 1);
  }
  let best = "";
  let n = 0;
  for (const [city, count] of counts) {
    if (count > n) {
      best = city;
      n = count;
    }
  }
  return best;
}

export function matchDayTripPlace<T extends { name: string }>(title: string, places: T[]): T | undefined {
  const needle = foldAccents(title);
  if (!needle) return undefined;
  return (
    places.find((place) => foldAccents(place.name) === needle) ??
    places.find((place) => {
      const name = foldAccents(place.name);
      return name.length >= 3 && (needle.includes(name) || name.includes(needle));
    })
  );
}

export function dayTripTitle(city: string, date: string): string {
  return city.trim() ? `Day trip — ${city.trim()}` : `Day trip — ${date}`;
}
