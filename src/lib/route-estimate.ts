import type { LegMode } from "./travel-mode.ts";

/**
 * How long a journey takes when the router could not say.
 *
 * The public router is a demo service and fails now and then; without a
 * duration there is no "Leave by", which is the one thing Companion is for.
 * Two pins are still two pins, so the straight line between them, stretched
 * for streets that do not run straight, gives a fair estimate — shown as one.
 *
 * Walking at 4.5 km/h with streets 1.3× the straight line; driving at an
 * average of 30 km/h in town with roads 1.4× the line; transit at 20 km/h
 * along lines 1.3× the line, plus eight minutes to reach the stop and wait.
 * Rounded up to a whole minute, and never under one.
 */
export function estimatedLegSeconds(straightMeters: number, mode: LegMode): number {
  if (!(straightMeters > 0)) return 0;
  const [detour, metersPerSecond, extra] =
    mode === "walking"
      ? [1.3, 4500 / 3600, 0]
      : mode === "transit"
        ? [1.3, 20000 / 3600, TRANSIT_WAIT_S]
        : [1.4, 30000 / 3600, 0];
  const seconds = (straightMeters * detour) / metersPerSecond + extra;
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}

/** Walking to the stop and waiting for what comes, on a transit estimate. */
const TRANSIT_WAIT_S = 8 * 60;

/** The distance that estimate assumes, in metres along the way. */
export function estimatedLegMeters(straightMeters: number, mode: LegMode): number {
  if (!(straightMeters > 0)) return 0;
  return Math.round(straightMeters * (mode === "driving" ? 1.4 : 1.3));
}
