import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dayTripCity, dayTripTitle, matchDayTripPlace } from "./day-trip.ts";

test("dayTripCity picks the most common city", () => {
  assert.equal(
    dayTripCity([{ city: "Toronto" }, { city: "Toronto" }, { city: "Hamilton" }]),
    "Toronto",
  );
  assert.equal(dayTripCity([{ city: "" }, { city: null }]), "");
});

test("matchDayTripPlace keeps the saved name through accents", () => {
  const places = [
    { name: "Café Diplomatico", lat: 1, lon: 2 },
    { name: "High Park", lat: 3, lon: 4 },
  ];
  assert.equal(matchDayTripPlace("Cafe Diplomatico", places)?.name, "Café Diplomatico");
  assert.equal(matchDayTripPlace("Morning walk in High Park", places)?.name, "High Park");
  assert.equal(matchDayTripPlace("Somewhere else", places), undefined);
});

test("dayTripTitle names the outing", () => {
  assert.equal(dayTripTitle("Toronto", "2026-09-06"), "Day trip — Toronto");
  assert.equal(dayTripTitle("", "2026-09-06"), "Day trip — 2026-09-06");
});
