import { useEffect, useSyncExternalStore } from "react";
import {
  applyStopPictures,
  asStopPictures,
  STOP_PICTURES_KEY,
  type StopPictures,
} from "@/lib/stop-pictures";

// One value for the whole page, so every picture follows a change at once.
let current: StopPictures | null = null;
const listeners = new Set<() => void>();

function snapshot(): StopPictures {
  if (current === null) {
    try {
      current = asStopPictures(window.localStorage.getItem(STOP_PICTURES_KEY));
    } catch {
      current = "illustrations";
    }
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setStopPictures(next: StopPictures) {
  current = next;
  applyStopPictures(next, document.documentElement);
  try {
    window.localStorage.setItem(STOP_PICTURES_KEY, next);
  } catch {
    /* private mode: kept for this visit */
  }
  listeners.forEach((l) => l());
}

/** The stop-pictures setting, applied to the page and saved on change. */
export function useStopPictures(): [StopPictures, (next: StopPictures) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => "illustrations" as const);
  useEffect(() => {
    applyStopPictures(value, document.documentElement);
  }, [value]);
  return [value, setStopPictures];
}
