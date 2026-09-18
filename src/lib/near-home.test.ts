import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nearestPin, nearHomeView } from "./near-home.ts";

const HERE = { lat: 45.5017, lon: -73.5673 }; // Montréal
const near = { id: "near", lat: 45.5025, lon: -73.5685 }; // ~150 m
const acrossTown = { id: "across", lat: 45.5388, lon: -73.6031 }; // ~5 km
const abroad = { id: "abroad", lat: 48.8566, lon: 2.3522 }; // Paris

const base = { consent: true, located: true, here: HERE, radius: 1_000 };

test("nearHomeView says nothing when no saved place has a location", () => {
  assert.equal(nearHomeView({ ...base, pins: [] }).kind, "hidden");
});

test("nearHomeView offers to locate you before consent, and while locating", () => {
  assert.equal(nearHomeView({ ...base, consent: false, pins: [near] }).kind, "offer");
  assert.equal(nearHomeView({ ...base, located: false, pins: [near] }).kind, "offer");
  assert.equal(nearHomeView({ ...base, here: null, pins: [near] }).kind, "offer");
});

test("nearHomeView lists what is inside the radius", () => {
  const view = nearHomeView({ ...base, pins: [abroad, near] });
  assert.equal(view.kind, "places");
  assert.deepEqual(view.kind === "places" && view.rows.map((r) => r.pin.id), ["near"]);
});

test("nearHomeView names the nearest place even when it is far outside the radius", () => {
  // The ordinary case at home: a vault full of places abroad.
  const view = nearHomeView({ ...base, pins: [abroad] });
  assert.equal(view.kind, "none-near");
  assert.equal(view.kind === "none-near" && view.nearest?.pin.id, "abroad");
  // Roughly Montréal to Paris; enough to prove it measured rather than guessed.
  const metres = view.kind === "none-near" ? (view.nearest?.metres ?? 0) : 0;
  assert.ok(metres > 5_000_000 && metres < 6_000_000, `got ${metres}`);
});

test("dismissing the last place nearby reads as nothing near, not as places", () => {
  // The two components used to disagree here: Home kept its heading and the
  // list under it came back empty.
  const view = nearHomeView({ ...base, pins: [near, abroad], dismissed: ["near"] });
  assert.equal(view.kind, "none-near");
  assert.equal(view.kind === "none-near" && view.nearest?.pin.id, "abroad");
});

test("a dismissed place is not offered as the nearest one either", () => {
  const view = nearHomeView({ ...base, pins: [near], dismissed: ["near"] });
  assert.equal(view.kind, "none-near");
  assert.equal(view.kind === "none-near" && view.nearest, null);
});

test("widening the radius brings a place back into reach", () => {
  const pins = [acrossTown];
  assert.equal(nearHomeView({ ...base, pins, radius: 1_000 }).kind, "none-near");
  assert.equal(nearHomeView({ ...base, pins, radius: 25_000 }).kind, "places");
});

test("nearestPin needs a position and gives up without one", () => {
  assert.equal(nearestPin(null, [near]), null);
  assert.equal(nearestPin(HERE, []), null);
  assert.equal(nearestPin(HERE, [abroad, near])?.pin.id, "near");
});
