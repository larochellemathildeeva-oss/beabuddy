import { useLayoutEffect, useState } from "react";
import { getStored, setStored } from "@/lib/settings-storage";
import { asTripPicture, TRIP_PICTURE_KEY, type TripPicture } from "@/lib/trip-picture";

/** Stops or Photo on the trip banner: saved on this device. */
export function useTripPicture() {
  const [picture, setPicture] = useState<TripPicture>("stops");
  // Read before the first paint, so someone who chose Photo never sees the
  // map flash first.
  useLayoutEffect(() => {
    const read = () => setPicture(asTripPicture(getStored(TRIP_PICTURE_KEY)));
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === TRIP_PICTURE_KEY || e.key === null) read();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return [
    picture,
    (next: TripPicture) => {
      setPicture(next);
      setStored(TRIP_PICTURE_KEY, next);
    },
  ] as const;
}
