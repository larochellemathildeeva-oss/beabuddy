/**
 * How the banner at the top of a trip looks. A device preference, like the
 * views bar position:
 *
 * - `mine`: the photos the traveller took on the trip, one after another;
 *   a trip with none shows stock photos.
 * - `stock`: a photo of the place (Pexels, then Wikimedia Commons).
 * - `illustration`: Béa's painted picture of the place.
 * - `compact`: no photo block at all, a small picture beside the words.
 */
export const TRIP_BANNERS = ["mine", "stock", "illustration", "compact"] as const;
export type TripBanner = (typeof TRIP_BANNERS)[number];

export const TRIP_BANNER_KEY = "bea-trip-banner";

/** Own photos by default; anything unknown reads as the default. */
export function asTripBanner(raw: unknown): TripBanner {
  return TRIP_BANNERS.includes(raw as TripBanner) ? (raw as TripBanner) : "mine";
}

export type BannerPhoto = { id: string; storage_path: string; taken_at: string | null };

/** Longest run of own photos shown in turn: more would never be reached. */
export const BANNER_PHOTOS_MAX = 8;

/**
 * The traveller's own photos for a trip's banner, newest first: the ones added
 * to the trip itself, then ones placed in its cities or country. Rows marked
 * `location-only:` have no image; a photo is listed once.
 */
export function bannerPhotos(
  onTrip: readonly BannerPhoto[],
  placed: readonly (BannerPhoto & { city: string | null; country: string | null })[],
  trip: { city?: string | null; country?: string | null; cities?: string[] },
): BannerPhoto[] {
  const wanted = [trip.city ?? "", ...(trip.cities ?? [])]
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const country = (trip.country ?? "").trim().toLowerCase();
  const newestFirst = (a: BannerPhoto, b: BannerPhoto) =>
    (b.taken_at ?? "").localeCompare(a.taken_at ?? "");
  const nearby = placed.filter(
    (p) =>
      wanted.includes((p.city ?? "").trim().toLowerCase()) ||
      (country !== "" && (p.country ?? "").trim().toLowerCase() === country),
  );
  const seen = new Set<string>();
  const out: BannerPhoto[] = [];
  for (const p of [...[...onTrip].sort(newestFirst), ...[...nearby].sort(newestFirst)]) {
    if (p.storage_path.startsWith("location-only:") || seen.has(p.id)) continue;
    seen.add(p.id);
    out.push({ id: p.id, storage_path: p.storage_path, taken_at: p.taken_at });
    if (out.length === BANNER_PHOTOS_MAX) break;
  }
  return out;
}

/** The photo after `index`, wrapping round; 0 when there is nothing to turn to. */
export function nextBannerIndex(index: number, count: number): number {
  return count > 1 ? (index + 1) % count : 0;
}
