import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dayMapCaption, dayMapModel, dayMapPins, toggleSelection } from "./day-map.ts";

const cafe = { id: "a", title: "Café", lat: 45.5231, lon: -73.5817 };
const noAddress = { id: "b", title: "Somewhere", lat: null, lon: null };
const museum = { id: "c", title: " Musée ", lat: 45.4986, lon: -73.5794 };

test("a pin keeps its card's number when an earlier stop has no place", () => {
  const pins = dayMapPins([cafe, noAddress, museum]);
  assert.deepEqual(
    pins.map((p) => [p.id, p.number]),
    [
      ["a", 1],
      ["c", 3],
    ],
  );
});

test("pins use the same placement rule as the plan", () => {
  // Null island is a failed geocode, not a stop, in both.
  const nullIsland = { id: "z", title: "Nowhere", lat: 0, lon: 0 };
  assert.deepEqual(dayMapPins([nullIsland]), []);
  assert.equal(dayMapModel([nullIsland]).plan.kind, "none");
});

test("titles are trimmed for the pin", () => {
  assert.equal(dayMapPins([museum])[0]!.title, "Musée");
});

test("the model counts what the map leaves out", () => {
  const model = dayMapModel([cafe, noAddress, museum]);
  assert.equal(model.unplaced, 1);
  assert.equal(model.pins.length, 2);
  assert.equal(model.plan.kind, "schematic");
});

test("the caption speaks only when the map is partial", () => {
  assert.equal(dayMapCaption(dayMapModel([cafe, museum])), null);
  assert.match(dayMapCaption(dayMapModel([cafe, noAddress]))!, /^One stop/);
  assert.match(dayMapCaption(dayMapModel([cafe, noAddress, noAddress]))!, /^2 stops/);
  // Nothing placed at all is the empty state's job, not a caption's.
  assert.equal(dayMapCaption(dayMapModel([noAddress])), null);
});

test("tapping the selected stop again clears the selection", () => {
  assert.equal(toggleSelection(null, "a"), "a");
  assert.equal(toggleSelection("a", "c"), "c");
  assert.equal(toggleSelection("a", "a"), null);
});

test("curvedLeg starts and ends on the stops and bows to alternating sides", async () => {
  const { curvedLeg } = await import("./day-map.ts");
  const a = { lat: 34.39, lon: 132.45 };
  const b = { lat: 34.4, lon: 132.47 };
  const first = curvedLeg(a, b, 0);
  const second = curvedLeg(a, b, 1);
  assert.deepEqual(first[0], [34.39, 132.45]);
  const end = first[first.length - 1]!;
  assert.ok(Math.abs(end[0] - 34.4) < 1e-12 && Math.abs(end[1] - 132.47) < 1e-12);
  const mid = (p: [number, number][]) => p[Math.floor(p.length / 2)]!;
  const straightMid = [(a.lat + b.lat) / 2, (a.lon + b.lon) / 2];
  assert.ok(mid(first)[0] !== straightMid[0], "bowed, not straight");
  assert.ok(
    Math.sign(mid(first)[0] - straightMid[0]!) === -Math.sign(mid(second)[0] - straightMid[0]!),
    "the next leg bows the other way",
  );
  assert.deepEqual(curvedLeg(a, a, 0), [[34.39, 132.45]]);
});
