import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { readWeather, weatherUrl } from "@/lib/weather";

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
