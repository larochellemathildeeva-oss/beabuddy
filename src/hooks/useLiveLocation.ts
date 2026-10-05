import { useSyncExternalStore } from "react";
import { HERE_STALE_MS, hereFix, locationTrouble, type HereFix } from "@/lib/live-location";

/**
 * "Where am I?" on the day maps, shared by every map on screen.
 *
 * Split draws one map per day, and switching layout swaps them for another:
 * turning it on in one turns it on in all of them, from one watch on the
 * phone's position rather than one per map. It is off until asked for on
 * each visit, nothing is stored, the position is not sent to Béa's server,
 * and the watch stops when the last map is closed, so it does not run the
 * battery down from another screen.
 */

export type LiveLocation = {
  on: boolean;
  /** A position has not arrived since it was turned on. */
  locating: boolean;
  fix: HereFix | null;
  /** No new position for a while: the dot is where the phone was, not is. */
  stale: boolean;
  error: string;
};

const OFF: LiveLocation = { on: false, locating: false, fix: null, stale: false, error: "" };

let snapshot: LiveLocation = OFF;
let watchId: number | null = null;
let staleTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
/** Read-only lookers: told of every change, never counted when deciding to stop the watch. */
const observers = new Set<() => void>();

function set(next: LiveLocation) {
  snapshot = next;
  for (const listener of listeners) listener();
  for (const observer of observers) observer();
}

function clearWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  if (staleTimer !== null) clearTimeout(staleTimer);
  staleTimer = null;
}

/** Marks the dot as old unless a new position arrives first. */
function armStale() {
  if (staleTimer !== null) clearTimeout(staleTimer);
  staleTimer = setTimeout(() => {
    staleTimer = null;
    if (snapshot.fix) set({ ...snapshot, stale: true });
  }, HERE_STALE_MS);
}

export function startLiveLocation() {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
    set({ ...OFF, error: "This device can't share its location." });
    return;
  }
  clearWatch();
  set({ on: true, locating: true, fix: null, stale: false, error: "" });
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      const fix = hereFix(pos.coords);
      if (!fix) return;
      set({ on: true, locating: false, fix, stale: false, error: "" });
      armStale();
    },
    (err) => {
      // A dropped reading once a position is known keeps the last one: a
      // tunnel is not a reason to lose the dot. It is shown as old, though,
      // until a new one arrives. A refusal always stops.
      if (err.code !== 1 && snapshot.fix) {
        if (!snapshot.stale) set({ ...snapshot, stale: true });
        return;
      }
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

function subscribeQuietly(listener: () => void) {
  observers.add(listener);
  return () => {
    observers.delete(listener);
  };
}

/**
 * The same reading for something that only looks at it, such as a marker on
 * the timeline. It never keeps the watch alive: when the last map or Now
 * panel is closed the watch stops, whoever is still looking.
 */
export function useLiveLocationReadOnly(): LiveLocation {
  return useSyncExternalStore(
    subscribeQuietly,
    () => snapshot,
    () => OFF,
  );
}
