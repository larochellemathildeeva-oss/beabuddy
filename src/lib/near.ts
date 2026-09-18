import { haversine, type LatLon } from "./geo.ts";

/**
 * Proximity, as a filter over saved places rather than a screen of its own.
 *
 * Near used to be its own tab. It was never a different set of things — it was
 * the recommendation vault sorted by how close you are — so it is now a filter
 * on that vault. This module holds the part of it that is arithmetic rather
 * than interface, so the filtered list, the Home nudge and the day-trip picker
 * all agree about what "near" means.
 */

export const NEAR_RADII = [500, 1_000, 5_000, 25_000] as const;
export const DEFAULT_RADIUS = 5_000;

export type NearPin = LatLon & { id: string };

/** Distance from here to a pin, in metres. */
export function metresAway(here: LatLon, pin: LatLon): number {
  return haversine(here, pin);
}

/** Pins inside the radius, nearest first, minus anything dismissed. */
export function pinsWithin<T extends NearPin>(
  here: LatLon | null,
  pins: readonly T[],
  radius: number,
  dismissed: readonly string[] = [],
): { pin: T; metres: number }[] {
  if (!here) return [];
  const skip = new Set(dismissed);
  return pins
    .filter((p) => !skip.has(p.id))
    .map((pin) => ({ pin, metres: metresAway(here, pin) }))
    .filter((row) => row.metres <= radius)
    .sort((a, b) => a.metres - b.metres);
}

/**
 * How far off something is, in words.
 *
 * The buckets are about effort rather than distance: "a short walk" is a
 * decision you make without thinking, "across town" is one you plan.
 */
export function reachLabel(metres: number | null): string {
  if (metres == null) return "Someday";
  if (metres <= 400) return "Right here";
  if (metres <= 2_000) return "A short walk";
  if (metres <= 15_000) return "Across town";
  if (metres <= 150_000) return "Day trip";
  return "Next journey";
}

/**
 * The one place worth interrupting Home for, or nothing.
 *
 * Home is not a list — it gets at most one nudge, and only when the place is
 * close enough that mentioning it is useful rather than noise. Folding Near
 * into a filter took away its front door, and this is the compensation: the
 * moment that justifies the app has to keep happening somewhere people
 * actually look.
 */
export const NUDGE_RADIUS = 2_000;

export function nudgePin<T extends NearPin>(
  here: LatLon | null,
  pins: readonly T[],
  dismissed: readonly string[] = [],
): { pin: T; metres: number } | null {
  return pinsWithin(here, pins, NUDGE_RADIUS, dismissed)[0] ?? null;
}

/** "180 m" / "1.4 km" / "12 km". Metres below a kilometre, rounded sensibly. */
export function formatMetres(metres: number): string {
  if (!Number.isFinite(metres) || metres < 0) return "";
  if (metres < 100) return `${Math.round(metres)} m`;
  if (metres < 1_000) return `${Math.round(metres / 10) * 10} m`;
  if (metres < 10_000) return `${(metres / 1_000).toFixed(1)} km`;
  return `${Math.round(metres / 1_000)} km`;
}

/**
 * Reads the `near` search param.
 *
 * Accepts the number and the string, because the two arrive by different
 * routes: the router JSON-encodes what it writes, so its own links come back
 * as the string "1", while `?near=1` typed by hand or pasted from someone
 * else's message parses as the number 1. A filter that only honoured one of
 * those would work from inside the app and break on a shared link, which is
 * the whole reason the state is in the URL.
 */
export function nearFromSearch(value: unknown): "1" | undefined {
  if (value === "1" || value === 1 || value === true) return "1";
  return undefined;
}
