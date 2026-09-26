/**
 * The weather where you are, for Home.
 *
 * Open-Meteo answers it: keyless, no account, and nothing to reserve against
 * a daily ceiling. The position is rounded to two decimals — about a
 * kilometre — before it leaves Béa's server, because the weather does not
 * change across a street and there is no reason to send more than it needs.
 * Pure, so the URL, the reading of the answer and the words are tested.
 */

export const WEATHER_ATTRIBUTION = "Weather data by Open-Meteo.com";

export type Weather = {
  /** °C, rounded. */
  temp: number;
  /** °C, rounded; how warm it feels, when Open-Meteo says. */
  feelsLike: number | null;
  high: number | null;
  low: number | null;
  /** WMO weather interpretation code. */
  code: number;
  isDay: boolean;
};

/** About a kilometre: enough for the weather, no more. */
export function roundCoord(n: number): number {
  return Math.round(n * 100) / 100;
}

export function weatherUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    current: "temperature_2m,apparent_temperature,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "1",
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

/** Open-Meteo's answer as a `Weather`, or null when it has no current reading. */
export function readWeather(body: unknown): Weather | null {
  if (!body || typeof body !== "object") return null;
  const b = body as {
    current?: Record<string, unknown>;
    daily?: Record<string, unknown>;
  };
  const temp = num(b.current?.["temperature_2m"]);
  const code = num(b.current?.["weather_code"]);
  if (temp === null || code === null) return null;
  const first = (key: string) => {
    const list = b.daily?.[key];
    return Array.isArray(list) ? num(list[0]) : null;
  };
  return {
    temp,
    feelsLike: num(b.current?.["apparent_temperature"]),
    high: first("temperature_2m_max"),
    low: first("temperature_2m_min"),
    code,
    isDay: b.current?.["is_day"] !== 0,
  };
}

export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "rain" | "snow" | "storm";

/** WMO codes, in the words someone would use looking out of a window. */
export function describeWeather(code: number): { label: string; kind: WeatherKind } {
  if (code === 0) return { label: "Clear", kind: "clear" };
  if (code === 1) return { label: "Mostly clear", kind: "partly" };
  if (code === 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Overcast", kind: "cloudy" };
  if (code === 45 || code === 48) return { label: "Fog", kind: "fog" };
  if (code >= 51 && code <= 57) return { label: "Drizzle", kind: "rain" };
  if (code >= 61 && code <= 67) return { label: code >= 65 ? "Heavy rain" : "Rain", kind: "rain" };
  if (code >= 71 && code <= 77) return { label: "Snow", kind: "snow" };
  if (code >= 80 && code <= 82) return { label: "Showers", kind: "rain" };
  if (code === 85 || code === 86) return { label: "Snow showers", kind: "snow" };
  if (code >= 95) return { label: "Thunderstorms", kind: "storm" };
  return { label: "Cloudy", kind: "cloudy" };
}

/** The handful of countries that read the temperature in Fahrenheit. */
const FAHRENHEIT_REGIONS = new Set(["US", "LR", "MM", "BS", "KY", "PW", "FM", "MH"]);

export function usesFahrenheit(locale: string | undefined): boolean {
  const region = locale?.split(/[-_]/)[1]?.toUpperCase();
  return Boolean(region && FAHRENHEIT_REGIONS.has(region));
}

/** "18°" in Celsius, or "64°" when the locale reads Fahrenheit. */
export function formatTemp(celsius: number, fahrenheit: boolean): string {
  return `${Math.round(fahrenheit ? (celsius * 9) / 5 + 32 : celsius)}°`;
}

/**
 * Rain on a trip day, for Companion.
 *
 * Asked for the day's own place and date, not where the phone is: you may not
 * be there yet. Open-Meteo's hours are local to the place (`timezone=auto`),
 * and the phone's clock may be in another zone, so "now" is worked out from
 * the offset it sends back rather than from the phone's hours.
 */

/** A chance of rain at or above this is worth a word. */
export const RAIN_LIKELY = 60;

/** Waking hours at the place; rain at 3am changes nobody's plans. */
const RAIN_FIRST_HOUR = 7;
const RAIN_LAST_HOUR = 22;

export function rainUrl(lat: number, lon: number, day: string): string {
  const params = new URLSearchParams({
    latitude: String(roundCoord(lat)),
    longitude: String(roundCoord(lon)),
    hourly: "precipitation_probability",
    timezone: "auto",
    start_date: day,
    end_date: day,
  });
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`;
}

export type RainForecast = {
  /** Hours at the place, "YYYY-MM-DDTHH:MM", with the chance of rain in %. */
  hours: { time: string; chance: number }[];
  /** The place's offset from UTC, in seconds. */
  utcOffsetSeconds: number;
};

/** Open-Meteo's hourly answer as a `RainForecast`, or null when it has none. */
export function readRain(body: unknown): RainForecast | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { hourly?: Record<string, unknown>; utc_offset_seconds?: unknown };
  const times = b.hourly?.["time"];
  const chances = b.hourly?.["precipitation_probability"];
  if (!Array.isArray(times) || !Array.isArray(chances)) return null;
  const hours: RainForecast["hours"] = [];
  times.forEach((time, i) => {
    const chance = num(chances[i]);
    if (typeof time === "string" && chance !== null) hours.push({ time, chance });
  });
  if (!hours.length) return null;
  const offset = b.utc_offset_seconds;
  return {
    hours,
    utcOffsetSeconds: typeof offset === "number" && Number.isFinite(offset) ? offset : 0,
  };
}

export type RainNotice = {
  /** "16:00": the first rainy hour still ahead. */
  from: string;
  /** "19:00": when that spell is forecast to ease, or null if it runs past the evening. */
  until: string | null;
  /** The highest chance in the spell, in %. */
  chance: number;
};

/**
 * The next spell of likely rain on `day`, still ahead of `now` at the place.
 * Null when the day looks dry, is over, or the forecast does not cover it.
 */
export function rainNotice(forecast: RainForecast, day: string, now: Date): RainNotice | null {
  // The clock at the place, as Open-Meteo writes it: "YYYY-MM-DDTHH".
  const placeNow = new Date(now.getTime() + forecast.utcOffsetSeconds * 1000)
    .toISOString()
    .slice(0, 13);
  const ahead = forecast.hours.filter((h) => {
    const hour = Number(h.time.slice(11, 13));
    return (
      h.time.startsWith(`${day}T`) &&
      h.time.slice(0, 13) >= placeNow &&
      hour >= RAIN_FIRST_HOUR &&
      hour <= RAIN_LAST_HOUR
    );
  });
  const start = ahead.findIndex((h) => h.chance >= RAIN_LIKELY);
  if (start < 0) return null;
  let end = start;
  while (end + 1 < ahead.length && ahead[end + 1]!.chance >= RAIN_LIKELY) end++;
  const spell = ahead.slice(start, end + 1);
  const next = ahead[end + 1];
  return {
    from: spell[0]!.time.slice(11, 16),
    until: next ? next.time.slice(11, 16) : null,
    chance: Math.max(...spell.map((h) => h.chance)),
  };
}

/** "Rain likely from 16:00 to 19:00 (80%). Worth packing a layer." */
export function rainLine(notice: RainNotice): string {
  const when = notice.until ? `from ${notice.from} to ${notice.until}` : `from ${notice.from}`;
  return `Rain likely ${when} (${notice.chance}%). Worth packing a layer.`;
}
