import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  TILE_DAILY_CREDITS,
  TileDailyCreditShare,
  TileRateLimiter,
  tileClientKey,
} from "./tile-rate-limit.ts";

const noon = Date.UTC(2026, 8, 30, 12);

test("rate limit allows 600 then refuses", () => {
  const limit = new TileRateLimiter();
  for (let i = 0; i < 600; i++) assert.equal(limit.allow("client", 0), true);
  assert.equal(limit.allow("client", 0), false);
});

test("rate limit refills continuously over time", () => {
  const limit = new TileRateLimiter();
  for (let i = 0; i < 600; i++) limit.allow("client", 0);
  assert.equal(limit.allow("client", 999), false);
  assert.equal(limit.allow("client", 1_000), true, "one token refills each second");
  assert.equal(limit.allow("client", 1_000), false);
});

test("rate-limit keys are independent", () => {
  const limit = new TileRateLimiter(1, 1_000, 10);
  assert.equal(limit.allow("a", 0), true);
  assert.equal(limit.allow("a", 0), false);
  assert.equal(limit.allow("b", 0), true);
});

test("last x-forwarded-for entry is used", () => {
  assert.equal(
    tileClientKey(new Headers({ "x-forwarded-for": "forged, 198.51.100.4" })),
    "198.51.100.4",
  );
});

test("missing x-forwarded-for maps to unknown", () => {
  assert.equal(tileClientKey(new Headers()), "unknown");
  assert.equal(tileClientKey(new Headers({ "x-forwarded-for": "  " })), "unknown");
});

test("tracked-key cap evicts the oldest key", () => {
  const limit = new TileRateLimiter(1, 1_000, 2);
  limit.allow("a", 0);
  limit.allow("b", 0);
  limit.allow("c", 0);
  assert.equal(limit.size, 2);
  assert.equal(limit.has("a"), false);
  assert.equal(limit.has("b"), true);
  assert.equal(limit.has("c"), true);
});

test("anonymous vector-tile traffic cannot spend more than the map share of Geoapify credits", () => {
  const share = new TileDailyCreditShare();
  for (let spent = 0; spent < TILE_DAILY_CREDITS; spent += 0.25) {
    assert.equal(share.trySpend(0.25, noon), true);
  }
  assert.equal(share.credits(noon), TILE_DAILY_CREDITS);
  assert.equal(share.trySpend(0.25, noon), false);
  assert.equal(share.credits(noon), TILE_DAILY_CREDITS);
  assert.equal(share.takeExhaustedNotice(noon), true);
  assert.equal(share.takeExhaustedNotice(noon), false, "the exhaustion notice is once per day");
});

test("tile share resets at the next UTC day", () => {
  const share = new TileDailyCreditShare(1);
  assert.equal(share.trySpend(1, noon), true);
  assert.equal(share.trySpend(0.25, noon), false);
  const tomorrow = Date.UTC(2026, 9, 1, 0);
  assert.equal(share.credits(tomorrow), 0);
  assert.equal(share.trySpend(1, tomorrow), true);
});
