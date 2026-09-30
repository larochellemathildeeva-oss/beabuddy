import { strict as assert } from "node:assert";
import { test } from "node:test";
import { TILE_CACHE_TTL_MS, TileResponseCache } from "./tile-cache.ts";

const body = (size: number, value = 1) => new Uint8Array(size).fill(value);
const value = (size: number, fill = 1) => ({ body: body(size, fill), contentType: "image/png" });

test("cache hit and miss", () => {
  const cache = new TileResponseCache();
  assert.equal(cache.get("tile:1", 0), null);
  assert.equal(cache.set("tile:1", value(4), 0), true);
  assert.equal(cache.get("tile:1", 1)?.body.byteLength, 4);
});

test("LRU eviction by count removes the least recently used entry", () => {
  const cache = new TileResponseCache(2, 100, 1_000);
  cache.set("a", value(1), 0);
  cache.set("b", value(1), 0);
  assert.ok(cache.get("a", 1), "a becomes most recently used");
  cache.set("c", value(1), 2);
  assert.equal(cache.get("b", 3), null);
  assert.ok(cache.get("a", 3));
  assert.ok(cache.get("c", 3));
});

test("LRU eviction by bytes keeps the cache under its byte ceiling", () => {
  const cache = new TileResponseCache(10, 5, 1_000);
  cache.set("a", value(3), 0);
  cache.set("b", value(3), 1);
  assert.equal(cache.get("a", 2), null);
  assert.ok(cache.get("b", 2));
  assert.equal(cache.bytes, 3);
});

test("entries expire after 24 hours", () => {
  const cache = new TileResponseCache();
  cache.set("a", value(1), 0);
  assert.ok(cache.get("a", TILE_CACHE_TTL_MS - 1));
  assert.equal(cache.get("a", TILE_CACHE_TTL_MS), null);
  assert.equal(cache.size, 0);
});

test("an oversized single body is not cached", () => {
  const cache = new TileResponseCache(10, 4, 1_000);
  assert.equal(cache.set("too-big", value(5), 0), false);
  assert.equal(cache.get("too-big", 0), null);
  assert.equal(cache.size, 0);
  assert.equal(cache.bytes, 0);
});
