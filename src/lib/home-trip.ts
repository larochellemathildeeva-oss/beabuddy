/**
 * What Home's "Your next trip" card pulls out of a trip's stops and packing:
 * the flight out, where you are staying, how packed you are, and what to call
 * the trips after it. Pure, so each rule is tested on its own.
 */

export type HighlightRow = {
  kind: string;
  title: string;
  detail: string | null;
  time_label: string | null;
  day_date: string | null;
};

/** A flight number, "AC 781" or "JL123", or a word that says flight. */
const FLIGHTY = /\b(?:flight|fly|flying|plane)\b|\b[A-Z]{2}\s?\d{2,4}\b|✈/i;

/**
 * The first flight and the first place to sleep, in trip order.
 *
 * A flight is a "flight" row, or a transport row that names one ("AC 781 to
 * LAX"). A stay is a "hotel" or "lodging" row. Nothing is guessed from other
 * kinds, because a tile that says "Lodging: Lunch at Kakiya" is worse than no
 * tile.
 */
export function tripHighlights<T extends HighlightRow>(
  rows: readonly T[],
): {
  flight: T | null;
  lodging: T | null;
} {
  const flight =
    rows.find((r) => r.kind === "flight") ??
    rows.find((r) => r.kind === "transport" && FLIGHTY.test(r.title)) ??
    null;
  const lodging = rows.find((r) => r.kind === "hotel" || r.kind === "lodging") ?? null;
  return { flight, lodging };
}

const isFlight = (r: HighlightRow) =>
  r.kind === "flight" || (r.kind === "transport" && FLIGHTY.test(r.title));
const isStay = (r: HighlightRow) => r.kind === "hotel" || r.kind === "lodging";

/**
 * The flight and the stay worth showing today, one of each, for a trip with
 * several.
 *
 * Flight: the next one not yet behind you — today's stays up all day. Before
 * the trip that is the flight out; once the last has gone, there is none.
 *
 * Stay: the one you are sleeping in. Before the trip, or before the first
 * check-in, that is the first; it moves to the next hotel only on that
 * hotel's own day. Rows without a date keep plan order: with no dates at all
 * both answers are simply the first.
 */
export function currentHighlights<T extends HighlightRow>(
  rows: readonly T[],
  today: string,
): { flight: T | null; lodging: T | null } {
  const flights = rows.filter(isFlight);
  const dated = flights.filter((r) => r.day_date);
  const flight =
    dated.length > 0 ? (dated.find((r) => r.day_date! >= today) ?? null) : (flights[0] ?? null);

  const stays = rows.filter(isStay);
  let lodging: T | null = stays[0] ?? null;
  for (const stay of stays) {
    if (stay.day_date && stay.day_date <= today) lodging = stay;
  }
  return { flight, lodging };
}

type LegStop = { city: string; arrive_on: string | null; depart_on: string | null };

/**
 * For a trip through several cities: the city that matters today, and the
 * flight and stay that belong to it.
 *
 * Before you arrive anywhere that is the first city ("First stop"); from a
 * city's arrival day it is that city ("Now in"), and it moves on only when
 * the next city's arrival day comes. The flight is the next one still ahead
 * before you leave the city — the flight in, until you have landed; then the
 * one out. The stay is the one checked into while you are there.
 *
 * Null for a one-city trip, or when no city has an arrival date, since then
 * there is no telling which city is "now" — the card falls back to
 * `currentHighlights`.
 */
export function currentLeg<T extends HighlightRow>(
  stops: readonly LegStop[],
  rows: readonly T[],
  today: string,
): { city: string; label: "First stop" | "Now in"; flight: T | null; lodging: T | null } | null {
  const name = (c: string) => (c.split(",")[0] ?? "").trim();
  const distinct = new Set(stops.map((s) => name(s.city).toLowerCase()).filter(Boolean));
  if (distinct.size < 2 || !stops.some((s) => s.arrive_on)) return null;

  let index = 0;
  stops.forEach((s, i) => {
    if (s.arrive_on && s.arrive_on <= today) index = i;
  });
  const leg = stops[index]!;
  const arrived = Boolean(leg.arrive_on && leg.arrive_on <= today);
  const until = leg.depart_on || stops[index + 1]?.arrive_on || null;

  const flight =
    rows.find(
      (r) => isFlight(r) && r.day_date && r.day_date >= today && (!until || r.day_date <= until),
    ) ?? null;

  const stays = rows.filter(isStay);
  const lodging = stays.some((r) => r.day_date)
    ? (stays.find(
        (r) =>
          r.day_date &&
          (!leg.arrive_on || r.day_date >= leg.arrive_on) &&
          (!until || r.day_date < until),
      ) ?? null)
    : (stays[0] ?? null);

  return { city: name(leg.city), label: arrived ? "Now in" : "First stop", flight, lodging };
}

/** "6 / 12 items" and the share packed, or null with nothing to pack yet. */
export function packingReadiness(items: readonly { packed: boolean }[]): {
  packed: number;
  total: number;
  ratio: number;
} | null {
  if (items.length === 0) return null;
  const packed = items.filter((i) => i.packed).length;
  return { packed, total: items.length, ratio: packed / items.length };
}

const SEASONS = ["winter", "spring", "summer", "autumn"] as const;

function seasonOf(date: Date): { season: (typeof SEASONS)[number]; year: number } {
  const m = date.getMonth(); // 0 = January
  const index = m === 11 || m <= 1 ? 0 : m <= 4 ? 1 : m <= 7 ? 2 : 3;
  // December belongs to the winter that runs into the next year.
  return { season: SEASONS[index]!, year: m === 11 ? date.getFullYear() + 1 : date.getFullYear() };
}

/**
 * The heading over the trips after the next one: "Later this autumn" when
 * they all start this season, "Later this year" within the year, "Coming up"
 * otherwise. Northern-hemisphere seasons, which is where "autumn" in
 * September makes sense; the fallbacks keep it true everywhere else.
 */
export function laterHeading(starts: readonly (string | null)[], now = new Date()): string {
  const dates = starts.filter((s): s is string => Boolean(s)).map((s) => new Date(`${s}T00:00:00`));
  if (dates.length === 0 || dates.length < starts.length) return "Coming up";
  const here = seasonOf(now);
  if (
    dates.every((d) => {
      const s = seasonOf(d);
      return s.season === here.season && s.year === here.year;
    })
  )
    return `Later this ${here.season}`;
  if (dates.every((d) => d.getFullYear() === now.getFullYear())) return "Later this year";
  return "Coming up";
}

type DatedTrip = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  status?: string | null;
};

const byStart = (a: DatedTrip, b: DatedTrip) =>
  (a.start_date ?? "").localeCompare(b.start_date ?? "");

/** The last day of a trip: its end, else its start. */
const lastDay = (t: DatedTrip) => t.end_date || t.start_date || "";

/** A trip whose last day is behind you, whatever its status still says. */
export function isPastTrip(t: DatedTrip, today: string): boolean {
  const last = lastDay(t);
  return Boolean(last) && last < today;
}

/**
 * The trip happening now, otherwise the soonest one still to come. A trip
 * that has ended is never it, even one still marked in progress: it belongs
 * with the past trips at the bottom of Home.
 */
export function pickActiveTrip<T extends DatedTrip>(trips: readonly T[], today: string): T | null {
  const current = trips
    .filter((t) => t.start_date && t.start_date <= today && (!t.end_date || t.end_date >= today))
    .sort(byStart)[0];
  if (current) return current;
  const upcoming = trips.filter((t) => t.start_date && t.start_date > today).sort(byStart)[0];
  if (upcoming) return upcoming;
  return (
    trips.find(
      (t) => (t.status === "in_progress" || t.status === "upcoming") && !isPastTrip(t, today),
    ) ?? null
  );
}

/**
 * Trips that ended in the last year, most recent first, for the foot of
 * Home. Older ones stay on the Trips tab.
 */
export function pastTrips<T extends DatedTrip>(trips: readonly T[], today: string, limit = 4): T[] {
  const [y, m, d] = today.split("-");
  const yearAgo = `${Number(y) - 1}-${m}-${d}`;
  return trips
    .filter((t) => isPastTrip(t, today) && lastDay(t) >= yearAgo)
    .sort((a, b) => lastDay(b).localeCompare(lastDay(a)))
    .slice(0, limit);
}

/** Up to three trips after the active one, soonest first. */
export function laterTrips<T extends DatedTrip>(
  trips: readonly T[],
  active: T | null,
  today: string,
): T[] {
  return trips
    .filter((t) => t.id !== active?.id && t.start_date && t.start_date > today)
    .sort(byStart)
    .slice(0, 3);
}

/** Everyone on a trip, you included. */
export function peopleOnTrip(
  members: readonly { trip_id: string; user_id: string }[],
  tripId: string,
  uid: string | null,
): number {
  return members.filter((m) => m.trip_id === tripId && m.user_id !== uid).length + 1;
}
