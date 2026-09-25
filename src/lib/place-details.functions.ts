import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geoapifyStaticMapUrl, type PlaceFacts } from "@/lib/geoapify";

/**
 * What a stop or a rec is like to visit — hours, website, phone, access —
 * and a picture of a day's map for offline, both from Geoapify.
 *
 * The key is read on the server only (geo-provider.server.ts, imported
 * lazily): this file ships to the browser. Without Geoapify configured both
 * answer null and the app shows what it did before.
 */

const UA = "BeaTravelApp/1.0 (travel memory vault)";
const point = { lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) };

export type PlaceDetails = Omit<PlaceFacts, "names">;

export const placeDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lat: number; lon: number; name: string }) =>
    z.object({ ...point, name: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data }): Promise<PlaceDetails | null> => {
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();
    if (provider.name !== "geoapify") return null;
    const { placeFactsFor } = await import("@/lib/place-facts.server");
    const facts = await placeFactsFor(provider.token, data);
    if (!facts) return null;
    return {
      ...(facts.name ? { name: facts.name } : {}),
      ...(facts.openingHours ? { openingHours: facts.openingHours } : {}),
      ...(facts.website ? { website: facts.website } : {}),
      ...(facts.phone ? { phone: facts.phone } : {}),
      ...(facts.wheelchair ? { wheelchair: facts.wheelchair } : {}),
    };
  });

/**
 * One day's map as an image, for keeping on the phone with the directions.
 * Returned as a data URL so the browser can store it without ever seeing the
 * key. Null when Geoapify isn't configured or the picture didn't come back.
 */
export const dayMapImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { points: { lat: number; lon: number }[] }) =>
    z.object({ points: z.array(z.object(point)).min(1).max(30) }).parse(data),
  )
  .handler(async ({ data }): Promise<string | null> => {
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();
    if (provider.name !== "geoapify") return null;
    try {
      const res = await fetch(geoapifyStaticMapUrl(provider.token, data.points), {
        headers: { "user-agent": UA, accept: "image/jpeg,image/*" },
        signal: AbortSignal.timeout(10_000),
      });
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.startsWith("image/")) return null;
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > 1_500_000) return null;
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      return `data:${type.split(";")[0]};base64,${btoa(binary)}`;
    } catch {
      return null;
    }
  });
