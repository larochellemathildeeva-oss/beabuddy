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
