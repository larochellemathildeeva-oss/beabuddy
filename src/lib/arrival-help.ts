/**
 * Arrival day: from the airport or station to where you are sleeping.
 *
 * The hour after landing is when a traveller is most tired and least sure
 * of the way, and the plan already knows both ends: the flight or train in,
 * and the hotel later that day. This finds that pair on a day and gives the
 * way between them — the Maps link opens transit, with its real lines — and
 * the check-in time when the stay has one.
 *
 * Only when both ends are on the plan. The start is the arrival's pin, or a
 * landing named as a place ("Arrive at Narita Airport"), or the airport or
 * station of the town a "Flight to Lisbon" goes to; anything vaguer and the
 * card says nothing rather than send someone to the wrong terminal.
 *
 * Pure, so the pairing is tested.
 */

import { clockMinutes } from "./companion.ts";
import { timelineGlyph } from "./timeline-kind.ts";

export type ArrivalStop = {
  id: string;
  title: string;
  kind: string;
  time_label: string | null;
  address?: string | null;
  lat?: number | null;
  lon?: number | null;
};

export type ArrivalHelp = {
  arrival: ArrivalStop;
  stay: ArrivalStop;
  /** Where the journey starts, for Maps: a pin, or a place's name. */
  from: { title: string; lat?: number | null; lon?: number | null };
  /** "15:00" when the stay has a clock time. */
  checkIn: string | null;
};

const AIRPORT = /\b(?:airport|terminal|aeroporto|aeropuerto|a[ée]roport|flughafen)\b|空港/i;
const STATION = /\b(?:station|gare|bahnhof|estaci[oó]n|esta[cç][aã]o|stazione)\b|駅/i;
const FLIGHT = /\b(?:flight|fly|flies|plane)\b|✈/i;
const TRAIN = /\b(?:train|rail|tgv|ice|eurostar|shinkansen|intercity)\b/i;
/** "Flight to Lisbon", "Train from Porto to Lisbon", "Fly YUL → LIS". */
const TO_TOWN = /(?:\bto\b|→|->)\s*([^,()·–—-]+?)\s*(?:$|[,()·–—-])/i;

const pinned = (s: { lat?: number | null; lon?: number | null }) =>
  typeof s.lat === "number" && typeof s.lon === "number" && !(s.lat === 0 && s.lon === 0);

/** Where someone stands once this journey is over, when it can be said. */
export function arrivalPoint(stop: ArrivalStop): ArrivalHelp["from"] | null {
  if (pinned(stop)) return { title: stop.title, lat: stop.lat!, lon: stop.lon! };
  const title = stop.title.trim();
  if (AIRPORT.test(title) || STATION.test(title)) {
    return { title: title.replace(/^(?:arriv(?:e|al|ing)\s+(?:at|in)\s+)/i, "") };
  }
  const town = TO_TOWN.exec(title)?.[1]?.trim();
  if (!town || town.length < 2) return null;
  if (FLIGHT.test(title) || stop.kind.toLowerCase() === "flight")
    return { title: `${town} airport` };
  if (TRAIN.test(title)) return { title: `${town} station` };
  return null;
}

/**
 * The first journey in of a day with a stay after it, or null. `stops` is
 * the day in order, as the timeline shows it.
 */
export function arrivalHelp(stops: readonly ArrivalStop[]): ArrivalHelp | null {
  for (let i = 0; i < stops.length; i++) {
    const arrival = stops[i]!;
    if (timelineGlyph(arrival) !== "transport") continue;
    const from = arrivalPoint(arrival);
    if (!from) continue;
    const stay = stops.slice(i + 1).find((s) => timelineGlyph(s) === "lodging");
    if (!stay) continue;
    const at = clockMinutes(stay.time_label);
    const checkIn =
      at == null
        ? null
        : `${String(Math.floor(at / 60)).padStart(2, "0")}:${String(at % 60).padStart(2, "0")}`;
    return { arrival, stay, from, checkIn };
  }
  return null;
}
