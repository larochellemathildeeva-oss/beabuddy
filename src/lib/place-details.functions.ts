import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { geoapifyStaticMapUrl, type PlaceFacts } from "@/lib/geoapify";
import type { PlacePhoto } from "@/lib/wikimedia";

/**
 * What a stop or a rec is like to visit — hours, website, phone, access,
 * from Geoapify, and a photo from Pexels when one names the place, else from
 * Wikimedia Commons when the place names one
 * — and a picture of a day's map for offline.
 *
 * The key is read on the server only (geo-provider.server.ts, imported
 * lazily): this file ships to the browser. Without Geoapify configured both
 * answer null and the app shows what it did before.
 */

const UA = "BeaTravelApp/1.0 (travel memory vault)";
const point = { lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) };

export type PlaceDetails = Omit<PlaceFacts, "names" | "commons"> & { photo?: PlacePhoto };

export const placeDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { lat: number; lon: number; name: string }) =>
    z.object({ ...point, name: z.string().trim().min(1).max(200) }).parse(data),
  )
  .handler(async ({ data, context }): Promise<PlaceDetails | null> => {
    const { geoProvider } = await import("@/lib/geo-provider.server");
    const provider = geoProvider();
    let facts: PlaceFacts | null = null;
    if (provider.name === "geoapify") {
      const { placeFactsFor } = await import("@/lib/place-facts.server");
      facts = await placeFactsFor(provider.token, data);
    }
    // Pexels first (a photo whose description names the place), then Commons.
    // Pexels needs only the stop's name, so it is asked even when the map
    // cannot confirm the place at the pin — otherwise most stops, which the
    // map does not know by name, would never get a photo.
    const { pexelsPlacePhoto } = await import("@/lib/pexels.server");
    let photo = await pexelsPlacePhoto(context.userId, [
      data.name,
      ...(facts?.name ? [facts.name] : []),
      ...(facts?.names ?? []),
    ]);
    if (!photo && facts?.commons) {
      const { commonsPhotoFor } = await import("@/lib/wikimedia.server");
      photo = await commonsPhotoFor(facts.commons);
    }
    if (!facts) return photo ? { photo } : null;
    return {
      ...(facts.name ? { name: facts.name } : {}),
      ...(facts.openingHours ? { openingHours: facts.openingHours } : {}),
      ...(facts.website ? { website: facts.website } : {}),
      ...(facts.phone ? { phone: facts.phone } : {}),
      ...(facts.wheelchair ? { wheelchair: facts.wheelchair } : {}),
      ...(photo ? { photo } : {}),
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

/**
 * A photo of a trip's town, for its banner when the traveller chose real
 * photos and has none of their own: from Pexels when PEXELS_API_KEY is set and
 * a photo names the town, else from Wikimedia Commons (keyless). Never
 * Geoapify, so it costs no credit.
 */
export const townPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { city: string; country?: string | null }) =>
    z
      .object({
        city: z.string().trim().min(1).max(200),
        country: z.string().trim().max(100).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }): Promise<PlacePhoto | null> => {
    const { pexelsTownPhoto } = await import("@/lib/pexels.server");
    const pexels = await pexelsTownPhoto(context.userId, data.city, data.country);
    if (pexels) return pexels;
    const { townPhotoFor } = await import("@/lib/wikimedia.server");
    return townPhotoFor(data.city, data.country);
  });
