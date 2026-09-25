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
