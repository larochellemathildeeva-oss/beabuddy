/**
 * What a trip card says about itself before you open it.
 *
 * The list used to print two ISO dates — "2026-09-17 – 2026-09-28" — which is
 * the database's idea of a trip, not a traveller's. A traveller wants to know
 * where, how long, and how soon.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse a stored YYYY-MM-DD as a local date, never as UTC midnight. */
function localDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  return Number.isNaN(date.getTime()) ? null : date;
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * "Sep 17 – 28", "Sep 28 – Oct 3", "Sep 17 – Oct 3, 2027" once the year stops
 * being obvious. The month is only repeated when it changes, because "Sep 17 –
 * Sep 28" makes you read the word twice to learn nothing.
 */
export function tripDateLine(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): string {
  const from = start ? localDate(start) : null;
  const to = end ? localDate(end) : null;
  if (!from && !to) return "Dates not set";
  if (!from) return `Until ${short(to!)}${yearSuffix(to!, now)}`;
  if (!to) return `From ${short(from)}${yearSuffix(from, now)}`;

  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  const tail = sameMonth ? String(to.getDate()) : short(to);
  return `${short(from)} – ${tail}${yearSuffix(to, now)}`;
}

const short = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

/** The year is noise until the trip is not in the current one. */
function yearSuffix(d: Date, now: Date): string {
  return d.getFullYear() === now.getFullYear() ? "" : `, ${d.getFullYear()}`;
}

/** Inclusive night-and-day count, the way people say "11 days". */
export function tripLengthLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = start ? localDate(start) : null;
  const to = end ? localDate(end) : null;
  if (!from || !to) return "";
  const days = Math.round((dayStart(to).getTime() - dayStart(from).getTime()) / 86_400_000) + 1;
  if (days < 1) return "";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * How soon, in the words people actually use.
 *
 * Returns "" when there is nothing worth saying — no start date, or a trip so
 * far off that a countdown is noise rather than anticipation.
 */
export function countdownLabel(start: string | null | undefined, now = new Date()): string {
  const from = start ? localDate(start) : null;
  if (!from) return "";
  const days = Math.round((dayStart(from).getTime() - dayStart(now).getTime()) / 86_400_000);
  if (days < 0) return "";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return `in ${days} days`;
  if (days < 14) return "next week";
  if (days < 60) return `in ${Math.round(days / 7)} weeks`;
  if (days < 365) return `in ${Math.round(days / 30)} months`;
  return "";
}

/** True while the trip is happening, so the card can say so instead of counting. */
export function isUnderway(
  start: string | null | undefined,
  end: string | null | undefined,
  now = new Date(),
): boolean {
  const from = start ? localDate(start) : null;
  if (!from) return false;
  const to = end ? localDate(end) : from;
  const today = dayStart(now).getTime();
  return today >= dayStart(from).getTime() && today <= dayStart(to!).getTime();
}

/** "Kyoto & Sapporo", "Kyoto and 3 more" — where, without a wall of commas. */
export function tripPlacesLine(cities: string[], fallback = ""): string {
  const names = [...new Set(cities.map((c) => c.trim()).filter(Boolean))];
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} and ${names.length - 1} more`;
}

/** One letter for a trip with no photo behind it yet. */
export function tripMonogram(title: string, city?: string | null): string {
  const source = (title.trim() || city?.trim() || "").replace(/^[^\p{L}\p{N}]+/u, "");
  return (source[0] ?? "B").toUpperCase();
}

/**
 * A calm tint for a trip with no photo.
 *
 * Deliberately low-chroma: this sits behind a title, and the saturated version
 * read as a colour swatch demanding attention rather than a quiet placeholder
 * waiting for a real photograph. Hue rotates by name so two trips side by side
 * are not identical, but every value stays in the same gentle band.
 */
export function fallbackTint(seed: string): { from: string; to: string } {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  const hue = 25 + (hash % 60); // sand through clay, never green or blue
  return {
    from: `oklch(0.88 0.035 ${hue})`,
    to: `oklch(0.79 0.045 ${(hue + 18) % 360})`,
  };
}

type PhotoLike = {
  id: string;
  storage_path: string;
  city: string | null;
  country: string | null;
  taken_at: string | null;
};

/**
 * Pick the photo that should sit behind a trip.
 *
 * A trip to somewhere you have been shows your own most recent shot of it —
 * which is the whole argument for the photo library, made visible on the
 * screen people open most. Rows marked `location-only:` carry coordinates but
 * no image, so they can never be the banner.
 */
export function pickTripPhoto(
  photos: PhotoLike[],
  trip: { city?: string | null; country?: string | null; cities?: string[] },
): PhotoLike | null {
  const usable = photos.filter((p) => !p.storage_path.startsWith("location-only:"));
  if (usable.length === 0) return null;

  const wanted = [trip.city ?? "", ...(trip.cities ?? [])]
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  const country = (trip.country ?? "").trim().toLowerCase();

  const newestFirst = (a: PhotoLike, b: PhotoLike) =>
    (b.taken_at ?? "").localeCompare(a.taken_at ?? "");

  const byCity = usable
    .filter((p) => wanted.includes((p.city ?? "").trim().toLowerCase()))
    .sort(newestFirst);
  if (byCity[0]) return byCity[0];

  if (country) {
    const byCountry = usable
      .filter((p) => (p.country ?? "").trim().toLowerCase() === country)
      .sort(newestFirst);
    if (byCountry[0]) return byCountry[0];
  }
  return null;
}

/** Credit line under a banner: "Your photo · Lisbon, 2024". */
export function photoCreditLine(photo: { city: string | null; taken_at: string | null }): string {
  const where = photo.city?.trim();
  const year = photo.taken_at ? new Date(photo.taken_at).getFullYear() : null;
  const parts = [where, year && !Number.isNaN(year) ? String(year) : ""].filter(Boolean);
  return parts.length ? `Your photo · ${parts.join(", ")}` : "Your photo";
}
