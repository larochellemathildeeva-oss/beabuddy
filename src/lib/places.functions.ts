import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractPastedPlaceLink } from "@/lib/place-paste";
import { fetchPlaceHtml, UnsupportedPlaceUrlError, type FetchFailure } from "@/lib/place-url";
import { geocodeIsTrustworthy, queryIsLocatable } from "@/lib/geocode-trust";
import { fuzzyQueryVariants, fuzzyRank } from "@/lib/fuzzy";
import {
  placeFromNominatim,
  refineNominatimHits,
  isVenueHit,
  type NominatimHitLike,
} from "@/lib/place-label";
import {
  cleanPageTitle,
  placePathSegment,
  resolvePlaceCoords,
  splitPlacePathName,
} from "@/lib/place-link";
import { localPlaceHits } from "@/lib/world-countries";
import { reverseUrl, searchUrl, viewboxAround, classifyGeoStatus } from "@/lib/geo-endpoints";
import { mapsPlaceUrl } from "@/lib/direction-stops";

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
  /**
   * The name is good but Béa could not put it on the map — no coordinates in
   * the link, and nothing locating enough to look up safely. The caller should
   * say so: an empty map with no explanation is what let a wrong location go
   * unnoticed in the first place.
   */
  unlocated?: boolean;
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
  addressHint: z.string().min(1).max(200).optional(),
});

function normalizePlaceLinkInput(data: unknown): {
  url: string;
  nameHint?: string;
  addressHint?: string;
} {
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
  // The address the share sheet printed above the link is the strongest
  // locating signal Béa gets for a short link, and it costs nothing.
  const addressHint = raw.addressHint?.trim() || extracted.addressHint;
  return {
    url: extracted.url,
    ...(hint ? { nameHint: hint } : {}),
    ...(addressHint ? { addressHint } : {}),
  };
}

const UA = "BeaTravelApp/1.0 (travel memory vault)";

/**
 * Coordinates to a city and a country, through the same provider as the rest.
 *
 * This used to call BigDataCloud — a third company doing a job both of the
 * other two already do, with its own terms and its own outage. The address
 * object comes back with the locality under whichever of several keys fits
 * the country, which is why the fallback chain is long rather than fussy: a
 * hamlet, a town and a city are all "where you are".
 */
async function reverse(lat: number, lon: number) {
  const { geoProvider } = await import("@/lib/geo-provider.server");
  try {
    const res = await fetch(reverseUrl(geoProvider(), lat, lon), {
      headers: { "user-agent": UA, accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return {};
    const d = (await res.json()) as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        hamlet?: string;
        municipality?: string;
        suburb?: string;
        state?: string;
        country?: string;
      };
    };
    const a = d.address ?? {};
    return {
      city: a.city || a.town || a.village || a.municipality || a.hamlet || a.suburb || a.state,
      country: a.country,
    };
  } catch {
    return {};
  }
}

type NominatimHit = NominatimHitLike;

/**
 * A geocoder hiccup is not "no such place".
 *
 * Returning [] on every non-200 made a rate limit, an outage and a real miss
 * look identical — Recs said nothing matched while Nominatim was refusing the
 * request. Throw on anything that should be retried so the search box can say
 * the map was unreachable; only a clean empty answer means the name is gone.
 */
async function nominatim(
  q: string,
  limit: number,
  area?: { viewbox: string; bounded: boolean },
): Promise<NominatimHit[]> {
  // Server-only: the token must not be compiled into the client bundle.
  const { geoProvider } = await import("@/lib/geo-provider.server");
  const { PUBLIC_PROVIDER } = await import("@/lib/geo-endpoints");
  const provider = geoProvider();
  const options = {
    query: q,
    limit,
    format: "jsonv2" as const,
    addressDetails: true,
    nameDetails: true,
    language: "en",
    ...(area ? { viewbox: area.viewbox, bounded: area.bounded } : {}),
  };

  let res = await fetch(searchUrl(provider, options), {
    headers: { "user-agent": UA, accept: "application/json", "accept-language": "en" },
    signal: AbortSignal.timeout(5_000),
  });
  // A bad or rejected LocationIQ request must not look like "no such place".
  // Fall back to the public endpoint once so Recs keeps answering.
  if (!res.ok && provider.name === "locationiq") {
    res = await fetch(searchUrl(PUBLIC_PROVIDER, options), {
      headers: { "user-agent": UA, accept: "application/json", "accept-language": "en" },
      signal: AbortSignal.timeout(5_000),
    });
  }
  const verdict = classifyGeoStatus(res.status);
  if (verdict === "retry" || res.status === 401 || res.status === 403) {
    throw new Error(`Geocoder temporarily unavailable (${res.status})`);
  }
  if (verdict !== "ok") return [];
  const json = (await res.json()) as NominatimHit[];
  return Array.isArray(json) ? json : [];
}

function hitToPlace(h: NominatimHit): ParsedPlace {
  const found = placeFromNominatim(h);
  return {
    ...found,
    source: "Web search",
    // Saved on the recommendation and tapped months later, so it wants to
    // open the phone's maps app rather than the OpenStreetMap website. The
    // data still comes from OSM; this is only where the link goes.
    url: mapsPlaceUrl(found.name, { lat: found.lat, lon: found.lon }),
  };
}

/**
 * Run the typed name and its typo / possessive forms against the geocoder.
 *
 * When looking nearby, keep going after a street or park hit so a later
 * possessive variant can still find the shop — "harvey" hits Rue Harvey
 * (highway) before Harvey's (amenity). Around the world, the first non-empty
 * answer is enough; unique landmarks should not wait on extras.
 */
async function nominatimVariants(
  query: string,
  area?: { viewbox: string; bounded: boolean },
): Promise<NominatimHit[]> {
  let fallback: NominatimHit[] = [];
  for (const variant of fuzzyQueryVariants(query)) {
    const batch = await nominatim(variant, 10, area);
    if (!batch.length) continue;
    if (!area) return batch;
    const venues = batch.filter(isVenueHit);
    if (venues.length) return venues;
    if (!fallback.length) fallback = batch;
  }
  return fallback;
}

/** Search the web for a place by name, so anything can be saved without a link. */
export const searchPlaces = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        query: z.string().min(2).max(200),
        /**
         * Where the person is, so a search for a chain finds the branch they
         * mean. "Subway" is thousands of identical places and an unanchored
         * lookup answers with one on another continent, or with nothing
         * recognisable — which reads as "there isn't one" while they are
         * standing outside it.
         */
        at: z.object({ lat: z.number(), lon: z.number() }).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<ParsedPlace[]> => {
    const local = localPlaceHits(data.query);
    if (local.length) return local;
    // Nearby first, and actually bounded — a soft viewbox is ignored for
    // chains. If the box is empty (Eiffel Tower while standing in Montreal,
    // or a chain that is not in this city), fall back to the world so
    // turning location on does not make every other search go blank.
    const area = data.at
      ? { viewbox: viewboxAround(data.at.lat, data.at.lon), bounded: true }
      : undefined;
    let hits = await nominatimVariants(data.query, area);
    if (!hits.length && area) {
      hits = await nominatimVariants(data.query, undefined);
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

    // The path address is the place's own, and the share sheet's is the same
    // thing typed out by the app that shared it; the og:description one is a
    // guess pulled out of prose, so it only fills a gap.
    const address =
      fromPath.address ??
      data.addressHint ??
      (addressMatch?.[1] ? addressMatch[1].trim().slice(0, 160) : undefined);

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
      let found: ParsedPlace | undefined;
      if (locatable && query.length > 2) {
        try {
          const hit = (await nominatim(query, 1))[0];
          found = hit ? hitToPlace(hit) : undefined;
        } catch {
          // A geocoder outage here must not fail the whole paste — keep the
          // name and leave the map empty, same as a miss.
        }
      }
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
    // A name with nowhere to put it. Not a failed read — the name is right and
    // worth keeping — but the map is empty and saying nothing about that is
    // how the old "Slovakia" result slipped through unannounced.
    const unlocated = !gotNothing && !coords;
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
      ...(unlocated ? { unlocated: true } : {}),
    };
  });

/** Look up the city and country for a set of coordinates. */
export const lookupCoords = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ lat: z.number().gte(-90).lte(90), lon: z.number().gte(-180).lte(180) }).parse(data),
  )
  .handler(async ({ data }) => reverse(data.lat, data.lon));
