import { formatMetres, haversine, isLatLon, type LatLon } from "./geo.ts";

/**
 * "Where am I?" on the day map: the pure parts.
 *
 * The position is read by the browser and drawn by the browser. It is never
 * sent to Béa's server, never saved, and forgotten when the map is closed.
 * The map tiles are the one way it could leak: a map moved to you asks the
 * tile server for the squares around you. So the map only moves to you when
 * you are near the day, whose area the trip already names, and never to
 * somewhere else entirely.
 */

/** Where you are, and how sure the phone is of it. */
export type HereFix = LatLon & { accuracy: number };

/**
 * Nearer the day than this and the map frames you with its stops. Further,
 * and the map stays where it is and says how far away you are: someone at
 * home planning next month's trip does not need the map, or its tile server,
 * to go to their home.
 */
export const HERE_WITH_DAY_M = 25_000;

/** No new position for this long and the dot is shown as old. */
export const HERE_STALE_MS = 60_000;

/** Wider than this and the circle says nothing a dot does not. */
export const HERE_ACCURACY_MAX_M = 3_000;

/** A reading from the browser, as a fix, or null when it is not a position. */
export function hereFix(coords: {
  latitude: number;
  longitude: number;
  accuracy?: number | null;
}): HereFix | null {
  const at = { lat: coords.latitude, lon: coords.longitude };
  if (!isLatLon(at)) return null;
  const accuracy =
    typeof coords.accuracy === "number" && Number.isFinite(coords.accuracy) && coords.accuracy > 0
      ? coords.accuracy
      : 0;
  return { ...at, accuracy };
}

/**
 * Where to draw you beside the day, and how far you are from its nearest
 * stop. Across the date line a longitude is moved by a whole turn to sit
 * beside that stop, so -179.9 next to 179.9 is framed as the few metres it
 * is, not as the whole world.
 */
export function hereBesideDay(
  here: HereFix,
  pins: readonly LatLon[],
): { at: HereFix; nearestM: number } {
  let nearest: LatLon | null = null;
  let nearestM = Infinity;
  for (const pin of pins) {
    const metres = haversine(here, pin);
    if (metres < nearestM) {
      nearestM = metres;
      nearest = pin;
    }
  }
  if (!nearest) return { at: here, nearestM };
  const turns = Math.round((nearest.lon - here.lon) / 360);
  return { at: { ...here, lon: here.lon + turns * 360 }, nearestM };
}

/**
 * Longitudes moved by whole turns to sit beside `ref`, so points either side
 * of the date line are fitted as the short span they are.
 */
export function lonsBeside<T extends LatLon>(points: readonly T[], ref: LatLon): T[] {
  return points.map((p) => ({ ...p, lon: p.lon + Math.round((ref.lon - p.lon) / 360) * 360 }));
}

/** Whether the map moves to frame you with the day. */
export function framesWithDay(nearestM: number): boolean {
  return nearestM <= HERE_WITH_DAY_M;
}

/** What the map says when you are too far from the day to be shown beside it. */
export function farFromDay(nearestM: number): string {
  return `You're ${formatMetres(nearestM)} from this day's stops.`;
}

/** The accuracy circle's radius in metres, or 0 when it is not worth drawing. */
export function accuracyRadius(fix: HereFix): number {
  return fix.accuracy > 0 && fix.accuracy <= HERE_ACCURACY_MAX_M ? fix.accuracy : 0;
}

/**
 * What to say when the browser will not give a position. `code` is the
 * GeolocationPositionError code: 1 refused, 2 unavailable, 3 timed out.
 */
export function locationTrouble(code: number, framed: boolean): string {
  if (code === 1 && framed) {
    return "This preview window isn't allowed to use location. Open Béa in its own tab.";
  }
  if (code === 1) {
    return "Your browser is blocking location. Allow it in the address bar, then try again.";
  }
  if (code === 3) return "Your location is taking a while. Try again in the open.";
  return "Your location isn't available right now.";
}
