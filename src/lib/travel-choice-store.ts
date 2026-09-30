import {
  DEFAULT_TRAVEL_RULES,
  isTravelChoice,
  parseTravelRules,
  type TravelChoice,
  type TravelRules,
} from "./travel-mode.ts";

/**
 * How the traveller gets around, remembered per trip on this phone: a road
 * trip is driven and a week in Tokyo is taken by metro. A trip not asked yet
 * starts from the last answer given on any trip.
 */
export const TRAVEL_KEY_PREFIX = "bea.travel.";
const LAST_KEY = `${TRAVEL_KEY_PREFIX}last`;
/** The last rules set on any trip, so picking "Your own rules" again starts from them. */
const RULES_KEY = `${TRAVEL_KEY_PREFIX}rules`;

function read(key: string): TravelChoice | null {
  try {
    const raw = window.localStorage.getItem(key);
    return isTravelChoice(raw) ? raw : null;
  } catch {
    // Private windows and blocked storage: ask again next time.
    return null;
  }
}

export function readTravelChoice(tripId: string | null | undefined): TravelChoice {
  if (typeof window === "undefined") return "auto";
  return (tripId ? read(`${TRAVEL_KEY_PREFIX}${tripId}`) : null) ?? read(LAST_KEY) ?? "auto";
}

export function writeTravelChoice(tripId: string | null | undefined, choice: TravelChoice): void {
  try {
    if (tripId) window.localStorage.setItem(`${TRAVEL_KEY_PREFIX}${tripId}`, choice);
    window.localStorage.setItem(LAST_KEY, choice);
    if (parseTravelRules(choice)) window.localStorage.setItem(RULES_KEY, choice);
  } catch {
    // Not remembering it is fine.
  }
}

export function readLastTravelRules(): TravelRules {
  if (typeof window === "undefined") return DEFAULT_TRAVEL_RULES;
  return parseTravelRules(read(RULES_KEY)) ?? DEFAULT_TRAVEL_RULES;
}
