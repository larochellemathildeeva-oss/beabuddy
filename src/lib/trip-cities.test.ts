import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_CITY,
  EMPTY_DAY_TRIP,
  cityOutsideTrip,
  citiesToStops,
  dayTripInsertAt,
  dayTripOutsideBase,
  onePlaceStops,
  rangeTap,
  routeStopLine,
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

test("a day trip saves as one day, marked as a day trip", () => {
  const stops = citiesToStops([
    { ...EMPTY_CITY, city: "Kyoto", start: "2026-10-01", end: "2026-10-07" },
    { ...EMPTY_DAY_TRIP, city: "Hiroshima", start: "2026-10-04", end: "2026-10-05" },
  ]);
  assert.equal(stops[0]?.kind, undefined);
  assert.deepEqual(stops[1], {
    kind: "daytrip",
    city: "Hiroshima",
    country: "",
    arrive_on: "2026-10-04",
    depart_on: "2026-10-04",
  });
});

test("one place with day trips saves the place, then each day trip", () => {
  const place = { city: "Kyoto", country: "Japan", start: "2026-10-01", end: "2026-10-07" };
  assert.deepEqual(onePlaceStops(place, []), []);
  // A day trip left blank is not a reason to give the trip stops.
  assert.deepEqual(onePlaceStops(place, [EMPTY_DAY_TRIP]), []);
  const stops = onePlaceStops(place, [
    { ...EMPTY_DAY_TRIP, city: "Hiroshima", start: "2026-10-04", end: "2026-10-04" },
  ]);
  assert.deepEqual(
    stops.map((s) => [s.kind ?? "destination", s.city, s.arrive_on, s.depart_on]),
    [
      ["destination", "Kyoto", "2026-10-01", "2026-10-07"],
      ["daytrip", "Hiroshima", "2026-10-04", "2026-10-04"],
    ],
  );
});

test("a new day trip goes under its city, after the ones already there", () => {
  const list = [
    { ...EMPTY_CITY, city: "Kyoto" },
    { ...EMPTY_DAY_TRIP, city: "Nara" },
    { ...EMPTY_CITY, city: "Tokyo" },
  ];
  assert.equal(dayTripInsertAt(list, 0), 2);
  assert.equal(dayTripInsertAt(list, 2), 3);
});

test("a day trip outside its city's stay is flagged", () => {
  const list = [
    { ...EMPTY_CITY, city: "Kyoto", start: "2026-10-01", end: "2026-10-07" },
    { ...EMPTY_DAY_TRIP, city: "Hiroshima", start: "2026-10-09", end: "2026-10-09" },
    { ...EMPTY_DAY_TRIP, city: "Nara", start: "2026-10-03", end: "2026-10-03" },
  ];
  assert.equal(dayTripOutsideBase(list, 0), false);
  assert.equal(dayTripOutsideBase(list, 1), true);
  assert.equal(dayTripOutsideBase(list, 2), false);
});

test("the route tells the planner a day trip sleeps in its base", () => {
  const stops = [
    {
      city: "Kyoto, Kyoto Prefecture",
      country: "Japan",
      arrive_on: "2026-10-01",
      depart_on: "2026-10-07",
    },
    {
      kind: "daytrip",
      city: "Hiroshima",
      country: "Japan",
      arrive_on: "2026-10-04",
      depart_on: "2026-10-04",
    },
  ];
  assert.equal(routeStopLine(stops, 0), "Kyoto, Kyoto Prefecture, Japan (2026-10-01 – 2026-10-07)");
  assert.equal(
    routeStopLine(stops, 1),
    "Hiroshima, Japan (2026-10-04) — day trip from Kyoto; nights stay in Kyoto",
  );
});
