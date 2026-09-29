import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  HERE_ACCURACY_MAX_M,
  accuracyRadius,
  farFromDay,
  framesWithDay,
  hereBesideDay,
  hereFix,
  locationTrouble,
} from "./live-location.ts";

const montreal = { lat: 45.5231, lon: -73.5817 };
const oldPort = { lat: 45.5075, lon: -73.554 };
const quebec = { lat: 46.8139, lon: -71.208 };

test("a reading becomes a fix, keeping its accuracy", () => {
  assert.deepEqual(hereFix({ latitude: 45.5, longitude: -73.6, accuracy: 12 }), {
    lat: 45.5,
    lon: -73.6,
    accuracy: 12,
  });
});

test("a reading with no usable accuracy is still a position", () => {
  assert.equal(hereFix({ latitude: 45.5, longitude: -73.6, accuracy: null })?.accuracy, 0);
  assert.equal(hereFix({ latitude: 45.5, longitude: -73.6, accuracy: NaN })?.accuracy, 0);
});

test("a reading off the globe is not a fix", () => {
  assert.equal(hereFix({ latitude: NaN, longitude: 0 }), null);
  assert.equal(hereFix({ latitude: 91, longitude: 0 }), null);
});

const fixAt = (at: { lat: number; lon: number }) => ({ ...at, accuracy: 10 });

test("near the day, you are framed with its stops", () => {
  assert.equal(framesWithDay(hereBesideDay(fixAt(montreal), [oldPort]).nearestM), true);
});

test("far from the day, the map stays put and says how far", () => {
  const { nearestM } = hereBesideDay(fixAt(montreal), [quebec]);
  assert.equal(framesWithDay(nearestM), false);
  assert.match(farFromDay(nearestM), /^You're \d+ km from this day's stops\.$/);
  assert.equal(framesWithDay(hereBesideDay(fixAt(montreal), []).nearestM), false);
});

test("the nearest stop decides, not the first", () => {
  assert.equal(framesWithDay(hereBesideDay(fixAt(montreal), [quebec, oldPort]).nearestM), true);
});

test("across the date line you are drawn beside the stop, not a world away", () => {
  const { at, nearestM } = hereBesideDay(fixAt({ lat: -16.8, lon: -179.9 }), [
    { lat: -16.8, lon: 179.9 },
  ]);
  assert.ok(Math.abs(at.lon - 180.1) < 1e-9);
  assert.ok(nearestM < 25_000);
});

test("on the same side of the date line nothing moves", () => {
  assert.equal(hereBesideDay(fixAt(montreal), [oldPort]).at.lon, montreal.lon);
});

test("a vague fix gets no circle", () => {
  assert.equal(accuracyRadius({ ...montreal, accuracy: 20 }), 20);
  assert.equal(accuracyRadius({ ...montreal, accuracy: 0 }), 0);
  assert.equal(accuracyRadius({ ...montreal, accuracy: HERE_ACCURACY_MAX_M + 1 }), 0);
});

test("a refusal inside a frame says to open Béa in its own tab", () => {
  assert.match(locationTrouble(1, true), /own tab/);
  assert.match(locationTrouble(1, false), /address bar/);
  assert.match(locationTrouble(3, false), /a while/);
  assert.match(locationTrouble(2, false), /isn't available/);
});
