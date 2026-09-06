import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchPlaceHtml, UnsupportedPlaceUrlError } from "@/lib/place-url";
import { fuzzyQueryVariants, fuzzyRank } from "@/lib/fuzzy";

export type ParsedPlace = {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  lat?: number;
  lon?: number;
  source: string;
  url: string;
};

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function meta(html: string, key: string) {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${key}["']`, "i"),
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return undefined;
}

function coordsFromUrl(url: string): { lat: number; lon: number } | undefined {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: Number(at[1]), lon: Number(at[2]) };
  const bang = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: Number(bang[1]), lon: Number(bang[2]) };
  try {
    const u = new URL(url);
    const q = u.searchParams.get("query") || u.searchParams.get("q") || u.searchParams.get("ll");
    const m = q?.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
    if (m) return { lat: Number(m[1]), lon: Number(m[2]) };
  } catch {
    /* ignore */
  }
  return undefined;
}

const UA = "BeaTravelApp/1.0 (travel memory vault)";

async function reverse(lat: number, lon: number) {
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return {};
    const d = (await res.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    return {
      city: d.city || d.locality || d.principalSubdivision || undefined,
      country: d.countryName || undefined,
    };
  } catch {
    return {};
  }
}

type NominatimHit = {
  lat: string;
  lon: string;
  name?: string;
  display_name?: string;
  type?: string;
  category?: string;
  address?: Record<string, string>;
};

async function nominatim(q: string, limit: number): Promise<NominatimHit[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&namedetails=1&accept-language=en&limit=${limit}`,
      { headers: { "user-agent": UA, accept: "application/json", "accept-language": "en" }, signal: AbortSignal.timeout(5_000) },
    );
    if (!res.ok) return [];
    return (await res.json()) as NominatimHit[];
  } catch {
    return [];
  }
}

function hitToPlace(h: NominatimHit): ParsedPlace {
  const a = h.address ?? {};
  const parts = (h.display_name ?? "").split(", ");
  return {
    name: h.name || parts[0] || "Saved place",
    ...(h.display_name ? { address: h.display_name } : {}),
    ...(a["city"] || a["town"] || a["village"] || a["municipality"] || a["county"]
      ? { city: a["city"] || a["town"] || a["village"] || a["municipality"] || a["county"]! }
      : {}),
    ...(a["country"] ? { country: a["country"] } : {}),
    ...(h.type ? { category: h.type.replace(/_/g, " ") } : {}),
    lat: Number(h.lat),
    lon: Number(h.lon),
    source: "Web search",
    url: `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}`,
  };
}

/** Search the web for a place by name, so anything can be saved without a link. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ query: z.string().min(2).max(200) }).parse(data))
  .handler(async ({ data }): Promise<ParsedPlace[]> => {
    let hits: NominatimHit[] = [];
    for (const query of fuzzyQueryVariants(data.query)) {
      hits = await nominatim(query, 8);
      if (hits.length) break;
    }
    const places = hits.map(hitToPlace);
    return fuzzyRank(places, data.query, (place) => [place.name, place.address, place.city, place.country], 0);
  });


/** Pull a place out of a pasted link: title, address, category and coordinates. */
export const parsePlaceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().url() }).parse(data))
  .handler(async ({ data }): Promise<ParsedPlace> => {
    const target = new URL(data.url);

    let html = "";
    let finalUrl = target.toString();
    try {
      const fetched = await fetchPlaceHtml(data.url);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
    } catch (error) {
      if (error instanceof UnsupportedPlaceUrlError) throw error;
      /* fall through to URL-only parsing */
    }

    const placeName = (() => {
      const m = /\/place\/([^/@?]+)/.exec(data.url) ?? /\/place\/([^/@?]+)/.exec(finalUrl);
      return m?.[1] ? decodeURIComponent(m[1]).replace(/\+/g, " ").trim() : "";
    })();
    // Coordinates in the pasted link are trustworthy; ones that only appear after a
    // redirect are often the map site's own default view, not the place.
    const coords =
      coordsFromUrl(data.url) ?? (placeName ? undefined : coordsFromUrl(finalUrl));
    const place = coords ? await reverse(coords.lat, coords.lon) : {};

    const rawTitle =
      meta(html, "og:site_name") && meta(html, "og:title")
        ? meta(html, "og:title")!
        : (meta(html, "og:title") ??
          meta(html, "twitter:title") ??
          decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""));

    const name =
      (rawTitle || "")
        .split(/ [·|—–\-] /)[0]
        ?.replace(/\s*-\s*Google Maps$/i, "")
        .trim() || "Saved place";

    const description = meta(html, "og:description") ?? "";
    const addressMatch = description.match(/([\dA-Za-zÀ-ÿ.,'’\- ]+\d[\dA-Za-zÀ-ÿ.,'’\- ]*)/);

    // No coordinates in the link (short links, blocked pages): search the web by name.
    if (!coords) {
      const pathName = placeName;
      const query = pathName || (name !== "Saved place" ? name : "");
      const hit = query.length > 2 ? (await nominatim(query, 1))[0] : undefined;
      if (hit) {
        const found = hitToPlace(hit);
        return {
          ...found,
          name: pathName || (name !== "Saved place" ? name : found.name),
          source: target.hostname.replace(/^www\./, ""),
          url: data.url,
        };
      }
    }

    return {
      name,
      ...(addressMatch?.[1] ? { address: addressMatch[1].trim().slice(0, 160) } : {}),
      ...(place.city ? { city: place.city } : {}),
      ...(place.country ? { country: place.country } : {}),
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      source: target.hostname.replace(/^www\./, ""),
      url: data.url,
    };
  });


/** Look up the city and country for a set of coordinates. */
export const lookupCoords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).parse(data),
  )
  .handler(async ({ data }) => reverse(data.lat, data.lon));
