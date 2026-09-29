import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  EMPTY_CITY,
  EMPTY_DAY_TRIP,
  cityOutsideTrip,
  citiesToStops,
  dayTripInsertAt,
  destinationCities,
  groupsInCity,
  missingTripCity,
  homeStopFollow,
  planScope,
  scopedRoute,
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
});

test("missingTripCity is not fooled by a stopover or a namesake abroad", () => {
  const paris = { city: "Paris", country: "France", start_date: "2026-10-01" };
  assert.equal(missingTripCity(paris, [{ city: "Paris", kind: "layover" }])?.city, "Paris");
  assert.equal(
    missingTripCity(paris, [{ city: "Paris", country: "United States" }])?.city,
    "Paris",
  );
  assert.equal(missingTripCity(paris, [{ city: "Paris", country: "France" }]), null);
  assert.equal(missingTripCity(paris, [{ city: "Paris" }]), null);
});

test("missingTripCity keeps the whole stay when the next stop is a day trip", () => {
  assert.equal(
    missingTripCity(brazil, [], { kind: "daytrip", arrive_on: "2026-10-03" })?.depart_on,
    "2026-10-06",
  );
});

test("planScope gives an undated city no dates of its own", () => {
  const trip = { city: "Barreirinhas, Brazil", startDate: "2026-10-01", endDate: "2026-10-06" };
  assert.deepEqual(planScope(trip, { city: "Rio", country: null }), { city: "Rio" });
});

test("scopedRoute places a city's plan in that city alone", () => {
  const route = [
    { city: "Barreirinhas", country: "Brazil", arrive_on: "2026-10-01" },
    { city: "Rio", country: "Brazil", arrive_on: "2026-10-04" },
    { city: "Salvador", country: "Brazil", arrive_on: null },
  ];
  assert.deepEqual(
    scopedRoute(route, { city: "Rio", country: "Brazil", arrive_on: "2026-10-04" }).map(
      (c) => c.city,
    ),
    ["Rio"],
  );
  const undated = scopedRoute(route, { city: "Salvador", country: "Brazil" });
  assert.deepEqual(
    undated.map((c) => c.city),
    ["Salvador"],
  );
  assert.deepEqual(scopedRoute([], { city: "Recife", country: "Brazil" }), [
    {
      city: "Recife",
      country: "Brazil",
      arrive_on: null,
      depart_on: null,
      lat: null,
      lon: null,
    },
  ]);
});

test("homeStopFollow moves the copied first city with the trip", () => {
  const before = {
    city: "Barreirinhas",
    country: "Brazil",
    start_date: "2026-10-01",
    end_date: "2026-10-06",
  };
  const home = {
    id: "a",
    position: 0,
    kind: "destination",
    city: "Barreirinhas",
    country: "Brazil",
    arrive_on: "2026-10-01",
    depart_on: "2026-10-04",
  };
  const rio = { ...home, id: "b", position: 1, city: "Rio", arrive_on: "2026-10-04" };
  assert.deepEqual(homeStopFollow(before, { city: "Jericoacoara" }, [rio, home]), {
    id: "a",
    patch: { city: "Jericoacoara", country: "Brazil", lat: null, lon: null },
  });
  // Its own end date was set by the traveller, so only the start follows.
  assert.deepEqual(
    homeStopFollow(before, { start_date: "2026-09-30", end_date: "2026-10-07" }, [home, rio]),
    { id: "a", patch: { arrive_on: "2026-09-30" } },
  );
  // A first stop that is not the trip's city is the traveller's own.
  assert.equal(homeStopFollow(before, { city: "Jericoacoara" }, [rio]), null);
  assert.equal(homeStopFollow(before, { title: "x" } as never, [home]), null);
});
