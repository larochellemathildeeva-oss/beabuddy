/**
 * What Home shows for "near you", as one decision.
 *
 * This was spread across two components that disagreed. NearHome asked "is
 * anything within the radius" to decide whether to collapse to a one-liner;
 * NearbyPlaces asked the same question but subtracted the places you had
 * dismissed, which only it knew about. Dismiss everything nearby and the two
 * answers diverged: Home kept the heading and the list under it came back
 * empty.
 *
 * The other half is the one that made sharing your location look broken. A
 * travel vault is mostly places abroad, and the default radius is 5 km, so
 * "nothing within 5 km" is the ordinary outcome at home rather than the edge
 * case — and the answer was a single faint line where a panel had been, which
 * reads as nothing having happened. So this returns the nearest saved place
 * even when it is far outside the radius: Béa looked, and can say what she
 * found and how far away it is, instead of only what she did not find.
 */

import { pinsWithin, type NearPin } from "./near.ts";
import { metresAway } from "./near.ts";
import type { LatLon } from "./geo.ts";

export type NearRow<T extends NearPin> = { pin: T; metres: number };

export type NearHomeView<T extends NearPin> =
  /** Nothing in the vault can be near anything — say nothing at all. */
  | { kind: "hidden" }
  /** Ask for a location, or report what is happening with the attempt. */
  | { kind: "offer" }
  /** Places inside the radius, nearest-first. */
  | { kind: "places"; rows: NearRow<T>[] }
  /** Located, but nothing within reach. `nearest` ignores the radius. */
  | { kind: "none-near"; nearest: NearRow<T> | null };

/** The closest saved place at any distance, or null. */
export function nearestPin<T extends NearPin>(
  here: LatLon | null,
  pins: readonly T[],
  dismissed: readonly string[] = [],
): NearRow<T> | null {
  if (!here) return null;
  const skip = new Set(dismissed);
  let best: NearRow<T> | null = null;
  for (const pin of pins) {
    if (skip.has(pin.id)) continue;
    const metres = metresAway(here, pin);
    if (!best || metres < best.metres) best = { pin, metres };
  }
  return best;
}

export function nearHomeView<T extends NearPin>({
  consent,
  located,
  here,
  pins,
  radius,
  dismissed = [],
}: {
  consent: boolean;
  /** True once a position has actually arrived — not merely asked for. */
  located: boolean;
  here: LatLon | null;
  pins: readonly T[];
  radius: number;
  dismissed?: readonly string[];
}): NearHomeView<T> {
  if (pins.length === 0) return { kind: "hidden" };
  if (!consent || !located || !here) return { kind: "offer" };

  const rows = pinsWithin(here, pins, radius, dismissed);
  if (rows.length > 0) return { kind: "places", rows };
  return { kind: "none-near", nearest: nearestPin(here, pins, dismissed) };
}
