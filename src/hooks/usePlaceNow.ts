import { useEffect, useState } from "react";
import { lookupWeather } from "@/lib/weather.functions";
import { roundCoord, type Weather } from "@/lib/weather";

/** How long an answer stands for "now": then the place is asked again. */
const FRESH_MS = 15 * 60_000;

/** One question per place at a time: two modules about one town share it. */
const asked = new Map<string, { at: number; answer: Promise<Weather | null> }>();

function ask(key: string, lat: number, lon: number): Promise<Weather | null> {
  const kept = asked.get(key);
  if (kept && Date.now() - kept.at < FRESH_MS) return kept.answer;
  const answer = lookupWeather({ data: { lat, lon } }).catch(() => null);
  asked.set(key, { at: Date.now(), answer });
  void answer.then((w) => {
    // A failed answer is not kept: the next card to show asks again.
    if (!w && asked.get(key)?.answer === answer) asked.delete(key);
  });
  return answer;
}

export type PlaceNow =
  | { status: "unplaced" }
  | { status: "asking" }
  | { status: "unavailable" }
  | { status: "ready"; weather: Weather };

/**
 * The weather and clock now at a place (a trip's town, a bucket-list city),
 * from Open-Meteo through Béa's server, at a position rounded to about a
 * kilometre. An answer is only ever shown for the place it was asked about,
 * and is asked again after a quarter of an hour.
 */
export function usePlaceNow(
  lat: number | null | undefined,
  lon: number | null | undefined,
): PlaceNow {
  const placed = typeof lat === "number" && typeof lon === "number";
  const rLat = placed ? roundCoord(lat) : null;
  const rLon = placed ? roundCoord(lon) : null;
  const key = rLat === null || rLon === null ? null : `${rLat},${rLon}`;
  const [answer, setAnswer] = useState<{ key: string; weather: Weather | null } | null>(null);
  useEffect(() => {
    if (key === null || rLat === null || rLon === null) return;
    let live = true;
    const run = () => {
      void ask(key, rLat, rLon).then((weather) => live && setAnswer({ key, weather }));
    };
    run();
    const timer = window.setInterval(run, FRESH_MS);
    return () => {
      live = false;
      window.clearInterval(timer);
    };
  }, [key, rLat, rLon]);
  if (key === null) return { status: "unplaced" };
  if (!answer || answer.key !== key) return { status: "asking" };
  return answer.weather ? { status: "ready", weather: answer.weather } : { status: "unavailable" };
}
