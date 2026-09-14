import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cleanPageTitle,
  isPlaceUrl,
  placeCoordsFromUrl,
  placePathSegment,
  resolvePlaceCoords,
  splitPlacePathName,
  viewportCoordsFromUrl,
} from "./place-link.ts";

const SHORT = "https://maps.app.goo.gl/AbCdEf";
const RESOLVED =
  "https://www.google.com/maps/place/Eiffel+Tower,+Av.+Gustave+Eiffel,+75007+Paris,+France/@48.8582,2.2944,17z/data=!3m1!4b1!4m6!3m5!1s0x47e66e2964e34e2d!8m2!3d48.8583701!4d2.2944813";

test("the pin beats the viewport centre", () => {
  // @ says 48.8582, the !3d pin says 48.8583701 — the pin is the place.
  assert.deepEqual(placeCoordsFromUrl(RESOLVED), { lat: 48.8583701, lon: 2.2944813 });
});

test("a place URL with only an @ pair still yields coordinates", () => {
  const url = "https://www.google.com/maps/place/Bar+Raval/@43.6569,-79.4128,17z";
  assert.deepEqual(placeCoordsFromUrl(url), { lat: 43.6569, lon: -79.4128 });
});

test("a bare map view is a viewport, not a place", () => {
  const url = "https://www.google.com/maps/@43.6569,-79.4128,12z";
  assert.equal(placeCoordsFromUrl(url), undefined);
  assert.deepEqual(viewportCoordsFromUrl(url), { lat: 43.6569, lon: -79.4128 });
});

test("Apple Maps query parameters are place coordinates", () => {
  assert.deepEqual(placeCoordsFromUrl("https://maps.apple.com/?ll=48.8584,2.2945&q=Eiffel"), {
    lat: 48.8584,
    lon: 2.2945,
  });
  assert.deepEqual(
    placeCoordsFromUrl("https://maps.apple.com/place?coordinate=43.65,-79.41&name=Bar"),
    { lat: 43.65, lon: -79.41 },
  );
});

test("integer coordinates are accepted", () => {
  assert.deepEqual(placeCoordsFromUrl("https://maps.apple.com/?ll=48,2"), { lat: 48, lon: 2 });
});

test("nonsense coordinates are refused", () => {
  assert.equal(placeCoordsFromUrl("https://maps.apple.com/?ll=999,2"), undefined);
  assert.equal(placeCoordsFromUrl("https://maps.apple.com/?ll=0,0"), undefined);
  assert.equal(placeCoordsFromUrl("https://maps.apple.com/?q=Eiffel+Tower"), undefined);
});

test("a shared short link keeps the coordinates it resolves to", () => {
  // The regression: the short link carries none, and the resolved place URL's
  // coordinates were being discarded because a place name had been found.
  assert.deepEqual(resolvePlaceCoords(SHORT, RESOLVED, true), {
    lat: 48.8583701,
    lon: 2.2944813,
  });
});

test("a redirect's viewport centre is still not trusted", () => {
  const viewportOnly = "https://www.google.com/maps/@48.85,2.29,12z";
  assert.equal(resolvePlaceCoords(SHORT, viewportOnly, true), undefined);
});

test("a viewport in what you actually pasted is used as a fallback", () => {
  const pasted = "https://www.google.com/maps/@48.85,2.29,12z";
  assert.deepEqual(resolvePlaceCoords(pasted, pasted, false), { lat: 48.85, lon: 2.29 });
});

test("coordinates in the pasted link win over the resolved one", () => {
  const pasted = "https://maps.apple.com/?ll=10.5,20.5";
  assert.deepEqual(resolvePlaceCoords(pasted, RESOLVED, true), { lat: 10.5, lon: 20.5 });
});

test("placePathSegment decodes the name out of the path", () => {
  assert.equal(placePathSegment(RESOLVED), "Eiffel Tower, Av. Gustave Eiffel, 75007 Paris, France");
  assert.equal(placePathSegment("https://maps.app.goo.gl/AbCdEf"), "");
});

test("placePathSegment survives broken percent-encoding", () => {
  assert.equal(placePathSegment("https://www.google.com/maps/place/Caf%E9+Flore"), "Caf%E9 Flore");
});

test("splitPlacePathName pulls the address out of the name", () => {
  assert.deepEqual(splitPlacePathName("Eiffel Tower, Av. Gustave Eiffel, 75007 Paris, France"), {
    name: "Eiffel Tower",
    address: "Av. Gustave Eiffel, 75007 Paris, France",
  });
});

test("splitPlacePathName leaves a plain name alone", () => {
  assert.deepEqual(splitPlacePathName("Bar Raval"), { name: "Bar Raval" });
  assert.deepEqual(splitPlacePathName(""), { name: "" });
});

test("splitPlacePathName keeps a name that is only name and city", () => {
  // "Bar Raval, Toronto" is two parts with no number — that is still a place
  // name plus its city, which belongs together rather than as an address.
  assert.deepEqual(splitPlacePathName("Bar Raval, Toronto"), { name: "Bar Raval, Toronto" });
});

test("splitPlacePathName treats a house number as an address", () => {
  assert.deepEqual(splitPlacePathName("Joe's Diner, 12 Main St"), {
    name: "Joe's Diner",
    address: "12 Main St",
  });
});

test("isPlaceUrl distinguishes a place from a map view", () => {
  assert.equal(isPlaceUrl(RESOLVED), true);
  assert.equal(isPlaceUrl("https://www.google.com/maps/@48.85,2.29,12z"), false);
});

test("cleanPageTitle strips map branding", () => {
  assert.equal(cleanPageTitle("Eiffel Tower - Google Maps"), "Eiffel Tower");
  assert.equal(cleanPageTitle("Google Maps"), "");
  assert.equal(cleanPageTitle("Apple Maps"), "");
  assert.equal(cleanPageTitle("Bar Raval · Toronto"), "Bar Raval");
});
