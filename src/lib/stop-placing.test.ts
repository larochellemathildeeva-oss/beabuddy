import { strict as assert } from "node:assert";
import { test } from "node:test";
import { PLACE_ON_OPEN_LIMIT, stopLookupTitle, stopsToPlace } from "./stop-placing.ts";

const stop = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  city: "Lisbon",
  ...extra,
});

test("a placed stop is left alone", () => {
  assert.deepEqual(stopsToPlace([stop("a", { lat: 38.7, lon: -9.1 })], new Set()), []);
});

test("half a coordinate is not placed", () => {
  // Half a point cannot be drawn or measured, so it still needs looking up.
  assert.equal(stopsToPlace([stop("a", { lat: 38.7 })], new Set()).length, 1);
});

test("a stop with no name is not looked up", () => {
  assert.deepEqual(stopsToPlace([{ id: "a", city: "   " }], new Set()), []);
});

test("the specific place beats the city as the thing to look up", () => {
  assert.equal(stopLookupTitle(stop("a", { place_name: "Hotel Bel-Air" })), "Hotel Bel-Air");
  assert.equal(stopLookupTitle(stop("a", { place_name: "  " })), "Lisbon");
  assert.equal(stopLookupTitle(stop("a")), "Lisbon");
});

test("a stop already tried this visit is not asked for again", () => {
  // The list reloads after every placement; without this the ones that cannot
  // be found would be looked up on every reload, forever.
  assert.deepEqual(stopsToPlace([stop("a")], new Set(["a"])), []);
});

test("a long trip is capped rather than fired off all at once", () => {
  const many = Array.from({ length: 20 }, (_, i) => stop(`s${i}`));
  assert.equal(stopsToPlace(many, new Set()).length, PLACE_ON_OPEN_LIMIT);
});

test("the cap counts only stops that actually need placing", () => {
  const mixed = [
    ...Array.from({ length: 5 }, (_, i) => stop(`placed${i}`, { lat: 1, lon: 1 })),
    ...Array.from({ length: 3 }, (_, i) => stop(`open${i}`)),
  ];
  assert.deepEqual(
    stopsToPlace(mixed, new Set()).map((s) => s.id),
    ["open0", "open1", "open2"],
  );
});
