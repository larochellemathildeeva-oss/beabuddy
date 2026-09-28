import { DIRECTIONS_WALK_M } from "./route-optimize.ts";

/** How one journey between two stops is made. */
export type LegMode = "walking" | "driving" | "transit";

/**
 * How the traveller gets around, asked before directions are worked out.
 *
 * "auto" is what Béa did before it asked: walk what is close, drive the
 * rest. Someone without a car was told "Drive 12 min" for a stretch they
 * would take the metro for, and every "Leave by" after it was wrong.
 */
export type TravelChoice = "auto" | "walk" | "drive" | "transit";

export const TRAVEL_CHOICES: { id: TravelChoice; label: string; detail: string }[] = [
  { id: "auto", label: "Walk what's close", detail: "Walk under 3 km, drive the rest." },
  {
    id: "transit",
    label: "Public transit",
    detail: "Bus, metro and train, walking the short hops.",
  },
  { id: "walk", label: "Walk everywhere", detail: "On foot up to 15 km; longer is driven." },
  { id: "drive", label: "Car", detail: "Every stretch by road." },
];

/**
 * On transit, a journey shorter than this is walked: by the time you reach
 * the stop and wait, you would have been there.
 */
export const TRANSIT_WALK_M = 1_000;

/**
 * Walking everywhere still stops somewhere: past this, the journey is to
 * another town (a city route's legs go through here too), and is driven.
 */
export const WALK_MAX_M = 15_000;

export function isTravelChoice(value: unknown): value is TravelChoice {
  return value === "auto" || value === "walk" || value === "drive" || value === "transit";
}

/** The mode for one journey this far apart, as the crow flies. */
export function legModeFor(choice: TravelChoice, straightM: number): LegMode {
  switch (choice) {
    case "walk":
      return straightM <= WALK_MAX_M ? "walking" : "driving";
    case "drive":
      return "driving";
    case "transit":
      return straightM < TRANSIT_WALK_M ? "walking" : "transit";
    default:
      return straightM < DIRECTIONS_WALK_M ? "walking" : "driving";
  }
}

/** "Walk", "Drive", "Transit": the word a saved row starts with. */
export function modeWord(mode: LegMode): "Walk" | "Drive" | "Transit" {
  return mode === "walking" ? "Walk" : mode === "transit" ? "Transit" : "Drive";
}

/** A saved row's first word read back as its mode; null when it is not one of Béa's. */
export function modeFromWord(word: string): LegMode | null {
  const w = word.trim().toLowerCase();
  if (w === "walk") return "walking";
  if (w === "drive") return "driving";
  if (w === "transit") return "transit";
  return null;
}
