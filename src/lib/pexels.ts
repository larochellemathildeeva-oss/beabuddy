import { comparableName } from "./captured-place.ts";
import { countryCode } from "./country-names.ts";
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

/**
 * Words that say what a place is, not which one: a stop called "Cafe" or
 * "Old Town" would match any stock photo of a café or an old town.
 */
const GENERIC_WORDS = new Set(
  (
    "a an and of the at by in on de du des la le les el los las il di da do das dos der die das " +
    "cafe coffee bar pub restaurant bistro brasserie bakery patisserie pizzeria diner eatery " +
    "hotel hostel inn motel museum gallery park garden gardens beach bay lake river harbour " +
    "harbor port market shop store mall church cathedral chapel temple shrine mosque castle " +
    "palace fort tower bridge square plaza street road avenue station airport old new town " +
    "city village centre center downtown viewpoint lookout hill mountain waterfall trail " +
    "zoo aquarium library theatre theater cinema club spa pool"
  ).split(" "),
);

/** Is this a name that could be any place of its kind ("Cafe", "The Old Town")? */
export function isGenericPlaceName(name: string): boolean {
  const words = comparableName(name).split(" ").filter(Boolean);
  return words.every((word) => GENERIC_WORDS.has(word));
}

/** Does `alt` name one of `names`, as whole words? Short or generic names never match. */
function describes(alt: string, names: readonly string[]): boolean {
  const said = ` ${comparableName(alt)} `;
  return names.some((name) => {
    const wanted = comparableName(name);
    return wanted.length >= 4 && !isGenericPlaceName(wanted) && said.includes(` ${wanted} `);
  });
}

/**
 * Does `alt` name a country other than `country`? "Paris, France" is not a
 * photo of Paris, Texas. Runs of one to three words are read as country names
 * in any language; lone one- and two-letter words are skipped, since "in" and
 * "it" are also country codes.
 */
export function namesOtherCountry(alt: string, country: string | null | undefined): boolean {
  const wanted = countryCode(country);
  if (!wanted) return false;
  const words = comparableName(alt).split(" ").filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    for (let n = 1; n <= 3 && i + n <= words.length; n++) {
      const run = words.slice(i, i + n).join(" ");
      if (run.length <= 2) continue;
      const code = countryCode(run);
      if (code && code !== wanted) return true;
    }
  }
  return false;
}

/**
 * The first photo in a Pexels search whose description names one of `names`
 * (a stop's names, or a town's), as a credited PlacePhoto. A banner must be
 * wider than tall, and a town's must not name another country. Null when none
 * does.
 */
export function readPexelsPhoto(
  json: unknown,
  names: readonly string[],
  use: PexelsUse,
  country?: string | null,
): PlacePhoto | null {
  const photos = (json as { photos?: unknown } | null)?.photos;
  if (!Array.isArray(photos)) return null;
  for (const p of photos as PexelsPhoto[]) {
    const url = use === "banner" ? p?.src?.large2x : p?.src?.large;
    if (!url || !p.url || !p.alt || !p.photographer?.trim()) continue;
    if (!isPexelsUrl(url, "images.pexels.com") || !isPexelsUrl(p.url, "www.pexels.com")) continue;
    if (use === "banner" && p.width && p.height && p.width <= p.height) continue;
    if (!describes(p.alt, names) || namesOtherCountry(p.alt, country)) continue;
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

/**
 * A rolling hour of searches, kept as their times. `take` answers whether one
 * more fits under `max` and, when it does, counts it.
 */
export function takeFromHour(times: number[], now: number, max: number): boolean {
  const hourAgo = now - 60 * 60_000;
  while (times.length && times[0]! <= hourAgo) times.shift();
  if (times.length >= max) return false;
  times.push(now);
  return true;
}

function isPexelsUrl(value: string, host: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === host;
  } catch {
    return false;
  }
}
