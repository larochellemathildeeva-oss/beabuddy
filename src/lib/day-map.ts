/**
 * What the day map draws, decided without a map.
 *
 * The list and the map on the Map perspective are two drawings of one set of
 * stops, and the only thing that joins them for the reader is the number:
 * card 3 is pin 3. So the number is a stop's position in the list as shown,
 * counted before anything is dropped for lacking a position. A day whose
 * second stop has no address draws pins 1 and 3, not 1 and 2 — a gap the
 * reader can explain by looking at card 2, where "Not on the map yet" says
 * why. Renumbering to close the gap would make the two halves disagree.
 *
 * Kept out of the component so it can be tested with no browser: Leaflet
 * cannot be imported under node, and none of this needs it.
 */

import { placed, tripMapPlan, type TripMapPlan } from "./trip-map.ts";

export type DayMapPin = {
  id: string;
  /** 1-based, and the same number the stop's card shows. */
  number: number;
  title: string;
  lat: number;
  lon: number;
};

type DayStop = {
  id: string;
  title: string;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
};

export function dayMapPins(stops: readonly DayStop[]): DayMapPin[] {
  const pins: DayMapPin[] = [];
  stops.forEach((stop, i) => {
    if (!placed(stop)) return;
    pins.push({
      id: stop.id,
      number: i + 1,
      title: stop.title.trim(),
      lat: stop.lat,
      lon: stop.lon,
    });
  });
  return pins;
}

export type DayMapModel = {
  plan: TripMapPlan;
  pins: DayMapPin[];
  /** Stops in the list that have no pin, so the map can say it is partial. */
  unplaced: number;
};

export function dayMapModel(stops: readonly DayStop[]): DayMapModel {
  const pins = dayMapPins(stops);
  return { plan: tripMapPlan(stops), pins, unplaced: stops.length - pins.length };
}

/**
 * The line under the map, when there is something the map cannot show.
 *
 * Silence when every stop is drawn: a caption that confirms the obvious is
 * one more thing to read on a street.
 */
export function dayMapCaption(model: DayMapModel): string | null {
  const { unplaced, pins } = model;
  if (unplaced === 0) return null;
  if (pins.length === 0) return null; // The empty state says it instead.
  return unplaced === 1
    ? "One stop has no location yet, so it is in the list but not on the map."
    : `${unplaced} stops have no location yet, so they are in the list but not on the map.`;
}

/**
 * Tapping the selected stop again lets go of it, so the map can return to
 * the whole day without a separate control for "none".
 */
export function toggleSelection(current: string | null, tapped: string): string | null {
  return current === tapped ? null : tapped;
}

/**
 * A gently curved path from one stop to the next, for the map's route.
 *
 * The route on the Map is a story of the day, not directions: a soft arc
 * reads as "then we went here", where a straight or street-following line
 * reads as navigation. A quadratic curve bowed sideways by `bend` of the
 * leg's length, alternating sides leg to leg so a day that doubles back
 * does not stack its arcs. Pure maths on the pins; nothing is routed.
 */
export function curvedLeg(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
  index: number,
  bend = 0.16,
  steps = 18,
): [number, number][] {
  const dLat = b.lat - a.lat;
  const dLon = b.lon - a.lon;
  if (dLat === 0 && dLon === 0) return [[a.lat, a.lon]];
  const side = index % 2 === 0 ? 1 : -1;
  // The control point: the midpoint, pushed along the perpendicular.
  const cLat = (a.lat + b.lat) / 2 - dLon * bend * side;
  const cLon = (a.lon + b.lon) / 2 + dLat * bend * side;
  const out: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push([
      u * u * a.lat + 2 * u * t * cLat + t * t * b.lat,
      u * u * a.lon + 2 * u * t * cLon + t * t * b.lon,
    ]);
  }
  return out;
}
