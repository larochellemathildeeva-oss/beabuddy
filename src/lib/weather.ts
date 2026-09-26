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
