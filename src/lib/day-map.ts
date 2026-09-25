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

import { formatMetres, haversine } from "./geo.ts";
import { minutesOfDay } from "./day-shape.ts";
import { timelineGlyph } from "./timeline-kind.ts";
import { placed, tripMapPlan, type TripMapPlan } from "./trip-map.ts";

/**
 * The four families a pin is tinted by. Fewer than the glyphs on purpose: a
 * legend of seven colours is a dashboard, and walks, notes and "things to
 * do" read as the day's sights anyway.
 */
export type PinTone = "sight" | "food" | "transit" | "stay";

export const PIN_TONES: { tone: PinTone; label: string }[] = [
  { tone: "sight", label: "Sights" },
  { tone: "food", label: "Food" },
  { tone: "transit", label: "Transit" },
  { tone: "stay", label: "Stay" },
];

export function pinTone(stop: {
  kind?: string | null | undefined;
  title?: string | null | undefined;
}): PinTone {
  switch (timelineGlyph({ kind: stop.kind ?? null, title: stop.title ?? null })) {
    case "meal":
      return "food";
    case "transport":
      return "transit";
    case "lodging":
      return "stay";
    default:
      return "sight";
  }
}

export type DayMapPin = {
  id: string;
  /** 1-based, and the same number the stop's card shows. */
  number: number;
  title: string;
  lat: number;
  lon: number;
  tone: PinTone;
};

type DayStop = {
  id: string;
  title: string;
  kind?: string | null | undefined;
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
      tone: pinTone(stop),
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

/** The tones a set of pins uses, in legend order, so the legend lists only those. */
export function tonesUsed(pins: readonly { tone: PinTone }[]): typeof PIN_TONES {
  const used = new Set(pins.map((pin) => pin.tone));
  return PIN_TONES.filter((entry) => used.has(entry.tone));
}

/**
 * Metres a minute on foot, straight line. The same slow city pace the day's
 * tightness note uses, so the two never disagree about one walk.
 */
const WALK_METRES_PER_MIN = 70;
/** Past this, a straight-line walk time stops being a useful thing to say. */
const WALKABLE_METRES = 2500;

export type LegEstimate = {
  metres: number;
  /** Null when it is too far to be a walk. */
  walkMinutes: number | null;
  label: string;
};

/**
 * Roughly how far one stop is from the next, from the pins alone.
 *
 * As the crow flies, and said so with "about": nothing is routed here, so
 * it costs no credits and can never pretend to be directions.
 */
export function legEstimate(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): LegEstimate {
  const metres = haversine(a, b);
  if (metres > WALKABLE_METRES) {
    return { metres, walkMinutes: null, label: `about ${formatMetres(metres)} away` };
  }
  const walkMinutes = Math.max(1, Math.round(metres / WALK_METRES_PER_MIN));
  return {
    metres,
    walkMinutes,
    label: `about ${walkMinutes} min walk · ${formatMetres(metres)}`,
  };
}

/** The distance a day covers, stop to stop in order, as the crow flies. */
export function dayDistance(pins: readonly { lat: number; lon: number }[]): number {
  let total = 0;
  for (let i = 0; i < pins.length - 1; i++) total += haversine(pins[i]!, pins[i + 1]!);
  return total;
}

/** The next or previous pin, wrapping at either end. Null selection starts at the first. */
export function stepPin(
  pins: readonly { id: string }[],
  current: string | null,
  by: 1 | -1,
): string | null {
  const n = pins.length;
  if (n === 0) return null;
  const at = pins.findIndex((pin) => pin.id === current);
  if (at === -1) return pins[by === 1 ? 0 : n - 1]!.id;
  return pins[(at + by + n) % n]!.id;
}

/**
 * Where Focus opens: the stop asked for, else — on the day itself — the one
 * still to come (or the last, once the day is behind you), else the first.
 */
export function focusStart(
  pins: readonly { id: string }[],
  stops: readonly { id: string; time_label?: string | null }[],
  opts: { requested?: string | null; isToday: boolean; minutesNow: number },
): string | null {
  if (pins.length === 0) return null;
  const onMap = new Set(pins.map((pin) => pin.id));
  if (opts.requested && onMap.has(opts.requested)) return opts.requested;
  if (opts.isToday) {
    const timed = stops.filter(
      (stop) => onMap.has(stop.id) && minutesOfDay(stop.time_label) !== null,
    );
    if (timed.length > 0) {
      const ahead = timed.find((stop) => minutesOfDay(stop.time_label)! > opts.minutesNow);
      return (ahead ?? timed[timed.length - 1]!).id;
    }
  }
  return pins[0]!.id;
}

/** The Map tab's three layouts. */
export const MAP_LAYOUTS = [
  { id: "split", label: "Split", hint: "The day beside its map." },
  { id: "focus", label: "Focus", hint: "One stop at a time; the map follows." },
  { id: "timeline", label: "Timeline", hint: "The map, then the day in order." },
] as const;
export type MapLayout = (typeof MAP_LAYOUTS)[number]["id"];

export function isMapLayout(value: unknown): value is MapLayout {
  return MAP_LAYOUTS.some((layout) => layout.id === value);
}
