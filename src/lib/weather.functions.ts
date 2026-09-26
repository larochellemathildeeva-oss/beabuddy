import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rainUrl,
  readRain,
  readWeather,
  roundCoord,
  weatherUrl,
  type RainForecast,
} from "@/lib/weather";

/**
 * The weather at a position, for Home.
 *
 * Asked from Béa's server rather than the browser, so Open-Meteo sees Béa and
 * a rounded position rather than your device. Nothing here is stored.
 */
export const lookupWeather = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).parse(data),
  )
  .handler(async ({ data }) => {
    try {
      const res = await fetch(weatherUrl(data.lat, data.lon), {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(5_000),
      });
      if (!res.ok) return null;
      return readWeather(await res.json());
    } catch {
      return null;
    }
  });

/** Forecasts change through the day, but not by the minute. */
const RAIN_CACHE_MS = 60 * 60 * 1000;
const RAIN_CACHE_MAX = 500;
const rainCache = new Map<string, { at: number; forecast: RainForecast | null }>();

/**
 * The hour-by-hour chance of rain on one trip day, for Companion.
 *
 * The position is a stop's pin, rounded to about a kilometre, and the day is
 * the trip's; nothing about you is sent. Kept in memory for an hour, so a
 * day's travellers opening Now do not each ask again. Null when Open-Meteo
 * has no forecast for the day (it looks about 16 days ahead) or cannot answer.
 */
export const lookupRain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        lat: z.number().gte(-90).lte(90),
        lon: z.number().gte(-180).lte(180),
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<RainForecast | null> => {
    const key = `${roundCoord(data.lat)},${roundCoord(data.lon)},${data.day}`;
    const hit = rainCache.get(key);
    if (hit && Date.now() - hit.at < RAIN_CACHE_MS) return hit.forecast;
    let forecast: RainForecast | null = null;
    try {
      const res = await fetch(rainUrl(data.lat, data.lon, data.day), {
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
  });
