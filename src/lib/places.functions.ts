import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPastedPlaceLink } from "@/lib/place-paste";
import { fetchPlaceHtml, UnsupportedPlaceUrlError, type FetchFailure } from "@/lib/place-url";
import { geocodeIsTrustworthy, queryIsLocatable } from "@/lib/geocode-trust";
import { fuzzyQueryVariants, fuzzyRank } from "@/lib/fuzzy";
import { placeFromNominatim, refineNominatimHits, type NominatimHitLike } from "@/lib/place-label";
import {
  cleanPageTitle,
  placePathSegment,
  resolvePlaceCoords,
  splitPlacePathName,
} from "@/lib/place-link";
import { localPlaceHits } from "@/lib/world-countries";

export type ParsedPlace = {
  name: string;
  address?: string;
  city?: string;
  country?: string;
  category?: string;
  /** Nominatim's `type`, used to work out what kind of stop this is. */
  placeType?: string;
  lat?: number;
  lon?: number;
  source: string;
  url: string;
  /**
   * Set when a link gave up nothing useful — a short link the page would not
   * resolve for us, or a site that serves nothing to a bot. The caller should
   * say so rather than presenting an empty draft as a successful read.
   */
  partial?: boolean;
  /**
   * Why it gave up nothing, when `partial` is set. The interface needs this to
   * say something true: telling someone to paste a longer link is useless when
   * the page was never reached, and telling them the site shared nothing is
   * wrong when the request itself failed.
   */
  partialReason?: PartialReason;
};

/**
 * `unreachable`  the request did not complete — network, TLS, timeout, or a
 *                server with no outbound access at all.
 * `refused`      the page answered, but not with a page: 403, 404, a login
 *                wall, a redirect chain that ran out.
 * `no-details`   the page was read fine and simply carries no place in it.
 */
export type PartialReason = "unreachable" | "refused" | "no-details";

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

function nameFromAppleMapsUrl(url: string): string | undefined {
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    if (host !== "maps.apple.com" && !host.endsWith(".maps.apple.com")) return undefined;
    const q =
      new URL(url).searchParams.get("name") ||
      new URL(url).searchParams.get("address") ||
      new URL(url).searchParams.get("q");
    const cleaned = q?.trim();
    if (!cleaned || cleaned.length < 2 || cleaned.length > 120) return undefined;
    // Coordinate-only q= is not a place name.
    if (/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/.test(cleaned)) return undefined;
    return cleaned;
  } catch {
    return undefined;
  }
}

const ParsePlaceLinkInput = z.object({
  url: z.string().min(1).max(4000),
  nameHint: z.string().min(1).max(120).optional(),
});

function normalizePlaceLinkInput(data: unknown): { url: string; nameHint?: string } {
  const raw = ParsePlaceLinkInput.parse(data);
  const extracted = extractPastedPlaceLink(raw.url);
  if (!extracted) {
    throw new z.ZodError([
      {
        code: "custom",
        path: ["url"],
        message: "Paste a Maps, Yelp, or place link.",
      },
    ]);
  }
  const hint = raw.nameHint?.trim() || extracted.nameHint;
  return hint ? { url: extracted.url, nameHint: hint } : { url: extracted.url };
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

type NominatimHit = NominatimHitLike;

async function nominatim(q: string, limit: number): Promise<NominatimHit[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=jsonv2&addressdetails=1&namedetails=1&accept-language=en&limit=${limit}`,
      {
        headers: { "user-agent": UA, accept: "application/json", "accept-language": "en" },
        signal: AbortSignal.timeout(5_000),
      },
    );
    if (!res.ok) return [];
    return (await res.json()) as NominatimHit[];
  } catch {
    return [];
  }
}

function hitToPlace(h: NominatimHit): ParsedPlace {
  const found = placeFromNominatim(h);
  return {
    ...found,
    source: "Web search",
    url: `https://www.openstreetmap.org/?mlat=${h.lat}&mlon=${h.lon}`,
  };
}

/** Search the web for a place by name, so anything can be saved without a link. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ query: z.string().min(2).max(200) }).parse(data))
  .handler(async ({ data }): Promise<ParsedPlace[]> => {
    const local = localPlaceHits(data.query);
    if (local.length) return local;
    let hits: NominatimHit[] = [];
    for (const query of fuzzyQueryVariants(data.query)) {
      hits = await nominatim(query, 10);
      if (hits.length) break;
    }
    const refined = refineNominatimHits(hits, data.query);
    const places = (refined.length ? refined : hits).map(hitToPlace);
    return fuzzyRank(
      places,
      data.query,
      (place) => [place.name, place.address, place.city, place.country],
      0,
    );
  });

/** Pull a place out of a pasted link: title, address, category and coordinates. */
export const parsePlaceLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => normalizePlaceLinkInput(data))
  .handler(async ({ data }): Promise<ParsedPlace> => {
    const target = new URL(data.url);

    let html = "";
    let finalUrl = target.toString();
    let failure: FetchFailure | undefined;
    try {
      const fetched = await fetchPlaceHtml(data.url);
      html = fetched.html;
      finalUrl = fetched.finalUrl;
      failure = fetched.failure;
    } catch (error) {
      if (error instanceof UnsupportedPlaceUrlError) throw error;
      // Nothing below needs the page, so carry on with URL-only parsing — but
      // remember that the read failed, so the message can say which it was.
      failure = "unreachable";
    }

    // Google puts the name and often the street address in one path segment.
    const fromPath = splitPlacePathName(placePathSegment(data.url) || placePathSegment(finalUrl));
    const placeName = fromPath.name;
    const coords = resolvePlaceCoords(data.url, finalUrl, Boolean(placeName));
    const place = coords ? await reverse(coords.lat, coords.lon) : {};

    const rawTitle =
      meta(html, "og:site_name") && meta(html, "og:title")
        ? meta(html, "og:title")!
        : (meta(html, "og:title") ??
          meta(html, "twitter:title") ??
          decodeEntities(html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ?? ""));

    const titleName = cleanPageTitle(rawTitle || "");

    const appleName = nameFromAppleMapsUrl(data.url) ?? nameFromAppleMapsUrl(finalUrl);
    const name = placeName || titleName || data.nameHint || appleName || "Saved place";

    const description = meta(html, "og:description") ?? "";
    const addressMatch = description.match(/([\dA-Za-zÀ-ÿ.,'’\- ]+\d[\dA-Za-zÀ-ÿ.,'’\- ]*)/);

    // The path address is the place's own; the og:description one is a guess
    // pulled out of prose, so it only fills a gap.
    const address =
      fromPath.address ?? (addressMatch?.[1] ? addressMatch[1].trim().slice(0, 160) : undefined);

    // No coordinates in the link (a blocked page, a short link that would not
    // resolve): the name and address can be looked up instead — but only when
    // the query actually says *where*.
    //
    // This used to search on whatever it had and keep the first worldwide
    // result. A link to a Harvey's in Montreal carries the name and nothing
    // else, the top global hit for "Harvey's" is in Slovakia, and that was
    // saved with a city, a country and coordinates, looking exactly like a
    // place Béa knew. An empty map is obviously empty; "Slovakia" looks like
    // an answer, which makes it the worse failure by far.
    if (!coords) {
      const named = name !== "Saved place" ? name : "";
      const searchName = placeName || named || data.nameHint || appleName || "";
      const locatable = queryIsLocatable({ name: searchName, address });
      const query = [searchName, address].filter(Boolean).join(", ");
      const hit = locatable && query.length > 2 ? (await nominatim(query, 1))[0] : undefined;
      const found = hit ? hitToPlace(hit) : undefined;
      // And the answer has to look like the question: Nominatim always returns
      // its best effort, never nothing, so an unmatched query still comes back
      // with a place attached.
      if (found && geocodeIsTrustworthy({ name: searchName, address, hitName: found.name })) {
        return {
          ...found,
          name: searchName || found.name,
          ...(address ? { address } : {}),
          source: target.hostname.replace(/^www\./, ""),
          url: data.url,
        };
      }
      // Otherwise fall through: keep the name and the link, leave the map
      // empty. Every add form already offers a map search to finish the job.
    }

    // Nothing but the URL came back: no name of its own, nowhere on the map.
    const gotNothing = name === "Saved place" && !coords && !address;
    const partialReason: PartialReason =
      failure === "unreachable" || failure === "bad-url"
        ? "unreachable"
        : failure === "http-error" || failure === "blocked-host"
          ? "refused"
          : "no-details";

    return {
      name,
      ...(address ? { address } : {}),
      ...(place.city ? { city: place.city } : {}),
      ...(place.country ? { country: place.country } : {}),
      ...(coords ? { lat: coords.lat, lon: coords.lon } : {}),
      source: target.hostname.replace(/^www\./, ""),
      url: data.url,
      ...(gotNothing ? { partial: true, partialReason } : {}),
    };
  });

/** Look up the city and country for a set of coordinates. */
export const lookupCoords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).parse(data),
  )
  .handler(async ({ data }) => reverse(data.lat, data.lon));
