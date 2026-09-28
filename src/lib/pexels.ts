import { comparableName } from "./captured-place.ts";
import type { PlacePhoto } from "./wikimedia.ts";

/**
 * A photograph from Pexels, for a trip banner or a stop, ahead of Wikimedia
 * Commons: Pexels photos are made to be looked at, Commons' to document.
 *
 * Pexels is a stock library, not a map, so a search for "Café de Flore" also
 * answers with any café. A photo is only taken when its description names the
 * place or town asked for; anything else falls back to Commons, then to the
 * painting. Pexels asks that each photo is credited to its photographer with
 * a link to Pexels, which `photoCredit` does. Pure URL building and reading,
 * tested; the key and the fetching are in pexels.server.ts.
 */

export const PEXELS_API = "https://api.pexels.com/v1/search";
/** Results read per search, for one whose description names the place. */
export const PEXELS_PER_PAGE = 15;

export type PexelsUse = "place" | "banner";

export function pexelsSearchUrl(query: string, use: PexelsUse): string {
  const params = new URLSearchParams({
    query: query.trim().slice(0, 200),
    per_page: String(PEXELS_PER_PAGE),
  });
  if (use === "banner") params.set("orientation", "landscape");
  return `${PEXELS_API}?${params}`;
}

/** "Kyoto, Kyoto Prefecture" in Japan → "Kyoto Japan"; empty without a town. */
export function pexelsTownQuery(city: string, country?: string | null): string {
  const town = (city.split(",")[0] ?? "").trim();
  if (!town) return "";
  const land = (country ?? "").trim();
  return land && comparableName(land) !== comparableName(town) ? `${town} ${land}` : town;
}

type PexelsPhoto = {
  width?: number;
  height?: number;
  url?: string;
  photographer?: string;
  alt?: string;
  src?: { large?: string; large2x?: string };
};

/** Does `alt` name one of `names`, as whole words? Very short names never match. */
function describes(alt: string, names: readonly string[]): boolean {
  const said = ` ${comparableName(alt)} `;
  return names.some((name) => {
    const wanted = comparableName(name);
    return wanted.length >= 4 && said.includes(` ${wanted} `);
  });
}

/**
 * The first photo in a Pexels search whose description names one of `names`
 * (a stop's names, or a town's), as a credited PlacePhoto. A banner must be
 * wider than tall. Null when none does.
 */
export function readPexelsPhoto(
  json: unknown,
  names: readonly string[],
  use: PexelsUse,
): PlacePhoto | null {
  const photos = (json as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(photos)) return null;
  for (const p of photos as PexelsPhoto[]) {
    const url = use === "banner" ? p?.src?.large2x : p?.src?.large;
    if (!url || !p.url || !p.alt || !p.photographer?.trim()) continue;
    if (!isPexelsUrl(url, "images.pexels.com") || !isPexelsUrl(p.url, "www.pexels.com")) continue;
    if (use === "banner" && p.width && p.height && p.width <= p.height) continue;
    if (!describes(p.alt, names)) continue;
    return {
      url,
      page: p.url,
      author: p.photographer.trim(),
      license: "Pexels License",
      source: "pexels",
    };
  }
  return null;
}

function isPexelsUrl(value: string, host: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host;
  } catch {
    return false;
  }
}
