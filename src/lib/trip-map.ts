/**
 * Whether a trip can be drawn, and at what altitude.
 *
 * Every stop and timeline entry already stores lat/lon and none of it was ever
 * drawn — the plan calls that an absence rather than a missing feature. This
 * decides what to draw from the same stop list the directions download uses,
 * so the map and the directions can never describe different journeys. They
 * did once, and the bug it caused is written up in offline-directions.ts.
 *
 * Two altitudes, because one does not cover both trips people take. Across
 * regions, country outlines give you the shape of the journey. Inside one city
 * they give you nothing: the basemap resolves coastlines, not streets, so a
 * three-stop day in Montréal renders as pins on an empty field pretending to
 * be a map. Below the threshold it stops pretending and draws a diagram
 * instead — true relative position and real distances, which is the question a
 * city day actually asks.
 */

import { haversine } from "./geo.ts";

export type MapStop = { title: string; lat: number; lon: number };

/** Below this, country outlines have nothing to say. */
export const SCHEMATIC_BELOW_METRES = 25_000;

export type TripMapPlan =
  /** Nothing to draw, and why — so the trip page can say the right thing. */
  | { kind: "none"; reason: "no-stops" | "no-coords" }
  /** One place on the map. A route needs two. */
  | { kind: "single"; stop: MapStop }
  /** Country outlines, fitted to the stops. */
  | { kind: "geographic"; stops: MapStop[]; spanMetres: number }
  /** No basemap: relative position and leg distances. */
  | { kind: "schematic"; stops: MapStop[]; spanMetres: number };

type Placeable = {
  title: string;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

function placed(point: Placeable): point is Placeable & { lat: number; lon: number } {
  return (
    typeof point.lat === "number" &&
    typeof point.lon === "number" &&
    Number.isFinite(point.lat) &&
    Number.isFinite(point.lon) &&
    Math.abs(point.lat) <= 90 &&
    Math.abs(point.lon) <= 180 &&
    // 0,0 is the null island a failed geocode lands on, not a stop.
    (point.lat !== 0 || point.lon !== 0)
  );
}

/** The stops that can go on a map, in itinerary order. */
export function mappableStops(stops: readonly Placeable[]): MapStop[] {
  return stops
    .filter(placed)
    .map((stop) => ({ title: stop.title.trim(), lat: stop.lat, lon: stop.lon }));
}

/** The widest gap between any two stops — what the view has to hold. */
export function spanMetres(stops: readonly MapStop[]): number {
  let widest = 0;
  for (let i = 0; i < stops.length; i += 1) {
    for (let j = i + 1; j < stops.length; j += 1) {
      const metres = haversine(stops[i]!, stops[j]!);
      if (metres > widest) widest = metres;
    }
  }
  return widest;
}

/** Distinct points, so a trip that never moves is not drawn as a route. */
function distinctPoints(stops: readonly MapStop[]): number {
  return new Set(stops.map((s) => `${s.lat.toFixed(5)},${s.lon.toFixed(5)}`)).size;
}

export function tripMapPlan(stops: readonly Placeable[]): TripMapPlan {
  if (stops.length === 0) return { kind: "none", reason: "no-stops" };

  const mappable = mappableStops(stops);
  if (mappable.length === 0) return { kind: "none", reason: "no-coords" };
  if (distinctPoints(mappable) === 1) return { kind: "single", stop: mappable[0]! };

  const span = spanMetres(mappable);
  return span < SCHEMATIC_BELOW_METRES
    ? { kind: "schematic", stops: mappable, spanMetres: span }
    : { kind: "geographic", stops: mappable, spanMetres: span };
}
