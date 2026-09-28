import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_CITY,
  cityOutsideTrip,
  citiesToStops,
  destinationCities,
  groupsInCity,
  missingTripCity,
  planScope,
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

const brazil = {
  city: "Barreirinhas",
  country: "Brazil",
  start_date: "2026-10-01",
  end_date: "2026-10-06",
};

test("missingTripCity brings back the city the trip was made for", () => {
  const rio = { city: "Rio de Janeiro", country: "Brazil", arrive_on: "2026-10-04" };
  assert.deepEqual(missingTripCity(brazil, [rio]), {
    city: "Barreirinhas",
    country: "Brazil",
    arrive_on: "2026-10-01",
    depart_on: "2026-10-04",
  });
});

test("missingTripCity ends the first city where the next one starts", () => {
  assert.equal(missingTripCity(brazil, [], { arrive_on: "2026-10-03" })?.depart_on, "2026-10-03");
  assert.equal(missingTripCity(brazil, [])?.depart_on, "2026-10-06");
});

test("missingTripCity is quiet when the list already has it, in any spelling", () => {
  assert.equal(missingTripCity(brazil, [{ city: "barreirinhas " }]), null);
  assert.equal(
    missingTripCity({ city: "São Paulo", country: "Brazil" }, [{ city: "Sao Paulo" }]),
    null,
  );
  assert.equal(missingTripCity({ city: "" }, []), null);
  assert.equal(missingTripCity({ city: "Brazil", country: "Brazil" }, []), null);
});

test("destinationCities leaves stopovers out", () => {
  const stops = [
    { city: "Lisbon", kind: "layover" },
    { city: "Rio", kind: "destination" },
    { city: " ", kind: "destination" },
  ];
  assert.deepEqual(
    destinationCities(stops).map((s) => s.city),
    ["Rio"],
  );
});

test("groupsInCity keeps the days spent in that city", () => {
  const a = { city: "Barreirinhas", arrive_on: "2026-10-01", depart_on: "2026-10-03" };
  const b = { city: "Rio", arrive_on: "2026-10-03", depart_on: "2026-10-06" };
  const group = (key: string) => ({ key, label: key, items: [{ day_date: key || null }] });
  const groups = [group("2026-10-01"), group("2026-10-02"), group("2026-10-03"), group("")];
  assert.deepEqual(
    groupsInCity(groups, [a, b], a).map((g) => g.key),
    ["2026-10-01", "2026-10-02"],
  );
  assert.deepEqual(
    groupsInCity(groups, [a, b], b).map((g) => g.key),
    ["2026-10-03"],
  );
});

test("planScope reads a plan in the chosen city, on its dates", () => {
  const trip = { city: "Barreirinhas, Brazil", startDate: "2026-10-01", endDate: "2026-10-06" };
  assert.deepEqual(planScope(trip, null), trip);
  assert.deepEqual(
    planScope(trip, {
      city: "Rio de Janeiro",
      country: "Brazil",
      arrive_on: "2026-10-04",
      depart_on: "2026-10-06",
    }),
    { city: "Rio de Janeiro, Brazil", startDate: "2026-10-04", endDate: "2026-10-06" },
  );
  assert.deepEqual(planScope(trip, { city: "Rio", country: null }), {
    city: "Rio",
    startDate: "2026-10-01",
    endDate: "2026-10-06",
  });
});
