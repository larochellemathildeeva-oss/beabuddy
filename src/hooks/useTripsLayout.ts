import { useLayoutEffect, useState } from "react";
import { getStored, setStored } from "@/lib/settings-storage";
import { asTripsLayout, TRIPS_LAYOUT_KEY, type TripsLayout } from "@/lib/trips-page";

/** Big banner or List on the Trips tab: saved on this device. */
export function useTripsLayout() {
  const [layout, setLayout] = useState<TripsLayout>("big");
  // Read before the first paint, so someone who chose List never sees the
  // banner flash first.
  useLayoutEffect(() => {
    const read = () => setLayout(asTripsLayout(getStored(TRIPS_LAYOUT_KEY)));
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRIPS_LAYOUT_KEY || e.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [
    layout,
    (next: TripsLayout) => {
      setLayout(next);
      setStored(TRIPS_LAYOUT_KEY, next);
    },
  ] as const;
}
