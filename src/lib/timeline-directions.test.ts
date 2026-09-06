import { strict as assert } from "node:assert";
import { test } from "node:test";
import type { RouteLeg } from "./directions.functions.ts";
import { directionDetail, directionTitle, legsToTimelineItems } from "./timeline-directions.ts";

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

test("directionDetail keeps a short summary and the maps link", () => {
  assert.equal(directionDetail(walk), "Walk · 800 m · 10 min · https://maps.example/walk");
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
    "Same place — no walk · https://maps.example/walk",
  );
});

test("directionDetail only says the spot is unknown when it is", () => {
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0, unknownSpot: true }),
    "Exact spot unknown — open in maps · https://maps.example/walk",
  );
  assert.equal(
    directionDetail({ ...walk, distance: 0, duration: 0 }),
    "Open in maps · https://maps.example/walk",
  );
});
