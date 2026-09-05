export type Place = { city: string; country: string };

const cache = new Map<string, Place | null>();

/** Turn coordinates into a city + country name using a free, key-less service. */
export async function reverseGeocode(lat: number, lon: number): Promise<Place | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
    );
    if (!res.ok) throw new Error("lookup failed");
    const data = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const city = data.city || data.locality || data.principalSubdivision || "";
    const country = data.countryName || "";
    const place = city || country ? { city, country } : null;
    cache.set(key, place);
    return place;
  } catch {
    cache.set(key, null);
    return null;
  }
}
