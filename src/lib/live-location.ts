import { haversine, isLatLon, type LatLon } from "./geo.ts";

/**
 * "Where am I?" on the day map: the pure parts.
 *
 * The position is read by the browser and drawn by the browser. It is never
 * sent to Béa's server, never saved, and forgotten when the map is closed —
 * the same promise the Near list makes, kept shorter still.
 */

/** Where you are, and how sure the phone is of it. */
export type HereFix = LatLon & { accuracy: number };

/**
 * Nearer the day than this and the map frames you with its stops; further,
 * and it goes to you alone. Someone across town from the day wants both on
 * screen; someone at home planning next month's trip wants to see home.
 */
export const HERE_WITH_DAY_M = 25_000;

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

/** Whether the first fix is framed with the day's stops, or on its own. */
export function hereFraming(here: LatLon, pins: readonly LatLon[]): "with-day" | "alone" {
  if (pins.length === 0) return "alone";
  const nearest = Math.min(...pins.map((pin) => haversine(here, pin)));
  return nearest <= HERE_WITH_DAY_M ? "with-day" : "alone";
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
