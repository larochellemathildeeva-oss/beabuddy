import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  HERE_ACCURACY_MAX_M,
  accuracyRadius,
  hereFix,
  hereFraming,
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

test("near the day, you are framed with its stops", () => {
  assert.equal(hereFraming(montreal, [oldPort]), "with-day");
});

test("far from the day, the map goes to you alone", () => {
  assert.equal(hereFraming(montreal, [quebec]), "alone");
  assert.equal(hereFraming(montreal, []), "alone");
});

test("the nearest stop decides, not the first", () => {
  assert.equal(hereFraming(montreal, [quebec, oldPort]), "with-day");
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
