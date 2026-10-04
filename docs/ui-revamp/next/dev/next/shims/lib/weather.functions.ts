// Preview-only: the app asks Open-Meteo from its server; the preview asks it
// straight from the page (same URL, same reading), so the chips show real skies.
import { readWeather, weatherUrl } from "@/lib/weather";

export const lookupWeather = async ({
  data,
}: {
  data: { lat: number; lon: number };
}) => {
  try {
    const res = await fetch(weatherUrl(data.lat, data.lon), {
      headers: { accept: "application/json" },
    });
    return res.ok ? readWeather(await res.json()) : null;
  } catch {
    return null;
  }
};
export const lookupRain = async () => null;
