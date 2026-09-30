import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dayPinsToLookUp,
  planCities,
  newTowns,
  tripPlaceFromTowns,
  withCountry,
  withDayTowns,
} from "./plan-cities.ts";

const row = (city: string | null, day_date: string, kind = "sight") => ({ city, day_date, kind });

test("a plan through several towns adds each with its days", () => {
  const rows = [
    row("Montréal, Canada", "2026-10-11", "flight"),
    row("Paris, France", "2026-10-12"),
    row("Paris, France", "2026-10-13"),
    row("Lyon, France", "2026-10-13", "lodging"),
    row("Lyon, France", "2026-10-14"),
  ];
  assert.deepEqual(planCities(rows, []), [
    { city: "Paris", country: "France", arrive_on: "2026-10-12", depart_on: "2026-10-13" },
    { city: "Lyon", country: "France", arrive_on: "2026-10-13", depart_on: "2026-10-14" },
  ]);
});

test("towns the trip has already are left alone, however they are spelled", () => {
  const rows = [row("Montreal", "2026-10-11"), row("Québec City", "2026-10-13")];
  assert.deepEqual(planCities(rows, [{ city: "Montréal" }]), [
    { city: "Québec City", arrive_on: "2026-10-13", depart_on: "2026-10-13" },
  ]);
});

test("a plan in one town adds nothing to a trip that has its city", () => {
  assert.deepEqual(
    planCities([row("Paris", "2026-10-12"), row(null, "2026-10-12")], [{ city: "Paris" }]),
    [],
  );
});

test("a plan in one town gives a trip with no destinations its city", () => {
  assert.deepEqual(planCities([row("Paris", "2026-10-12"), row(null, "2026-10-13")], []), [
    { city: "Paris", arrive_on: "2026-10-12", depart_on: "2026-10-12" },
  ]);
});

test("a round trip names each town once, in the order it is reached", () => {
  const rows = [
    row("Berlin", "2026-10-01"),
    row(null, "2026-10-02", "transport"),
    row("Frankfurt", "2026-10-02"),
    row("Berlin", "2026-10-03"),
  ];
  assert.deepEqual(
    planCities(rows, []).map((c) => c.city),
    ["Berlin", "Frankfurt"],
  );
});

test("days with no town are looked up once, from a stop rather than a journey", () => {
  const rows = [
    { city: null, day_date: "2026-10-02", kind: "transport", lat: 52.5, lon: 13.4 },
    { city: null, day_date: "2026-10-02", kind: "sight", lat: 50.1, lon: 8.7 },
    { city: null, day_date: "2026-10-02", kind: "food", lat: 50.2, lon: 8.6 },
    { city: "Berlin", day_date: "2026-10-01", kind: "sight", lat: 52.5, lon: 13.4 },
    { city: null, day_date: "2026-10-03", kind: "flight", lat: 52.4, lon: 13.5 },
    { city: null, day_date: null, kind: "sight", lat: 1, lon: 1 },
  ];
  assert.deepEqual(dayPinsToLookUp(rows), [{ day: "2026-10-02", lat: 50.1, lon: 8.7 }]);
});

test("rows with no town take their day's", () => {
  const rows = [row(null, "2026-10-02"), row("Mainz", "2026-10-02"), row(null, "2026-10-03")];
  assert.deepEqual(
    withDayTowns(rows, { "2026-10-02": "Frankfurt, Germany" }).map((r) => r.city),
    ["Frankfurt, Germany", "Mainz", null],
  );
});

test("withCountry: a town the plan named alone takes the plan's country", () => {
  const row = { city: "Hiroshima", kind: "sight", day_date: "2026-10-07" };
  assert.equal(withCountry(row, "Japan").city, "Hiroshima, Japan");
  assert.equal(withCountry({ ...row, city: "Kyoto, Japan" }, "Japan").city, "Kyoto, Japan");
  assert.equal(withCountry({ ...row, city: null }, "Japan").city, null);
  assert.equal(withCountry(row, null).city, "Hiroshima");
});

test("tripPlaceFromTowns: a trip with no starting city takes the plan's first town", () => {
  const towns = [
    { city: "Kyoto", country: "Japan" },
    { city: "Osaka", country: "Japan" },
    { city: "Hiroshima", country: "Japan" },
  ];
  assert.deepEqual(tripPlaceFromTowns({}, towns), { city: "Kyoto", country: "Japan" });
  assert.deepEqual(tripPlaceFromTowns({ city: "", country: null }, towns.slice(1)), {
    city: "Osaka",
    country: "Japan",
  });
  // A trip filed under the country takes the town and keeps its country.
  assert.deepEqual(tripPlaceFromTowns({ country: "Japan" }, towns), { city: "Kyoto" });
  // Several countries: the first town's own.
  assert.deepEqual(tripPlaceFromTowns({}, [{ city: "Seoul", country: "South Korea" }, ...towns]), {
    city: "Seoul",
    country: "South Korea",
  });
  // Towns without a country take the one the plan was placed in.
  assert.deepEqual(tripPlaceFromTowns({}, [{ city: "Kyoto" }, { city: "Osaka" }], "Japan"), {
    city: "Kyoto",
    country: "Japan",
  });
  assert.deepEqual(tripPlaceFromTowns({}, [{ city: "Kyoto" }]), { city: "Kyoto" });
});

test("tripPlaceFromTowns: a starting city already set, or a town in another country, is kept out", () => {
  const towns = [{ city: "Kyoto", country: "Japan" }];
  assert.equal(tripPlaceFromTowns({ city: "Tokyo", country: "Japan" }, towns), null);
  assert.equal(tripPlaceFromTowns({ country: "France" }, towns), null);
  assert.equal(tripPlaceFromTowns({}, []), null);
});

test("newTowns: the plan's towns the route lacks, one-town plans only onto an empty route", () => {
  const all = [
    { city: "Tokyo", country: "Japan" },
    { city: "Kyoto", country: "Japan" },
  ];
  assert.deepEqual(newTowns(all, [{ city: "Tokyo" }]), [{ city: "Kyoto", country: "Japan" }]);
  assert.deepEqual(newTowns(all.slice(0, 1), []), all.slice(0, 1));
  assert.deepEqual(newTowns(all.slice(1), [{ city: "Tokyo" }]), []);
  assert.deepEqual(newTowns(all, [{ city: "tokyo" }, { city: "Kyóto" }]), []);
});
