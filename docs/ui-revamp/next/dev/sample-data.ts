/**
 * PREVIEW ONLY — sample places for the standalone pages, shaped like the
 * app's real data (Pin from src/data/atlas.ts). The app passes the
 * traveller's own pins, provinces and computed stats instead; nothing in
 * src/ ships fabricated content (VISUAL_NORTH_STAR → "Real content first").
 */
import type { Pin } from "@/data/atlas";
import type { WorldPlace, WorldStat } from "@/components/world/WorldScreen";
import paris from "./assets/thumb-paris.webp";
import tokyo from "./assets/thumb-tokyo.webp";
import kyoto from "./assets/thumb-kyoto.webp";

const city = (id: string, city: string, country: string, lat: number, lon: number): Pin => ({
  id,
  type: "visited",
  name: city,
  city,
  country,
  lat,
  lon,
});

/** Same cities as mockup.html's World board. */
export const SAMPLE_PINS: Pin[] = [
  city("montreal", "Montréal", "Canada", 45.5, -73.57),
  city("paris", "Paris", "France", 48.86, 2.35),
  city("palermo", "Palermo", "Italy", 38.12, 13.36),
  city("tokyo", "Tokyo", "Japan", 35.68, 139.69),
  city("quebec", "Québec City", "Canada", 46.81, -71.21),
  city("lyon", "Lyon", "France", 45.76, 4.84),
  city("rome", "Rome", "Italy", 41.9, 12.5),
  city("kyoto", "Kyoto", "Japan", 35.01, 135.77),
  city("lisbon", "Lisbon", "Portugal", 38.72, -9.14),
  city("reykjavik", "Reykjavík", "Iceland", 64.15, -21.94),
];

export const SAMPLE_COUNTRY_MARKS = [
  { key: "CA", name: "Canada", lat: 56, lon: -96 },
  { key: "FR", name: "France", lat: 46.6, lon: 2.4 },
  { key: "IT", name: "Italy", lat: 42.8, lon: 12.6 },
  { key: "JP", name: "Japan", lat: 36.5, lon: 138.5 },
  { key: "PT", name: "Portugal", lat: 39.6, lon: -8.0 },
  { key: "IS", name: "Iceland", lat: 64.9, lon: -18.6 },
];

export const SAMPLE_PLACES: Record<string, WorldPlace> = {
  paris: {
    id: "paris",
    name: "Paris",
    country: "France",
    countryCode: "FR",
    visits: 3,
    lastVisit: "Apr 2024",
    imageSrc: paris,
    imageAlt: "Paris rooftops",
  },
  tokyo: {
    id: "tokyo",
    name: "Tokyo",
    country: "Japan",
    countryCode: "JP",
    visits: 4,
    lastVisit: "Nov 2024",
    imageSrc: tokyo,
    imageAlt: "Tokyo at dusk",
  },
  kyoto: {
    id: "kyoto",
    name: "Kyoto",
    country: "Japan",
    countryCode: "JP",
    visits: 2,
    lastVisit: "Mar 2024",
    imageSrc: kyoto,
    imageAlt: "A pagoda in Kyoto",
  },
};

export function samplePlace(pin: Pin): WorldPlace {
  return SAMPLE_PLACES[pin.id] ?? { id: pin.id, name: pin.city, country: pin.country, visits: 1 };
}

/** As the board's strip: countries, cities, been there, saved. */
export const SAMPLE_STATS: WorldStat[] = [
  { key: "countries", label: "Countries", value: 6 },
  { key: "cities", label: "Cities", value: 10 },
  { key: "trips", label: "Trips completed", value: 4 },
  { key: "pins", label: "Pins", value: 18 },
];
