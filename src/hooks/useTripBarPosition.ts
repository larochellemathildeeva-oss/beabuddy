import { useEffect, useState } from "react";
import { getStored, setStored } from "@/lib/settings-storage";

export const TRIP_BAR_KEY = "bea-trip-tabs";
export const BAR_POSITIONS = ["top", "bottom", "side"] as const;
export type TripBarPosition = (typeof BAR_POSITIONS)[number];
/** A device preference, deliberately separate from the account's view switches. */
export function useTripBarPosition() {
  const [position, setPosition] = useState<TripBarPosition>("top");
  useEffect(() => {
    const read = () => {
      const raw = getStored(TRIP_BAR_KEY);
      setPosition(BAR_POSITIONS.find((p) => p === raw) ?? "top");
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRIP_BAR_KEY || e.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [
    position,
    (next: TripBarPosition) => {
      setPosition(next);
      setStored(TRIP_BAR_KEY, next);
    },
  ] as const;
}
