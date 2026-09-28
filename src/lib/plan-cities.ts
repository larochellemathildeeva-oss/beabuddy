/**
 * The towns an imported plan goes through, for the trip's Destinations.
 *
 * A plan pasted into a trip filed under one city can cover three countries.
 * The stops were placed town by town, but the trip itself still said Paris,
 * so the day grouping, the directions' area and the map all went on looking
 * there. Each town the plan spends time in is added to the route, with the
 * days it is there, unless the trip already has it.
 *
 * A town only left from — the flight out of home — is not a destination.
 */

export type PlanCityRow = {
  city?: string | null | undefined;
  day_date?: string | null | undefined;
  kind: string;
};

export type PlanCity = {
  city: string;
  country?: string;
  arrive_on?: string;
  depart_on?: string;
};

const JOURNEY_KINDS = new Set(["flight", "transport"]);

/** "Montréal" and "Montreal" are one town. */
function key(name: string): string {
  return name.split(",")[0]!.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

/**
 * The plan's towns the trip does not have yet, in the order the plan reaches
 * them. Empty for a plan in one town: nothing to add to a single-city trip.
 */
export function planCities(
  rows: readonly PlanCityRow[],
  existing: readonly { city: string }[],
): PlanCity[] {
  const seen = new Map<string, { name: string; dates: string[] }>();
  for (const row of rows) {
    const name = row.city?.trim();
    if (!name || JOURNEY_KINDS.has(row.kind)) continue;
    const k = key(name);
    if (!k) continue;
    const entry = seen.get(k) ?? { name, dates: [] };
    if (row.day_date) entry.dates.push(row.day_date);
    seen.set(k, entry);
  }
  if (seen.size < 2) return [];
  const have = new Set(existing.map((c) => key(c.city)));
  const out: PlanCity[] = [];
  for (const [k, { name, dates }] of seen) {
    if (have.has(k)) continue;
    const parts = name.split(/\s*,\s*/).filter(Boolean);
    const city = parts[0]!;
    const country = parts.length > 1 ? parts[parts.length - 1] : undefined;
    const sorted = [...dates].sort();
    out.push({
      city,
      ...(country ? { country } : {}),
      ...(sorted[0] ? { arrive_on: sorted[0] } : {}),
      ...(sorted.length ? { depart_on: sorted[sorted.length - 1]! } : {}),
    });
  }
  return out;
}
