import type { RainForecast, Weather } from "@/lib/weather";

/** A fixed sky for every place, so the weather modules have something to show. */
export const lookupWeather = async (_: { data: { lat: number; lon: number } }): Promise<Weather> => ({
  temp: 18,
  feelsLike: 17,
  high: 21,
  low: 12,
  code: 2,
  isDay: true,
  utcOffset: 7200,
});

export const lookupRain = async (_: unknown): Promise<RainForecast | null> => null;
