import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  DWELL_MS,
  candidateFor,
  followAlong,
  followKey,
  fromHere,
  fromHereLine,
  type FollowStop,
} from "./live-companion.ts";

const louvre = { lat: 48.8606, lon: 2.3376 };
const flore = { lat: 48.8541, lon: 2.3326 };
const orsay = { lat: 48.86, lon: 2.3266 };
const eiffel = { lat: 48.8584, lon: 2.2945 };

/** A point `metres` north of `at`. */
const north = (at: { lat: number; lon: number }, metres: number) => ({
  lat: at.lat + metres / 111_320,
  lon: at.lon,
});
const fix = (at: { lat: number; lon: number }, accuracy = 10) => ({ ...at, accuracy });

function day(marks: Partial<Record<string, { arrived_at?: string; left_at?: string }>> = {}) {
  const stops: FollowStop[] = [
    { id: "louvre", title: "Louvre", time_label: "10:00", ...louvre },
    { id: "flore", title: "Café de Flore", time_label: "12:30", ...flore },
    { id: "orsay", title: "Musée d'Orsay", time_label: "14:00", ...orsay },
    { id: "eiffel", title: "Eiffel Tower", time_label: "17:00", ...eiffel },
  ];
  return stops.map((s) => ({ ...s, ...marks[s.id] }));
}

const T0 = Date.parse("2026-10-02T10:00:00Z");

test("standing at the first stop suggests arriving there", () => {
  const c = candidateFor(day(), fix(louvre));
  assert.equal(c?.kind, "arrive");
  assert.equal(c?.stop.id, "louvre");
  assert.equal(c?.sure, true);
});

test("a reading too unsure never suggests an arrival", () => {
  assert.equal(candidateFor(day(), fix(louvre, 250)), null);
});

test("near but not within reach is not an arrival", () => {
  assert.equal(candidateFor(day(), fix(north(louvre, 200))), null);
});

test("a stop behind you is never suggested, even when it is the nearest", () => {
  const stops = day({
    louvre: { arrived_at: "2026-10-02T10:00:00Z", left_at: "2026-10-02T11:00:00Z" },
  });
  assert.equal(candidateFor(stops, fix(louvre)), null);
});

test("the stop after next can be suggested (one skipped), but not one further", () => {
  const stops = day();
  // Orsay is two ahead of the Louvre: allowed. Eiffel is four ahead: not.
  assert.equal(
    candidateFor(
      day({ louvre: { arrived_at: "2026-10-02T10:00:00Z", left_at: "2026-10-02T11:00:00Z" } }),
      fix(orsay),
    )?.stop.id,
    "orsay",
  );
  assert.equal(candidateFor(stops, fix(eiffel)), null);
});

test("leaving is suggested once well away from where you are", () => {
  const stops = day({ louvre: { arrived_at: "2026-10-02T10:00:00Z" } });
  assert.equal(candidateFor(stops, fix(north(louvre, 40))), null);
  const c = candidateFor(stops, fix(north(louvre, 400)));
  assert.equal(c?.kind, "leave");
  assert.equal(c?.stop.id, "louvre");
});

test("arriving at the next stop wins over leaving the last", () => {
  const stops = day({ louvre: { arrived_at: "2026-10-02T10:00:00Z" } });
  assert.equal(candidateFor(stops, fix(flore))?.kind, "arrive");
});

test("an unsure arrival waits until the readings have lasted", () => {
  const stops = day();
  const near = fix(north(louvre, 45), 30);
  const first = followAlong(null, stops, near, T0);
  assert.equal(first.suggest, null);
  const later = followAlong(first.sighting, stops, near, T0 + DWELL_MS);
  assert.equal(later.suggest?.stop.id, "louvre");
});

test("walking past resets the wait", () => {
  const stops = day();
  const near = fix(north(louvre, 45), 30);
  const first = followAlong(null, stops, near, T0);
  const away = followAlong(first.sighting, stops, fix(north(louvre, 300)), T0 + 30_000);
  assert.equal(away.sighting, null);
  const back = followAlong(away.sighting, stops, near, T0 + DWELL_MS);
  assert.equal(back.suggest, null);
});

test("a suggestion waved away is not offered again", () => {
  const out = followAlong(null, day(), fix(louvre), T0, new Set([followKey("arrive", "louvre")]));
  assert.equal(out.suggest, null);
});

test("from here: on time, late, and when to leave", () => {
  const next = day()[1]!; // Café de Flore, 12:30
  const start = fix(louvre);
  const r = fromHere(start, next, "walk", 12 * 60);
  assert.ok(r);
  assert.equal(r.mode, "walking");
  assert.ok(r.minutes >= 9 && r.minutes <= 15, `minutes ${r.minutes}`);
  assert.equal(r.lateBy, 12 * 60 + r.minutes - (12 * 60 + 30));
  assert.match(fromHereLine(r, false), /^On track/);
  assert.match(fromHereLine(r, true), /^Leave in about \d+ min/);

  const late = fromHere(start, next, "walk", 12 * 60 + 35)!;
  assert.match(fromHereLine(late, false), /^Running about \d+ min late/);
  assert.match(fromHereLine(late, true), /^Leave now and you're about \d+ min late/);
});

test("from here says nothing without a pin, with an unsure reading, or once there", () => {
  const next = day()[1]!;
  assert.equal(fromHere(fix(louvre, 900), next, "walk", 600), null);
  assert.equal(fromHere(fix(flore), next, "walk", 600), null);
  assert.equal(fromHere(fix(louvre), { ...next, lat: null, lon: null }, "walk", 600), null);
  // 0,0 is where a failed lookup lands, not a stop.
  assert.equal(fromHere(fix(louvre), { ...next, lat: 0, lon: 0 }, "walk", 600), null);
});

test("from here without a time says only how far", () => {
  const next = { ...day()[1]!, time_label: "Lunch" };
  const r = fromHere(fix(louvre), next, "walk", 600)!;
  assert.equal(r.lateBy, null);
  assert.match(fromHereLine(r, false), /^\d+ min away · there about \d\d:\d\d$/);
});
