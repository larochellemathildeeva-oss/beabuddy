/**
 * Past You, on a trip to somewhere you have been.
 *
 * Future Me notes, photos and saved places already exist, but they waited on
 * the Memories page for you to go looking. A new trip to the same town is
 * exactly when "Stay in Shimokitazawa one night next time" is worth reading,
 * so the trip shows it. Matched on the town's name (and on the country for a
 * trip that names only a country), nothing more: no location is read.
 *
 * Pure, so the matching is tested.
 */

export type PastNote = {
  id: string;
  city: string;
  country: string | null;
  note: string;
  created_at: string;
};
export type PastPhoto = {
  id: string;
  storage_path: string;
  city: string | null;
  country: string | null;
  taken_at: string | null;
};
export type PastTrip = {
  id: string;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
};
export type PastRec = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  visited?: boolean | null;
};

export type PastYou = {
  /** The town it matched on, for the heading. */
  place: string;
  notes: PastNote[];
  photos: PastPhoto[];
  /** Earlier trips there, most recent first. */
  visits: { id: string; title: string; year: number | null }[];
  /** Saved places in the town not yet visited. */
  recs: PastRec[];
};

/** "Lisbon, Portugal" → "lisbon"; accents and case do not matter. */
export function placeKey(value: string | null | undefined): string {
  return (value ?? "").split(",")[0]!.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

const PHOTOS_SHOWN = 6;
const RECS_SHOWN = 5;

/**
 * What Past You left for this trip's places, or null when there is nothing.
 * `places` are the trip's own town and its destinations; a trip with no town
 * matches on its country.
 */
export function pastYouFor(
  trip: PastTrip,
  places: readonly { city: string | null; country: string | null }[],
  data: {
    notes: readonly PastNote[];
    photos: readonly PastPhoto[];
    trips: readonly PastTrip[];
    recs: readonly PastRec[];
  },
): PastYou | null {
  const towns = new Map<string, string>();
  for (const p of [{ city: trip.city, country: trip.country }, ...places]) {
    const key = placeKey(p.city);
    if (key && !towns.has(key)) towns.set(key, (p.city ?? "").split(",")[0]!.trim());
  }
  const country = placeKey(trip.country);
  const matches = (city: string | null | undefined, ctry: string | null | undefined) =>
    towns.size ? towns.has(placeKey(city)) : Boolean(country) && placeKey(ctry) === country;

  const before = trip.start_date ?? "9999";
  const notes = data.notes.filter((n) => matches(n.city, n.country));
  const photos = data.photos
    .filter((p) => matches(p.city, p.country) && !p.storage_path.startsWith("location-only:"))
    .filter((p) => !p.taken_at || p.taken_at.slice(0, 10) < before)
    .sort((a, b) => (b.taken_at ?? "").localeCompare(a.taken_at ?? ""))
    .slice(0, PHOTOS_SHOWN);
  const visits = data.trips
    .filter(
      (t) =>
        t.id !== trip.id &&
        matches(t.city, t.country) &&
        (t.end_date ?? t.start_date ?? "9999") < before,
    )
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))
    .map((t) => ({
      id: t.id,
      title: t.title,
      year: t.start_date ? Number(t.start_date.slice(0, 4)) : null,
    }));
  const recs = data.recs
    .filter((r) => !r.visited && matches(r.city, r.country))
    .slice(0, RECS_SHOWN);

  if (!notes.length && !photos.length && !visits.length && !recs.length) return null;
  const place = towns.values().next().value || (trip.country ?? "");
  return { place, notes, photos, visits, recs };
}

/** "You were here in 2024." / "You've been here twice, last in 2025." */
export function visitLine(visits: PastYou["visits"], photos: readonly PastPhoto[]): string | null {
  const years = [
    ...visits.map((v) => v.year),
    ...photos.map((p) => (p.taken_at ? Number(p.taken_at.slice(0, 4)) : null)),
  ].filter((y): y is number => y != null && Number.isFinite(y));
  if (!years.length) return null;
  const last = Math.max(...years);
  if (visits.length >= 2)
    return `You've been here ${visits.length === 2 ? "twice" : `${visits.length} times`}, last in ${last}.`;
  return `You were here in ${last}.`;
}
