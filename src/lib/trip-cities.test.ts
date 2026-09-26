import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_CITY,
  cityOutsideTrip,
  citiesToStops,
  rangeTap,
  tripDatesFromCities,
} from "./trip-cities.ts";

test("rangeTap keeps the calendar open after the first tap", () => {
  assert.deepEqual(rangeTap(null, "2026-10-01"), { start: "2026-10-01", end: "", done: false });
});

test("rangeTap finishes on the second tap, in either order", () => {
  assert.deepEqual(rangeTap("2026-10-01", "2026-10-05"), {
    start: "2026-10-01",
    end: "2026-10-05",
    done: true,
  });
  assert.deepEqual(rangeTap("2026-10-05", "2026-10-01"), {
    start: "2026-10-01",
    end: "2026-10-05",
    done: true,
  });
  assert.deepEqual(rangeTap("2026-10-03", "2026-10-03"), {
    start: "2026-10-03",
    end: "2026-10-03",
    done: true,
  });
});

test("tripDatesFromCities spans the first arrival to the last departure", () => {
  const cities = [
    { ...EMPTY_CITY, city: "Rio", start: "2026-10-04", end: "2026-10-08" },
    { ...EMPTY_CITY, city: "Salvador", start: "2026-10-01", end: "2026-10-04" },
    { ...EMPTY_CITY, city: "Recife", start: "2026-10-09", end: "" },
    { ...EMPTY_CITY, city: "Somewhere" },
  ];
  assert.deepEqual(tripDatesFromCities(cities), { start: "2026-10-01", end: "2026-10-09" });
  assert.deepEqual(tripDatesFromCities([EMPTY_CITY]), { start: "", end: "" });
});

test("cityOutsideTrip flags dates past either end of the trip", () => {
  const city = { ...EMPTY_CITY, start: "2026-10-01", end: "2026-10-05" };
  assert.equal(cityOutsideTrip(city, "2026-10-01", "2026-10-05"), false);
  assert.equal(cityOutsideTrip(city, "2026-10-02", "2026-10-05"), true);
  assert.equal(cityOutsideTrip(city, "2026-10-01", "2026-10-04"), true);
  assert.equal(cityOutsideTrip(city, "", ""), false);
  assert.equal(cityOutsideTrip(EMPTY_CITY, "2026-10-01", "2026-10-04"), false);
});

test("citiesToStops keeps named cities in order with their dates", () => {
  const stops = citiesToStops([
    { city: " Rio ", country: "Brazil", lat: 1, lon: 2, start: "2026-10-01", end: "2026-10-03" },
    { ...EMPTY_CITY },
    { ...EMPTY_CITY, city: "Recife", start: "2026-10-04", end: "" },
  ]);
  assert.deepEqual(stops, [
    {
      city: "Rio",
      country: "Brazil",
      lat: 1,
      lon: 2,
      arrive_on: "2026-10-01",
      depart_on: "2026-10-03",
    },
    {
      city: "Recife",
      country: "",
      arrive_on: "2026-10-04",
      depart_on: "2026-10-04",
    },
  ]);
});
