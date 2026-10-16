import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hopLine, orderByDistance, planSaved, stayFor, type SavedPick } from "./saved-plan.ts";

const pick = (id: string, lat: number, lon: number, category: string | null = null): SavedPick => ({
  id,
  name: id,
  category,
  address: null,
  lat,
  lon,
});

// Duomo, Signoria and Uffizi sit within a few hundred metres of each other; the
// fourth is across the river.
const duomo = pick("duomo", 43.7731, 11.256, "Landmark");
const signoria = pick("signoria", 43.7696, 11.2558, "Historic square");
const uffizi = pick("uffizi", 43.7677, 11.2553, "Art museum");
const pitti = pick("pitti", 43.7653, 11.2499, "Palace");

test("the nearest place comes next, and unpinned ones go last", () => {
  const loose: SavedPick = { ...pick("note", 0, 0), lat: null, lon: null };
  const order = orderByDistance([duomo, uffizi, loose, signoria]).map((p) => p.id);
  assert.deepEqual(order, ["duomo", "signoria", "uffizi", "note"]);
});

test("a visit lasts what its kind usually does", () => {
  assert.equal(stayFor("Art museum"), 120);
  assert.equal(stayFor("Trattoria"), 75);
  assert.equal(stayFor("Café"), 45);
  assert.equal(stayFor(null), 60);
});

test("balanced puts three main stops on one day, with times that never overlap", () => {
  const [day, ...more] = planSaved(
    [duomo, signoria, uffizi],
    ["2026-04-12", "2026-04-13"],
    "balanced",
    "walk",
  );
  assert.equal(more.length, 0);
  assert.equal(day!.date, "2026-04-12");
  assert.deepEqual(
    day!.stops.map((s) => s.id),
    ["duomo", "signoria", "uffizi"],
  );
  assert.equal(day!.stops[0]!.start, "09:00");
  assert.equal(day!.stops[0]!.travel, null);
  for (let i = 1; i < day!.stops.length; i++) {
    assert.ok(day!.stops[i]!.start >= day!.stops[i - 1]!.end, "starts after the one before ends");
    assert.equal(day!.stops[i]!.travel?.mode, "walk");
  }
});

test("a relaxed pace spills onto the next day, and nothing is dropped", () => {
  const days = planSaved(
    [duomo, signoria, uffizi, pitti],
    ["2026-04-12", "2026-04-13"],
    "relaxed",
    "walk",
  );
  assert.equal(days.length, 2);
  assert.equal(days.flatMap((d) => d.stops).length, 4);
  assert.equal(days[1]!.date, "2026-04-13");
});

test("more places than days stay on the last day", () => {
  const days = planSaved([duomo, signoria, uffizi, pitti], ["2026-04-12"], "relaxed", "walk");
  assert.equal(days.length, 1);
  assert.equal(days[0]!.stops.length, 4);
});

test("a short hop is walked, a long one rides when the choice is mostly transit", () => {
  const walk = planSaved([duomo, signoria], ["2026-04-12"], "balanced", "walk")[0]!.stops[1]!
    .travel!;
  assert.equal(walk.mode, "walk");
  const ride = planSaved([duomo, pitti], ["2026-04-12"], "balanced", "transit")[0]!.stops[1]!
    .travel!;
  assert.equal(ride.mode, "ride");
  assert.match(hopLine(walk), /min walk · \d+ m|km/);
});

test("an undated trip plans one day without a date", () => {
  const days = planSaved([duomo], [], "balanced", "walk");
  assert.equal(days[0]!.date, null);
});
