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

test("pins are tinted by what the stop is, in four families", async () => {
  const { pinTone, tonesUsed } = await import("./day-map.ts");
  assert.equal(pinTone({ kind: "restaurant", title: "Kakiya" }), "food");
  assert.equal(pinTone({ kind: "train", title: "Shinkansen" }), "transit");
  assert.equal(pinTone({ kind: "hotel", title: "Ryokan" }), "stay");
  assert.equal(pinTone({ kind: "museum", title: "Peace Museum" }), "sight");
  assert.equal(pinTone({ kind: "note", title: "Buy tickets" }), "sight");
  assert.deepEqual(
    tonesUsed([{ tone: "food" }, { tone: "sight" }, { tone: "food" }]).map((t) => t.tone),
    ["sight", "food"],
  );
});

test("a leg says a walk when it is one, and a distance when it is not", async () => {
  const { legEstimate, dayDistance } = await import("./day-map.ts");
  const near = legEstimate({ lat: 34.3955, lon: 132.4536 }, { lat: 34.4006, lon: 132.4596 });
  assert.ok(near.walkMinutes !== null && near.walkMinutes > 5 && near.walkMinutes < 20);
  assert.match(near.label, /^about \d+ min walk · \d+ m$/);
  const far = legEstimate({ lat: 34.3955, lon: 132.4536 }, { lat: 34.296, lon: 132.3198 });
  assert.equal(far.walkMinutes, null);
  assert.match(far.label, /^about \d+ km away$/);
  assert.equal(dayDistance([{ lat: 1, lon: 1 }]), 0);
  const there = dayDistance([cafe, museum]);
  assert.ok(Math.abs(dayDistance([cafe, museum, cafe]) - 2 * there) < 1e-6);
});

test("stepping wraps at both ends and starts at the first", async () => {
  const { stepPin } = await import("./day-map.ts");
  const pins = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(stepPin(pins, "a", 1), "b");
  assert.equal(stepPin(pins, "c", 1), "a");
  assert.equal(stepPin(pins, "a", -1), "c");
  assert.equal(stepPin(pins, null, 1), "a");
  assert.equal(stepPin(pins, null, -1), "c");
  assert.equal(stepPin([], "a", 1), null);
});

test("Focus opens on the asked stop, then what is next today, then the first", async () => {
  const { focusStart } = await import("./day-map.ts");
  const pins = [{ id: "a" }, { id: "c" }, { id: "d" }];
  const stops = [
    { id: "a", time_label: "09:00" },
    { id: "b", time_label: "10:00" },
    { id: "c", time_label: "12:00" },
    { id: "d", time_label: "15:00" },
  ];
  const at = (h: number) => ({ isToday: true, minutesNow: h * 60 });
  assert.equal(focusStart(pins, stops, { ...at(11), requested: "d" }), "d");
  // "b" is next but has no pin, so the next placed stop is chosen.
  assert.equal(focusStart(pins, stops, at(9.5)), "c");
  assert.equal(focusStart(pins, stops, at(20)), "d");
  assert.equal(focusStart(pins, stops, { isToday: false, minutesNow: 600 }), "a");
  assert.equal(focusStart([], stops, at(9)), null);
});

test("a stop with a list inside carries its count; one inside another is nested", () => {
  const park = {
    ...cafe,
    id: "park",
    inside: [
      { title: "Flame of Peace", done: false },
      { title: "Peace Bell", done: true },
    ],
  };
  const cenotaph = { ...museum, id: "cenotaph", parent_id: "park" };
  const orphan = { ...museum, id: "orphan", parent_id: "elsewhere" };
  const pins = dayMapPins([park, cenotaph, orphan]);
  assert.deepEqual(
    pins.map((p) => [p.id, p.insideCount, p.nested]),
    [
      ["park", 2, false],
      ["cenotaph", 0, true],
      ["orphan", 0, false],
    ],
    "a parent not on this map leaves the stop an ordinary pin",
  );
});
