import { useEffect, useState } from "react";
import { lookupWeather } from "@/lib/weather.functions";
import { roundCoord, type Weather } from "@/lib/weather";

/** One question per place and page load: two modules about one town share it. */
const asked = new Map<string, Promise<Weather | null>>();

/**
 * The weather and clock now at a place (a trip's town, a bucket-list city),
 * from Open-Meteo through Béa's server, at a position rounded to about a
 * kilometre. Null until it answers, or when it cannot.
 */
export function usePlaceNow(lat: number | null | undefined, lon: number | null | undefined) {
  const [weather, setWeather] = useState<Weather | null>(null);
  const placed = typeof lat === "number" && typeof lon === "number";
  const rLat = placed ? roundCoord(lat) : null;
  const rLon = placed ? roundCoord(lon) : null;
  useEffect(() => {
    if (rLat === null || rLon === null) return;
    let live = true;
    const key = `${rLat},${rLon}`;
    let pending = asked.get(key);
    if (!pending) {
      pending = lookupWeather({ data: { lat: rLat, lon: rLon } }).catch(() => null);
      asked.set(key, pending);
      void pending.then((w) => {
        if (!w) asked.delete(key);
      });
    }
    void pending.then((w) => live && setWeather(w));
    return () => {
      live = false;
    };
  }, [rLat, rLon]);
  return placed ? weather : null;
}
