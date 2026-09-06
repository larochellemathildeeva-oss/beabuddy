/**
 * Storage lifecycle for the first-run tour, kept free of React and the DOM so
 * the rules can be unit tested. Every one of the four bugs this replaces was a
 * storage bug, not a rendering one:
 *
 *  - the tour opened for signed-out visitors,
 *  - signing up cleared a skip the visitor had already made,
 *  - progress was only written on completion, so closing the tab restarted it,
 *  - replaying from Profile wiped the "already seen" mark.
 *
 * The rule that keeps those apart: exactly one entry point may clear the seen
 * mark (nothing does, now — it is only ever set), and replay never touches it.
 */

import type { TourMode } from "./tour.ts";

/** Set once the traveller has finished or dismissed the walk. */
export const TOUR_SEEN_KEY = "bea-tour-seen";
/** Where they were, so closing the tab mid-Deep-Dive is not a restart. */
export const TOUR_PROGRESS_KEY = "bea-tour-progress";

export type TourProgress = { mode: TourMode; step: number };

/** The slice of Storage this module needs; lets tests pass a plain map. */
export type TourStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function hasSeenTour(storage: TourStorage): boolean {
  return storage.getItem(TOUR_SEEN_KEY) === "yes";
}

/** Finishing and skipping are the same thing: they both end the walk. */
export function markTourSeen(storage: TourStorage): void {
  storage.setItem(TOUR_SEEN_KEY, "yes");
  storage.removeItem(TOUR_PROGRESS_KEY);
}

export function readTourProgress(storage: TourStorage): TourProgress | null {
  const raw = storage.getItem(TOUR_PROGRESS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TourProgress>;
    if (parsed.mode !== "quick" && parsed.mode !== "deep") return null;
    if (typeof parsed.step !== "number" || !Number.isInteger(parsed.step) || parsed.step < 0) {
      return null;
    }
    return { mode: parsed.mode, step: parsed.step };
  } catch {
    return null;
  }
}

export function saveTourProgress(storage: TourStorage, progress: TourProgress): void {
  storage.setItem(TOUR_PROGRESS_KEY, JSON.stringify(progress));
}

/**
 * A brand-new account opens the walk; anyone who already finished or skipped it
 * does not, however they arrived. Signing up is not a reason to re-ask someone
 * who just said no.
 */
export function shouldAutoOpenTour(
  storage: TourStorage,
  context: { signedIn: boolean },
): boolean {
  if (!context.signedIn) return false;
  return !hasSeenTour(storage);
}

/**
 * Replay from Profile starts the walk over without pretending the traveller
 * never took it — leaving mid-replay must not make the next session look new.
 */
export function beginTourReplay(storage: TourStorage): void {
  storage.removeItem(TOUR_PROGRESS_KEY);
}

/** localStorage throws in some privacy modes; a tour is never worth a crash. */
export function safeStorage(): TourStorage {
  const noop: TourStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  if (typeof window === "undefined") return noop;
  try {
    const probe = window.localStorage;
    probe.getItem(TOUR_SEEN_KEY);
    return {
      getItem: (key) => {
        try {
          return probe.getItem(key);
        } catch {
          return null;
        }
      },
      setItem: (key, value) => {
        try {
          probe.setItem(key, value);
        } catch {
          /* storage unavailable: the walk just won't be remembered */
        }
      },
      removeItem: (key) => {
        try {
          probe.removeItem(key);
        } catch {
          /* storage unavailable: nothing was stored to remove */
        }
      },
    };
  } catch {
    return noop;
  }
}
