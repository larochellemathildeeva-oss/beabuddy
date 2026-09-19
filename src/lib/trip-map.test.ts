import { strict as assert } from "node:assert";
import { test } from "node:test";
import { mappableStops, spanMetres, tripMapPlan, SCHEMATIC_BELOW_METRES } from "./trip-map.ts";

const lisbon = { title: "Lisbon", lat: 38.7223, lon: -9.1393 };
const madrid = { title: "Madrid", lat: 40.4168, lon: -3.7038 };
const mileEnd = { title: "Mile End", lat: 45.523, lon: -73.6 };
const oldPort = { title: "Old Port", lat: 45.5048, lon: -73.554 };

test("tripMapPlan says why there is nothing to draw", () => {
  assert.deepEqual(tripMapPlan([]), { kind: "none", reason: "no-stops" });
  assert.deepEqual(tripMapPlan([{ title: "Somewhere" }]), { kind: "none", reason: "no-coords" });
});

test("a failed geocode at 0,0 is not a stop", () => {
  // Null island is where a lookup lands when it fails, not a place anyone went.
  assert.deepEqual(tripMapPlan([{ title: "Nowhere", lat: 0, lon: 0 }]), {
    kind: "none",
    reason: "no-coords",
  });
});

test("out-of-range and non-finite coordinates are dropped", () => {
  const stops = [
    { title: "Bad lat", lat: 91, lon: 0 },
    { title: "Bad lon", lat: 0, lon: 181 },
    { title: "NaN", lat: Number.NaN, lon: 12 },
    { title: "Null", lat: null, lon: null },
  ];
  assert.deepEqual(mappableStops(stops), []);
  assert.equal(tripMapPlan(stops).kind, "none");
});

test("one placed stop is a place, not a route", () => {
  const plan = tripMapPlan([lisbon, { title: "No location" }]);
  assert.equal(plan.kind, "single");
  assert.equal(plan.kind === "single" && plan.stop.title, "Lisbon");
});

test("stops that never move are one place, however many there are", () => {
  // Three timeline entries at the same hotel is not a journey.
  const plan = tripMapPlan([mileEnd, { ...mileEnd, title: "Breakfast" }, { ...mileEnd }]);
  assert.equal(plan.kind, "single");
});

test("a trip across regions is drawn geographically", () => {
  const plan = tripMapPlan([lisbon, madrid]);
  assert.equal(plan.kind, "geographic");
  assert.equal(plan.kind === "geographic" && plan.stops.length, 2);
});

test("a day inside one city is drawn as a diagram, not a map", () => {
  // The basemap has coastlines, not streets: at this scale it shows nothing.
  const plan = tripMapPlan([mileEnd, oldPort]);
  assert.equal(plan.kind, "schematic");
  const span = plan.kind === "schematic" ? plan.spanMetres : 0;
  assert.ok(span > 3_000 && span < 6_000, `got ${span}`);
});

test("the threshold is the span, not the number of stops", () => {
  const near = { title: "Near", lat: 45.523, lon: -73.6 };
  const justInside = { title: "Inside", lat: 45.523, lon: -73.3 }; // ~23 km east
  const justOutside = { title: "Outside", lat: 45.523, lon: -73.2 }; // ~31 km east
  assert.equal(tripMapPlan([near, justInside]).kind, "schematic");
  assert.equal(tripMapPlan([near, justOutside]).kind, "geographic");
});

test("span is the widest gap, not the first leg", () => {
  // A day that ends far from where it started must not be judged on its first hop.
  const stops = [mileEnd, oldPort, madrid];
  assert.ok(spanMetres(stops) > 5_000_000);
  assert.equal(tripMapPlan(stops).kind, "geographic");
});

test("unplaced stops keep their order among the placed ones", () => {
  const plan = tripMapPlan([lisbon, { title: "Lunch, no address" }, madrid]);
  assert.deepEqual(plan.kind === "geographic" ? plan.stops.map((s) => s.title) : [], [
    "Lisbon",
    "Madrid",
  ]);
});

test("the threshold is exported so the component and the copy agree", () => {
  assert.equal(SCHEMATIC_BELOW_METRES, 25_000);
});
