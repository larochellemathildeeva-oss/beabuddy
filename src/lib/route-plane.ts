/**
 * A plane is a property of the destination, not a style a screen picks.
 *
 * Béa animated in a handful of different ways depending on which component
 * happened to be doing the navigating, so the same surface could arrive two
 * ways in two contexts. Declaring it on the route means the shell can stamp
 * one attribute and every transition rule reads from that — no screen can
 * disagree with itself.
 *
 *   tab    — a sibling destination. Cross-fade with a small drift in the
 *            direction of travel. Never pushes.
 *   detail — something opened from a thing on the previous screen. Grows from
 *            it on the way in, shrinks back on the way out. Always has a back
 *            affordance.
 *   sheet  — a surface over the current one. Rises over a scrim and never
 *            navigates onward.
 */
export const PLANES = ["tab", "detail", "sheet"] as const;
export type Plane = (typeof PLANES)[number];

export const DEFAULT_PLANE: Plane = "tab";

export function isPlane(value: unknown): value is Plane {
  return typeof value === "string" && (PLANES as readonly string[]).includes(value);
}

type MatchLike = { staticData?: { plane?: unknown } | undefined };

/**
 * The plane of the deepest match that declares one.
 *
 * Reading the deepest rather than the last lets a layout route set a default
 * for everything beneath it while a single child still overrides. A route that
 * declares nothing falls back to `tab`, which is the safe direction: a missing
 * plane makes a detail page cross-fade, which looks plain, where the reverse
 * would make a tab grow out of nowhere.
 */
export function planeFromMatches(matches: readonly MatchLike[]): Plane {
  for (let i = matches.length - 1; i >= 0; i--) {
    const declared = matches[i]?.staticData?.plane;
    if (isPlane(declared)) return declared;
  }
  return DEFAULT_PLANE;
}

/** True when no match declared a plane — worth a dev warning, never a throw. */
export function planeIsUndeclared(matches: readonly MatchLike[]): boolean {
  return !matches.some((m) => isPlane(m?.staticData?.plane));
}

/**
 * Which way a tab-to-tab move travels, as a signed step.
 *
 * Only tabs have an order to travel along, so anything involving a route with
 * no tab (index -1) has no direction and drifts nowhere. Returning 0 there is
 * what stops a jump to Settings from sliding as though it were a tab.
 */
export function travelDirection(fromIndex: number, toIndex: number): -1 | 0 | 1 {
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return 0;
  return toIndex > fromIndex ? 1 : -1;
}
