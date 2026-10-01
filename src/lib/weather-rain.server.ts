import { rainUrl, readRain, roundCoord, type RainForecast } from "@/lib/weather";

/** Forecasts change through the day, but not by the minute. */
const RAIN_CACHE_MS = 60 * 60 * 1000;
const RAIN_CACHE_MAX = 500;
const rainCache = new Map<string, { at: number; forecast: RainForecast | null }>();

/**
 * The hour-by-hour chance of rain on one day at a position, from Open-Meteo.
 *
 * The position is rounded to about a kilometre; nothing about the traveller
 * is sent. Kept in memory for an hour, so Now and "Change a day" share one
 * answer. Null when Open-Meteo has no forecast for the day (it looks about 16
 * days ahead) or cannot answer.
 */
export async function rainForecastFor(
  lat: number,
  lon: number,
  day: string,
): Promise<RainForecast | null> {
  const key = `${roundCoord(lat)},${roundCoord(lon)},${day}`;
  const hit = rainCache.get(key);
  if (hit && Date.now() - hit.at < RAIN_CACHE_MS) return hit.forecast;
  let forecast: RainForecast | null = null;
  try {
    const res = await fetch(rainUrl(lat, lon, day), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      // A day beyond the forecast is a 400, and will stay one: keep that too.
      if (res.status !== 400) return null;
    } else {
      forecast = readRain(await res.json());
    }
  } catch {
    return null;
  }
  if (rainCache.size >= RAIN_CACHE_MAX) rainCache.delete(rainCache.keys().next().value!);
  rainCache.set(key, { at: Date.now(), forecast });
  return forecast;
}
