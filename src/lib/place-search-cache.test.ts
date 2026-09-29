import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_SEARCH_TTL_MS,
  SEARCH_CACHE_TTL_MS,
  searchCacheKey,
  stillFresh,
} from "./place-search-cache.ts";

const base = { provider: "geoapify", query: "Kuromon Market", near: "Osaka, Japan" };

test("case and spacing do not make a new search", () => {
  assert.equal(
    searchCacheKey(base),
    searchCacheKey({ ...base, query: "  kuromon   MARKET ", near: "osaka, japan" }),
  );
});

test("other words, town, provider or mode are other searches", () => {
  const key = searchCacheKey(base);
  assert.notEqual(key, searchCacheKey({ ...base, query: "Kuromon" }));
  assert.notEqual(key, searchCacheKey({ ...base, near: "Kyoto, Japan" }));
  assert.notEqual(key, searchCacheKey({ ...base, provider: "locationiq" }));
  assert.notEqual(key, searchCacheKey({ ...base, quick: true }));
  assert.notEqual(key, searchCacheKey({ ...base, areas: true }));
});

test("a position is rounded to about 100 m", () => {
  const here = searchCacheKey({ ...base, at: { lat: 34.66512, lon: 135.50631 } });
  assert.equal(here, searchCacheKey({ ...base, at: { lat: 34.66498, lon: 135.50649 } }));
  assert.notEqual(here, searchCacheKey({ ...base, at: { lat: 34.667, lon: 135.506 } }));
});

test("the trip's middle counts only when there is no town", () => {
  const center = { lat: 34.67, lon: 135.5 };
  assert.equal(searchCacheKey(base), searchCacheKey({ ...base, center }));
  const noTown = { provider: "geoapify", query: "Kuromon Market" };
  assert.notEqual(searchCacheKey(noTown), searchCacheKey({ ...noTown, center }));
});

test("an empty answer is kept an hour, a found one two weeks", () => {
  const now = 1_000_000_000_000;
  assert.equal(stillFresh(now - EMPTY_SEARCH_TTL_MS + 1, true, now), true);
  assert.equal(stillFresh(now - EMPTY_SEARCH_TTL_MS - 1, true, now), false);
  assert.equal(stillFresh(now - EMPTY_SEARCH_TTL_MS - 1, false, now), true);
  assert.equal(stillFresh(now - SEARCH_CACHE_TTL_MS - 1, false, now), false);
});
