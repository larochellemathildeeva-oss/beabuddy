import {
  COMMONS_BANNER_WIDTH,
  COMMONS_THUMB_WIDTH,
  WIKIVOYAGE_BANNER_WIDTH,
  commonsCategoryFilesUrl,
  commonsImageInfoUrl,
  readBestCategoryImage,
  readCommonsImage,
  readWikidataCategory,
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
 * trip banner. Keyless and free, but Wikimedia asks API users to name
 * themselves with a contact in the user-agent and not to ask twice, so
 * answers are kept for the life of the process. A failure is not remembered: the next look tries again.
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

/**
 * A place's photo: the file a mapper named, when it is a good photo, else the
 * best its Wikidata item offers (see `itemPhoto`).
 */
export function commonsPhotoFor(
  ref: CommonsRef,
  width = COMMONS_THUMB_WIDTH,
): Promise<PlacePhoto | null> {
  const key = `f:${ref.file ?? ""}|q:${ref.wikidata ?? ""}@${width}`;
  return remembered(key, async () => {
    if (ref.file) {
      const named = readCommonsImage(await getJson(commonsImageInfoUrl(ref.file, width)));
      if (named) return named;
    }
    return ref.wikidata ? itemPhoto(ref.wikidata, width, "place") : null;
  });
}

/**
 * A photo of a trip's town, for its banner. The town's Wikipedia article
 * names its Wikidata item; from that, its Wikivoyage banner first — a wide
 * photo people chose to head the town's travel guide — then the item's own
 * image, then the best-rated photo in its Commons category. Null when the
 * town has no article, only a disambiguation page, or no good photo.
 */
export function townPhotoFor(city: string, country?: string | null): Promise<PlacePhoto | null> {
  const titles = townTitles(city, country);
  if (!titles.length) return Promise.resolve(null);
  return remembered(`t:${titles[0]!.toLowerCase()}`, async () => {
    const item = readWikipediaItem(await getJson(wikipediaItemsUrl(titles)), titles);
    return item ? itemPhoto(item, COMMONS_BANNER_WIDTH, "banner") : null;
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

/**
 * The best photo a Wikidata item offers, in order: its Wikivoyage banner (for
 * a banner only), its "image" when that is a good photo, then the best-rated
 * photo in its Commons category. Each step is asked only when the one before
 * found nothing.
 */
async function itemPhoto(
  id: string,
  width: number,
  use: "place" | "banner",
): Promise<PlacePhoto | null> {
  if (use === "banner") {
    const banner = readWikidataImage(await getJson(wikidataImageUrl(id, "P948")), "P948");
    if (banner) {
      const url = commonsImageInfoUrl(banner, WIKIVOYAGE_BANNER_WIDTH);
      const photo = readCommonsImage(await getJson(url), "banner");
      if (photo) return photo;
    }
  }
  const image = readWikidataImage(await getJson(wikidataImageUrl(id, "P18")));
  if (image) {
    const photo = readCommonsImage(await getJson(commonsImageInfoUrl(image, width)));
    if (photo) return photo;
  }
  const category = readWikidataCategory(await getJson(wikidataImageUrl(id, "P373")));
  return category
    ? readBestCategoryImage(await getJson(commonsCategoryFilesUrl(category, width)))
    : null;
}
