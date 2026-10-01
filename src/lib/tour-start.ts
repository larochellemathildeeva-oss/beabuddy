import { beginTourReplay, safeStorage } from "./tour-state.ts";
import type { TourMode } from "./tour.ts";

/**
 * Start one walk straight away — "Show me" in Help and the welcome flow.
 * Like Replay, it never marks the walk unseen. The Tour in the root layout
 * listens for this event (`useTourControl`).
 */
export function startWalk(mode: TourMode): void {
  if (typeof window === "undefined") return;
  beginTourReplay(safeStorage());
  window.dispatchEvent(new CustomEvent("bea-tour-start", { detail: { intent: "replay", mode } }));
}
