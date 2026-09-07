import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RouteLeg } from "./directions.functions.ts";
import {
  directionDetail,
  directionTitle,
  legsToTimelineItems,
  stripEmbeddedMapsUrl,
} from "./timeline-directions.ts";

const walk: RouteLeg = {
  from: "Hotel",
  to: "Market",
  mode: "walking",
  distance: 800,
  duration: 600,
  steps: [],
  mapUrl: "https://maps.example/walk",
};

test("directionTitle names the walk or drive", () => {
  assert.equal(directionTitle(walk), "Walk to Market");
  assert.equal(directionTitle({ ...walk, mode: "driving" }), "Drive to Market");
});

test("directionDetail keeps a short summary without embedding the maps URL", () => {
  assert.equal(directionDetail(walk), "Walk · 800 m · 10 min");
});

test("stripEmbeddedMapsUrl clears leftover map links from older saves", () => {
  assert.equal(
    stripEmbeddedMapsUrl("Exact spot unknown — open in maps · https://www.google.com/maps/dir/?api=1&origin=a"),
    "Exact spot unknown — open in maps",
  );
  assert.equal(stripEmbeddedMapsUrl("Walk · 800 m · 10 min"), "Walk · 800 m · 10 min");
  assert.equal(stripEmbeddedMapsUrl(null), "");
});

test("legsToTimelineItems uses the from-stop day and destination coords", () => {
  const items = legsToTimelineItems(
    [{ ...walk, toLat: 49.28, toLon: -123.12 }],
    [
      { title: "Hotel", day_date: "2026-09-12", time_label: "14:00", lat: 43.6, lon: -79.3 },
      { title: "Market", address: "701 W Georgia St", lat: 49.28, lon: -123.12 },
    ],
    [],
  );
  assert.equal(items.length, 1);
  assert.equal(items[0]?.kind, "Transport");
  assert.equal(items[0]?.day_date, "2026-09-12");
  assert.equal(items[0]?.title, "Walk to Market");
  assert.equal(items[0]?.address, "701 W Georgia St");
  assert.equal(items[0]?.lat, 49.28);
  assert.equal(items[0]?.lon, -123.12);

  const again = legsToTimelineItems(
    [walk],
    [{ title: "Hotel", day_date: "2026-09-12" }],
    ["Walk to Market"],
  );
  assert.equal(again.length, 1);
  assert.equal(again[0]?.title, "Walk to Market");
});

test("directionDetail names a same-place stretch", () => {
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0, sameSpot: true }),
    "Same place — no walk",
  );
});

test("directionDetail only says the spot is unknown when it is", () => {
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0, unknownSpot: true }),
    "Exact spot unknown — open in maps",
  );
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0 }),
    "Open in maps",
  );
});
