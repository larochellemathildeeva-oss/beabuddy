/**
 * What Home's trip modules read from the traveller's own data: the places
 * saved in the trip's towns ("Saved for this trip") and the first of them the
 * plan does not have yet ("Worth a detour"). Pure, so it is tested.
 */
import { foldAccents } from "./fuzzy.ts";

const town = (name: string | null | undefined) =>
  foldAccents((name ?? "").split(",")[0] ?? "")
    .toLowerCase()
    .trim();

/** The trip's towns, as compared: "Lisbon, Portugal" and "lisbon" are one. */
export function tripTowns(
  trip: { city?: string | null },
  stops: readonly { city?: string | null }[],
): Set<string> {
  const towns = new Set<string>();
  for (const name of [trip.city, ...stops.map((s) => s.city)]) {
    const key = town(name);
    if (key) towns.add(key);
  }
  return towns;
}

type Saved = { name: string; city: string | null; visited?: boolean | null };

/** Places saved in the trip's towns and not yet been to, newest first as given. */
export function savedForTrip<T extends Saved>(rows: readonly T[], towns: ReadonlySet<string>): T[] {
  return rows.filter((row) => !row.visited && towns.has(town(row.city)));
}

const words = (text: string) =>
  foldAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** The first saved place the plan does not already have a stop for. */
export function worthADetour<T extends Saved>(
  saved: readonly T[],
  planTitles: readonly string[],
): T | null {
  const plan = planTitles.map(words).filter(Boolean);
  for (const row of saved) {
    const name = words(row.name);
    if (!name) continue;
    if (plan.some((title) => title.includes(name) || name.includes(title))) continue;
    return row;
  }
  return null;
}
