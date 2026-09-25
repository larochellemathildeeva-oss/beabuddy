/**
 * How long a journey takes when the router could not say.
 *
 * The public router is a demo service and fails now and then; without a
 * duration there is no "Leave by", which is the one thing Companion is for.
 * Two pins are still two pins, so the straight line between them, stretched
 * for streets that do not run straight, gives a fair estimate — shown as one.
 *
 * Walking at 4.5 km/h with streets 1.3× the straight line; driving at an
 * average of 30 km/h in town with roads 1.4× the line. Rounded up to a
 * whole minute, and never under one.
 */
export function estimatedLegSeconds(straightMeters: number, mode: "walking" | "driving"): number {
  if (!(straightMeters > 0)) return 0;
  const [detour, metersPerSecond] = mode === "walking" ? [1.3, 4500 / 3600] : [1.4, 30000 / 3600];
  const seconds = (straightMeters * detour) / metersPerSecond;
  return Math.max(60, Math.ceil(seconds / 60) * 60);
}

/** The distance that estimate assumes, in metres along the way. */
export function estimatedLegMeters(straightMeters: number, mode: "walking" | "driving"): number {
  if (!(straightMeters > 0)) return 0;
  return Math.round(straightMeters * (mode === "walking" ? 1.3 : 1.4));
}
