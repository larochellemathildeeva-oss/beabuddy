import {
  commonsImageInfoUrl,
  readCommonsImage,
  readWikidataImage,
  wikidataImageUrl,
  type CommonsRef,
  type PlacePhoto,
} from "./wikimedia.ts";

/**
 * Fetches a place's Commons photo for the stop card. Keyless and free, but
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

export function commonsPhotoFor(ref: CommonsRef): Promise<PlacePhoto | null> {
  const key = "file" in ref ? `f:${ref.file}` : `q:${ref.wikidata}`;
  const cached = cache.get(key);
  if (cached) return cached;
  // The promise is kept while it runs, so cards asking at once share one lookup.
  const pending = lookup(ref).catch(() => {
    cache.delete(key);
    return null;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value!);
  cache.set(key, pending);
  return pending;
}

async function lookup(ref: CommonsRef): Promise<PlacePhoto | null> {
  const file =
    "file" in ref ? ref.file : readWikidataImage(await getJson(wikidataImageUrl(ref.wikidata)));
  return file ? readCommonsImage(await getJson(commonsImageInfoUrl(file))) : null;
}
