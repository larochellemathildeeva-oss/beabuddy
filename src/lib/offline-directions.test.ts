import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  directionsSignature,
  savedAgoLabel,
  savedIsStale,
  savedMatchesStops,
  storageFailureMessage,
} from "./offline-directions.ts";

const stops = [
  { title: "Hotel Lux", address: "1 Rua A", lat: 38.7223, lon: -9.1393 },
  { title: "Time Out Market", address: "Av. 24 de Julho", lat: 38.7071, lon: -9.1459 },
];

test("directionsSignature is stable across harmless differences", () => {
  assert.equal(
    directionsSignature(stops),
    directionsSignature([
      { title: "  hotel lux ", address: "1 Rua A", lat: 38.72231, lon: -9.13934 },
      { title: "TIME OUT MARKET", address: "av. 24 de julho", lat: 38.7071, lon: -9.1459 },
    ]),
  );
});

test("directionsSignature changes when a stop is added", () => {
  const more = [...stops, { title: "Belém", lat: 38.6972, lon: -9.2065 }];
  assert.notEqual(directionsSignature(stops), directionsSignature(more));
});

test("directionsSignature changes when a stop is reordered", () => {
  assert.notEqual(directionsSignature(stops), directionsSignature([...stops].reverse()));
});

test("directionsSignature changes when a pin moves", () => {
  const moved = [{ ...stops[0]!, lat: 38.8 }, stops[1]!];
  assert.notEqual(directionsSignature(stops), directionsSignature(moved));
});

test("directionsSignature copes with missing coordinates", () => {
  const vague = [{ title: "Hotel Lux" }, { title: "Time Out Market" }];
  assert.equal(directionsSignature(vague), directionsSignature([...vague]));
  assert.notEqual(directionsSignature(vague), directionsSignature(stops));
});

test("savedMatchesStops recognises its own stop list", () => {
  assert.equal(savedMatchesStops(directionsSignature(stops), stops), true);
  assert.equal(savedMatchesStops(directionsSignature(stops), [...stops].reverse()), false);
});

test("a download from before signatures existed is neither matched nor stale", () => {
  assert.equal(savedMatchesStops(undefined, stops), false);
  assert.equal(savedIsStale(undefined, stops), false);
});

test("savedIsStale fires only on a real change", () => {
  assert.equal(savedIsStale(directionsSignature(stops), stops), false);
  assert.equal(savedIsStale(directionsSignature(stops), [...stops].reverse()), true);
});

test("savedAgoLabel reads like a person wrote it", () => {
  const now = new Date("2026-04-10T12:00:00Z");
  const ago = (ms: number) => savedAgoLabel(new Date(now.getTime() - ms).toISOString(), now);
  assert.equal(ago(10_000), "Saved just now");
  assert.equal(ago(5 * 60_000), "Saved 5 min ago");
  assert.equal(ago(3 * 3_600_000), "Saved 3 h ago");
  assert.equal(ago(24 * 3_600_000), "Saved yesterday");
  assert.equal(ago(4 * 24 * 3_600_000), "Saved 4 days ago");
});

test("savedAgoLabel survives a corrupt timestamp", () => {
  assert.equal(savedAgoLabel("not a date"), "Saved");
});

test("storageFailureMessage separates a full disk from a blocked one", () => {
  const quota = Object.assign(new Error("QuotaExceededError"), { name: "QuotaExceededError" });
  assert.match(storageFailureMessage(quota), /no room/);
  assert.match(storageFailureMessage(new Error("denied")), /Private browsing/);
});

test("storageFailureMessage never blames the routing", () => {
  assert.match(storageFailureMessage(new Error("denied")), /directions worked/);
});
