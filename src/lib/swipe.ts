/**
 * What a horizontal drag on a stop card means, decided without the DOM.
 *
 * Right past COMPLETE marks the stop done (or not done). Left past OPEN
 * docks the card open on its actions; left past DELETE deletes outright.
 * Anything shorter springs back. The numbers are the prototype's.
 */

export const LOCK_AFTER_PX = 6;
export const COMPLETE_PX = 65;
export const OPEN_PX = 40;
export const TRAY_PX = 140;
export const DELETE_PX = 170;

/**
 * Horizontal or vertical, once the finger has moved far enough to tell.
 * Vertical hands the gesture back to the page so scrolling never stutters.
 */
export function lockAxis(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) < LOCK_AFTER_PX && Math.abs(dy) < LOCK_AFTER_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

export type SwipeOutcome = "complete" | "open" | "delete" | "close";

export function swipeOutcome(dx: number): SwipeOutcome {
  if (dx > COMPLETE_PX) return "complete";
  if (dx < -DELETE_PX) return "delete";
  if (dx < -OPEN_PX) return "open";
  return "close";
}
