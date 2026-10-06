import { useSyncExternalStore } from "react";
import { getStored, setStored } from "@/lib/settings-storage";
import { asTripBanner, TRIP_BANNER_KEY, type TripBanner } from "@/lib/trip-banner";

// One value for the whole page, so the trip page follows a change at once.
let current: TripBanner | null = null;
const listeners = new Set<() => void>();

function snapshot(): TripBanner {
  if (current === null) current = asTripBanner(getStored(TRIP_BANNER_KEY));
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === TRIP_BANNER_KEY || e.key === null) {
      current = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setTripBanner(next: TripBanner) {
  current = next;
  setStored(TRIP_BANNER_KEY, next);
  listeners.forEach((l) => l());
}

/** The trip banner's look: saved on this device. */
export function useTripBanner(): [TripBanner, (next: TripBanner) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => "mine" as const);
  return [value, setTripBanner];
}
