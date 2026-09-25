import { isTravelLeg } from "./import-stop.ts";

type Row = {
  kind: string;
  title: string;
  day_date: string | null;
  lat: number | null;
  lon: number | null;
};

/**
 * The days worth a map picture, and the pins on each, in visiting order.
 *
 * A day needs at least one stop on the map. Journeys written as rows ("Walk
 * to the pier") are left out, as elsewhere; so are pins at 0,0, which are a
 * missing place, not the Gulf of Guinea. At most 30 pins, the picture's
 * limit; at most `maxDays` days, so a long trip is not one enormous save.
 */
export function daysForMaps(
  rows: readonly Row[],
  maxDays = 21,
): { day: string; points: { lat: number; lon: number }[] }[] {
  const byDay = new Map<string, { lat: number; lon: number }[]>();
  for (const row of rows) {
    if (!row.day_date || row.lat == null || row.lon == null) continue;
    if (row.lat === 0 && row.lon === 0) continue;
    if (isTravelLeg(row)) continue;
    const list = byDay.get(row.day_date) ?? [];
    if (list.length < 30) list.push({ lat: row.lat, lon: row.lon });
    byDay.set(row.day_date, list);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, maxDays)
    .map(([day, points]) => ({ day, points }));
}
