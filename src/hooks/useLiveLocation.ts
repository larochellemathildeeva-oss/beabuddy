import { useSyncExternalStore } from "react";
import { hereFix, locationTrouble, type HereFix } from "@/lib/live-location";

/**
 * "Where am I?" on the day maps, shared by every map on screen.
 *
 * Split draws one map per day, and switching layout swaps them for another:
 * turning it on in one turns it on in all of them, from one watch on the
 * phone's position rather than one per map. It is off until asked for on
 * each visit, nothing is stored, nothing is sent to Béa's server, and the
 * watch stops when the last map is closed, so it does not run the battery
 * down from another screen.
 */

export type LiveLocation = {
  on: boolean;
  /** A position has not arrived since it was turned on. */
  locating: boolean;
  fix: HereFix | null;
  error: string;
};

const OFF: LiveLocation = { on: false, locating: false, fix: null, error: "" };

let snapshot: LiveLocation = OFF;
let watchId: number | null = null;
const listeners = new Set<() => void>();

function set(next: LiveLocation) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function clearWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

export function startLiveLocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({ ...OFF, error: "This device can't share its location." });
    return;
  }
  clearWatch();
  set({ on: true, locating: true, fix: null, error: "" });
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const fix = hereFix(pos.coords);
      if (fix) set({ on: true, locating: false, fix, error: "" });
    },
    (err) => {
      // A dropped reading once a position is known keeps the last one: a
      // tunnel is not a reason to lose the dot. A refusal always stops.
      if (err.code !== 1 && snapshot.fix) return;
      clearWatch();
      const framed = typeof window !== "undefined" && window.self !== window.top;
      set({ ...OFF, error: locationTrouble(err.code, framed) });
    },
    { enableHighAccuracy: true, timeout: 20_000, maximumAge: 10_000 },
  );
}

export function stopLiveLocation() {
  clearWatch();
  set(OFF);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    // Deferred, because a layout switch unmounts one map just before it
    // mounts the next, and that is not closing the map.
    setTimeout(() => {
      if (listeners.size === 0 && snapshot !== OFF) stopLiveLocation();
    }, 0);
  };
}

export function useLiveLocation(): LiveLocation {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => OFF,
  );
}
