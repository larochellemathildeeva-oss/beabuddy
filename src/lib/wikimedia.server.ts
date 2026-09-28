import {
  COMMONS_BANNER_WIDTH,
  COMMONS_THUMB_WIDTH,
  commonsImageInfoUrl,
  readCommonsImage,
  readWikidataImage,
  readWikipediaItem,
  townTitles,
  wikidataImageUrl,
  wikipediaItemsUrl,
  type CommonsRef,
  type PlacePhoto,
} from "./wikimedia.ts";

/**
 * Fetches a place's Commons photo for the stop card, and a town's for a
 * trip banner. Keyless and free, but
 * Wikimedia asks API users to name themselves with a contact in the
 * user-agent and not to ask twice, so answers are kept for the life of the
 * process. A failure is not remembered: the next look tries again.
 */

const UA = "BeaTravelApp/1.0 (https://github.com/larochellemathildeeva-oss/beabuddy)";
const cache = new Map<string, Promise<PlacePhoto | null>>();
const CACHE_MAX = 2_000;

async function getJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { "user-agent": UA, "api-user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!res.ok) throw new Error(`Wikimedia answered ${res.status}`);
  return res.json();
}

export function commonsPhotoFor(
  ref: CommonsRef,
  width = COMMONS_THUMB_WIDTH,
): Promise<PlacePhoto | null> {
  const key = `${"file" in ref ? `f:${ref.file}` : `q:${ref.wikidata}`}@${width}`;
  return remembered(key, () => lookup(ref, width));
}

/**
 * A photo of a trip's town, for its banner: the town's Wikipedia article
 * names its Wikidata item, whose "image" is the photo. Null when the town has
 * no article, only a disambiguation page, or no photo that can be credited.
 */
export function townPhotoFor(city: string, country?: string | null): Promise<PlacePhoto | null> {
  const titles = townTitles(city, country);
  if (!titles.length) return Promise.resolve(null);
  return remembered(`t:${titles[0]!.toLowerCase()}`, async () => {
    const item = readWikipediaItem(await getJson(wikipediaItemsUrl(titles)), titles);
    return item ? lookup({ wikidata: item }, COMMONS_BANNER_WIDTH) : null;
  });
}

function remembered(
  key: string,
  run: () => Promise<PlacePhoto | null>,
): Promise<PlacePhoto | null> {
  const cached = cache.get(key);
  if (cached) return cached;
  // The promise is kept while it runs, so cards asking at once share one lookup.
  const pending = run().catch(() => {
    cache.delete(key);
    return null;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, pending);
  return pending;
}

async function lookup(ref: CommonsRef, width: number): Promise<PlacePhoto | null> {
  const file =
    "file" in ref ? ref.file : readWikidataImage(await getJson(wikidataImageUrl(ref.wikidata)));
  return file ? readCommonsImage(await getJson(commonsImageInfoUrl(file, width))) : null;
}
