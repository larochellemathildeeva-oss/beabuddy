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
 *
 * Rows often come back with no town at all (the model leaves it out when it
 * is unsure), so a day with none is looked up once from one of its pins and
 * the day's rows take that town (`dayPinsToLookUp`, `withDayTowns`).
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
 * them. A plan in one town adds it only to a trip with no destinations yet:
 * a single-city trip that already has its city needs nothing.
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
  if (seen.size === 0 || (seen.size < 2 && existing.length > 0)) return [];
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

export type PinnedRow = PlanCityRow & {
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

/**
 * One pin for each day whose rows name no town, to look the town up from.
 * A journey's pin is where it leaves from, so a sight or a stay is preferred.
 */
export function dayPinsToLookUp(
  rows: readonly PinnedRow[],
  max = 10,
): { day: string; lat: number; lon: number }[] {
  const named = new Set<string>();
  const pins = new Map<string, { lat: number; lon: number; journey: boolean }>();
  for (const row of rows) {
    const day = row.day_date;
    if (!day) continue;
    if (row.city?.trim() && !JOURNEY_KINDS.has(row.kind)) named.add(day);
    if (row.lat == null || row.lon == null) continue;
    const journey = JOURNEY_KINDS.has(row.kind);
    const had = pins.get(day);
    if (!had || (had.journey && !journey)) pins.set(day, { lat: row.lat, lon: row.lon, journey });
  }
  return [...pins]
    .filter(([day, pin]) => !named.has(day) && !pin.journey)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .slice(0, max)
    .map(([day, { lat, lon }]) => ({ day, lat, lon }));
}

/** Rows with no town take the town their day was found in ("Berlin, Germany"). */
export function withDayTowns<T extends PlanCityRow>(
  rows: readonly T[],
  towns: Readonly<Record<string, string>>,
): T[] {
  return rows.map((row) =>
    row.city?.trim() || !row.day_date || !towns[row.day_date]
      ? row
      : { ...row, city: towns[row.day_date] },
  );
}

/**
 * The plan's towns, looking up the days that name none from their pins.
 * `lookup` is the reverse geocoder; a failed lookup only leaves its day out.
 */
export async function planTowns(
  rows: readonly PinnedRow[],
  existing: readonly { city: string }[],
  lookup: (at: {
    lat: number;
    lon: number;
  }) => Promise<{ city?: string | undefined; country?: string | undefined }>,
): Promise<PlanCity[]> {
  const pins = dayPinsToLookUp(rows);
  const towns: Record<string, string> = {};
  // One at a time: the keyless geocoder allows one request a second.
  for (const { day, lat, lon } of pins) {
    const found = await lookup({ lat, lon }).catch(
      () => ({}) as { city?: string | undefined; country?: string | undefined },
    );
    if (found.city) towns[day] = [found.city, found.country].filter(Boolean).join(", ");
  }
  return planCities(withDayTowns(rows, towns), existing);
}

/** "Hiroshima" on a plan in Japan is "Hiroshima, Japan"; a town already with its country is left alone. */
export function withCountry<T extends PlanCityRow>(row: T, country: string | null | undefined): T {
  const city = row.city?.trim();
  const nation = country?.trim();
  if (!city || !nation || city.includes(",")) return row;
  if (city.toLowerCase() === nation.toLowerCase()) return row;
  return { ...row, city: `${city}, ${nation}` };
}

/**
 * The starting city a trip with none takes from the plan saved into it.
 *
 * `towns` are every town the plan reaches, in the order it reaches them —
 * not only the ones new to the route, or a plan whose towns were already
 * Destinations set nothing. The first is where the trip starts; its country
 * comes from the town, else the one the towns share, else `country` (the one
 * the plan was placed in).
 *
 * A trip with no place used to take only the country when the plan went
 * through several towns, so the starting city stayed empty after every
 * multi-town import. A trip that has a starting city keeps it, and one filed
 * under a country is only given a town in that country.
 */
export function tripPlaceFromTowns(
  trip: { city?: string | null | undefined; country?: string | null | undefined },
  towns: readonly PlanCity[],
  country?: string | null | undefined,
): { city: string; country?: string } | null {
  if (trip.city?.trim()) return null;
  const first = towns.find((t) => t.city.trim());
  if (!first) return null;
  const named = new Set(towns.map((t) => t.country?.trim()).filter((c): c is string => Boolean(c)));
  const nation =
    first.country?.trim() || (named.size === 1 ? [...named][0] : undefined) || country?.trim();
  const had = trip.country?.trim();
  if (had) {
    if (nation && key(nation) !== key(had)) return null;
    return { city: first.city.trim() };
  }
  return nation ? { city: first.city.trim(), country: nation } : { city: first.city.trim() };
}

/**
 * The towns of `all` (a plan's, in order) that the trip's route does not have
 * yet — `planCities`' rule on towns already worked out: a one-town plan adds
 * its town only to a trip with no destinations yet.
 */
export function newTowns(
  all: readonly PlanCity[],
  existing: readonly { city: string }[],
): PlanCity[] {
  if (all.length === 0 || (all.length < 2 && existing.length > 0)) return [];
  const have = new Set(existing.map((c) => key(c.city)));
  return all.filter((t) => !have.has(key(t.city)));
}
