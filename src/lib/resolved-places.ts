import { canonicalSpelling } from "./fuzzy.ts";
import { distanceKm } from "./geocode-plan.ts";

/**
 * Places Béa has already worked out, remembered for every traveller after.
 *
 * Two kinds of row, both in `resolved_places` (the migration of that name):
 * a *match* — the import found the stop by its name and trusted the pin —
 * and a traveller's *pick* — someone chose the place for a stop with
 * "Change place". A name is remembered, never who asked: the server keeps a
 * hash of each (resolved-places.server.ts).
 *
 * A remembered place stands in for a lookup only when it is unambiguous:
 * one matched spot near the town, or the same spot picked by two different
 * travellers (which also wins over a match — two people who were there
 * beat the map). A name matched at several spots in one town is a chain,
 * and the lookup decides as before.
 */

/** How far from the middle of town a remembered place may be. */
export const RESOLVE_KM = 25;
/** Two pins this close are the same place. */
export const SAME_SPOT_KM = 0.15;
/** Different travellers who must pick the same spot before it is used. */
export const PICKS_NEEDED = 2;

export type ResolvedRow = {
  lat: number;
  lon: number;
  label: string;
  alsoNamed?: string[] | null;
  source: "match" | "traveller";
  /** A traveller pick's voter (a hash); matches have none. */
  voter?: string | null;
};

export type Resolved = {
  lat: number;
  lon: number;
  label: string;
  alsoNamed: string[];
  source: "match" | "traveller";
};

/**
 * The name a stop is remembered by: spelling folded ("Café" and "Cafe",
 * "Kōdai-ji" and "Kodai-ji"), punctuation and spaces dropped. Nothing when
 * too little is left to tell places apart.
 */
export function placeNameKey(name: string | null | undefined): string | null {
  const key = canonicalSpelling((name ?? "").toLowerCase()).replace(/[^\p{L}\p{N}]+/gu, "");
  return key.length >= 3 ? key : null;
}

/** Points within SAME_SPOT_KM of each other, as groups. */
function spots<T extends { lat: number; lon: number }>(rows: readonly T[]): T[][] {
  const groups: T[][] = [];
  for (const row of rows) {
    const home = groups.find((group) => distanceKm(group[0]!, row) <= SAME_SPOT_KM);
    if (home) home.push(row);
    else groups.push([row]);
  }
  return groups;
}

/** The remembered place for a stop in the town around `centre`, or nothing. */
export function chooseResolved(
  rows: readonly ResolvedRow[],
  centre: { lat: number; lon: number },
): Resolved | null {
  const near = rows.filter((row) => distanceKm(row, centre) <= RESOLVE_KM);
  const picks = spots(near.filter((row) => row.source === "traveller" && row.voter));
  const agreed = picks
    .map((group) => ({ group, voters: new Set(group.map((row) => row.voter)).size }))
    .filter(({ voters }) => voters >= PICKS_NEEDED)
    .sort((a, b) => b.voters - a.voters);
  // Two spots each picked by enough travellers: they disagree, so neither.
  if (agreed.length === 1 || (agreed.length > 1 && agreed[0]!.voters > agreed[1]!.voters)) {
    const group = agreed[0]!.group;
    const last = group[group.length - 1]!;
    return {
      lat: group.reduce((sum, row) => sum + row.lat, 0) / group.length,
      lon: group.reduce((sum, row) => sum + row.lon, 0) / group.length,
      label: last.label,
      alsoNamed: last.alsoNamed ?? [],
      source: "traveller",
    };
  }
  const matched = spots(near.filter((row) => row.source === "match"));
  if (matched.length !== 1) return null;
  const row = matched[0]![0]!;
  return {
    lat: row.lat,
    lon: row.lon,
    label: row.label,
    alsoNamed: row.alsoNamed ?? [],
    source: "match",
  };
}
