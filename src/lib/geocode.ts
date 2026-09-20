import { lookupCoords } from "@/lib/places.functions";

export type Place = { city: string; country: string };

/**
 * Rounded to about a hundred metres, which is the point.
 *
 * Importing photographs reverse-geocodes each one, and photographs from a
 * trip cluster: a morning in one square of a city is one lookup, not forty.
 */
const cache = new Map<string, Place | null>();

/**
 * Turn coordinates into a city and a country.
 *
 * This used to call BigDataCloud straight from the browser — a company the
 * app never names, receiving the exact position stamped into someone's
 * photographs, with no account and no way to know it had happened. It also
 * meant three different services doing the geocoding between them.
 *
 * It now asks Béa's own server, which asks the same provider as everything
 * else. The coordinates still leave the device, because that is what
 * answering the question requires, but they leave it to Béa.
 */
export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const found = await lookupCoords({ data: { lat, lon } });
    const city = found.city ?? "";
    const country = found.country ?? "";
    const place = city || country ? { city, country } : null;
    cache.set(key, place);
    return place;
  } catch {
    // A photograph without a city is still a photograph. This was never
    // allowed to fail an import and still is not.
    cache.set(key, null);
    return null;
  }
}
