import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  addressForStop,
  hasCoords,
  isSavedDirectionItem,
  looksLikeStreetAddress,
  mapsDirUrl,
  placeHintFromDetail,
  stopsForDirections,
  timelineStopsForDirections,
} from "./direction-stops.ts";

test("placeHintFromDetail keeps a street or venue and drops prose", () => {
  assert.equal(
    placeHintFromDetail("1038 Canada Place, Vancouver; suggest booking a harbor-view luxury room."),
    "1038 Canada Place, Vancouver",
  );
  assert.equal(placeHintFromDetail("Fairmont Pacific Rim; suggest reserving an evening table"), "Fairmont Pacific Rim");
  assert.equal(
    placeHintFromDetail("Browse luxury flagships including Prada, Gucci, and Tiffany & Co. along Vancouver"),
    null,
  );
  assert.equal(placeHintFromDetail(""), null);
});

test("looksLikeStreetAddress requires a leading street number", () => {
  assert.equal(looksLikeStreetAddress("1017 W Hastings St"), true);
  assert.equal(looksLikeStreetAddress("Fairmont Pacific Rim"), false);
});

test("addressForStop prefers the address column, then the detail hint", () => {
  assert.equal(addressForStop({ address: "  9 Main St  ", detail: "ignored" }), "9 Main St");
  assert.equal(addressForStop({ address: null, detail: "217 Carrall St; suggest booking" }), "217 Carrall St");
});

test("timelineStopsForDirections skips Walk/Drive rows already on the timeline", () => {
  const stops = timelineStopsForDirections([
    { title: "Dinner at Botanist Restaurant", detail: "Fairmont Pacific Rim; suggest reserving" },
    { title: "Walk to Dinner at Botanist Restaurant", kind: "Transport" },
    { title: "Drive to Whistler", kind: "Transport" },
  ]);
  assert.equal(stops.length, 1);
  assert.equal(stops[0]?.title, "Dinner at Botanist Restaurant");
  assert.equal(stops[0]?.address, "Fairmont Pacific Rim");
});

test("stopsForDirections uses cities when there are two or more", () => {
  const stops = stopsForDirections(
    [
      { city: "Vancouver", lat: 49.28, lon: -123.12 },
      { city: "Whistler", lat: 50.12, lon: -122.95 },
    ],
    [{ title: "Dinner", detail: "1017 W Hastings St" }],
  );
  assert.equal(stops.length, 2);
  assert.equal(stops[0]?.title, "Vancouver");
  assert.equal(stops[0]?.lat, 49.28);
});

test("mapsDirUrl uses coordinates when both ends are known", () => {
  const url = mapsDirUrl(
    { title: "Hotel", lat: 49.289, lon: -123.117 },
    { title: "Dinner", lat: 49.284, lon: -123.12 },
    "Vancouver, Canada",
    "walking",
  );
  assert.ok(url.includes("origin=49.289,-123.117"));
  assert.ok(url.includes("destination=49.284,-123.12"));
  assert.ok(url.includes("travelmode=walking"));
});

test("mapsDirUrl falls back to a named search only when coords are missing", () => {
  const url = mapsDirUrl({ title: "Hotel" }, { title: "Dinner" }, "Vancouver, Canada");
  assert.ok(url.includes(encodeURIComponent("Hotel, Vancouver, Canada")));
  assert.ok(url.includes(encodeURIComponent("Dinner, Vancouver, Canada")));
});

test("hasCoords rejects empty and 0,0 pins", () => {
  assert.equal(hasCoords({ lat: 49.2, lon: -123.1 }), true);
  assert.equal(hasCoords({ lat: 0, lon: 0 }), false);
  assert.equal(hasCoords({ lat: null, lon: -123 }), false);
});
