import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PLACE_ON_OPEN_LIMIT,
  rowsToPlace,
  stopLookupTitle,
  stopsToPlace,
  tripLookupArea,
} from "./stop-placing.ts";

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

test("rowsToPlace takes unplaced, titled timeline rows it has not tried", () => {
  const rows = [
    { id: "a", title: "Peace Memorial Museum" },
    { id: "b", title: "Okonomimura", lat: 34.39, lon: 132.46 },
    { id: "c", title: "   " },
    { id: "d", title: "Miyajima ferry" },
  ];
  assert.deepEqual(
    rowsToPlace(rows, new Set(["d"])).map((r) => r.id),
    ["a"],
  );
});

test("rowsToPlace treats half a coordinate as unplaced", () => {
  assert.equal(rowsToPlace([{ id: "a", title: "Shukkei-en", lat: 34.4 }], new Set()).length, 1);
});

test("rowsToPlace caps one visit", () => {
  const rows = Array.from({ length: PLACE_ON_OPEN_LIMIT + 5 }, (_, i) => ({
    id: String(i),
    title: `Stop ${i}`,
  }));
  assert.equal(rowsToPlace(rows, new Set()).length, PLACE_ON_OPEN_LIMIT);
});

test("tripLookupArea prefers the trip's own city and country", () => {
  assert.equal(tripLookupArea({ city: "Hiroshima", country: "Japan" }), "Hiroshima, Japan");
});

test("tripLookupArea does not repeat a country already in the city line", () => {
  assert.equal(tripLookupArea({ city: "Hiroshima, Japan", country: "Japan" }), "Hiroshima, Japan");
});

test("tripLookupArea falls back to a real stop, never to a trip title", () => {
  assert.equal(
    tripLookupArea({ city: null, country: null, stops: [{ city: "Hiroshima", country: "Japan" }] }),
    "Hiroshima, Japan",
  );
});

test("tripLookupArea returns nothing when there is no real place to anchor to", () => {
  assert.equal(tripLookupArea({ city: "", country: "", stops: [] }), "");
  assert.equal(tripLookupArea({}), "");
});
