import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bookingKind,
  cityStretches,
  countBookings,
  documentBookingKind,
  leavingIn,
  missingStays,
  placesForTrip,
  stretchDates,
  tripBookings,
} from "./trip-overview.ts";

test("flights, stays, other transport and activities are told apart", () => {
  assert.equal(bookingKind({ kind: "flight", title: "YUL to LIS" }), "flight");
  assert.equal(bookingKind({ kind: "transport", title: "Fly to Porto" }), "flight");
  assert.equal(bookingKind({ kind: "train", title: "Train to Sintra" }), "transport");
  assert.equal(bookingKind({ kind: "hotel", title: "Casa Azul" }), "stay");
  assert.equal(bookingKind({ kind: "meal", title: "Dinner" }), "activity");
  assert.equal(bookingKind({ kind: "sight", title: "Castle" }), "activity");
});

test("walks and notes are not bookings", () => {
  assert.equal(bookingKind({ kind: "note", title: "Bring cash" }), null);
  assert.equal(bookingKind({ kind: "activity", title: "Walk to the castle" }), null);
});

test("Trip documents count as the trip's bookings", () => {
  assert.equal(documentBookingKind("flight"), "flight");
  assert.equal(documentBookingKind("accommodation"), "stay");
  assert.equal(documentBookingKind("car"), "transport");
  assert.equal(documentBookingKind("restaurant"), "activity");
  assert.equal(documentBookingKind("other"), null);
  const counts = countBookings(
    tripBookings(
      [],
      [{ id: "d1", kind: "flight", title: "Flight confirmation", itinerary_item_id: null }],
    ),
  );
  assert.equal(counts.flight, 1);
});

test("a document linked to a booked stop is one booking, not two", () => {
  const all = tripBookings(
    [{ id: "s1", kind: "flight", title: "Flight to Lisbon", booked: true }],
    [
      { id: "d1", kind: "flight", title: "E-ticket", itinerary_item_id: "s1" },
      { id: "d2", kind: "accommodation", title: "Hotel", itinerary_item_id: null },
    ],
  );
  assert.deepEqual(countBookings(all), { flight: 1, stay: 1, transport: 0, activity: 0 });
});

test("an unbooked stop is not a booking until a document is filed to it", () => {
  const stops = [{ id: "s1", kind: "hotel", title: "Casa Azul", booked: false }];
  assert.equal(tripBookings(stops, []).length, 0);
  const withDoc = tripBookings(stops, [
    { id: "d1", kind: "other", title: "Confirmation", itinerary_item_id: "s1" },
  ]);
  assert.equal(withDoc[0]?.kind, "stay");
});

test("the overview folds the days into a stretch per city", () => {
  const route = [
    { city: "Berlin", arrive_on: "2026-10-01", depart_on: "2026-10-03" },
    { city: "Potsdam", kind: "daytrip", arrive_on: "2026-10-02", depart_on: "2026-10-02" },
    { city: "Munich", arrive_on: "2026-10-03", depart_on: "2026-10-05" },
  ];
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
  const stops = [
    { day_date: "2026-10-01" },
    { day_date: "2026-10-01" },
    { day_date: "2026-10-02" },
    { day_date: "2026-10-04" },
    { day_date: null },
  ];
  const stretches = cityStretches(days, route, stops).map((s) => [
    s.city?.city ?? null,
    s.start,
    s.end,
    s.firstDay,
    s.lastDay,
    s.stops,
  ]);
  assert.deepEqual(stretches, [
    ["Berlin", "2026-10-01", "2026-10-01", 1, 1, 2],
    ["Potsdam", "2026-10-02", "2026-10-02", 2, 2, 1],
    ["Munich", "2026-10-03", "2026-10-05", 3, 5, 1],
  ]);
});

test("a trip with no cities is one stretch of unplaced days", () => {
  const stretches = cityStretches(["2026-10-01", "2026-10-02"], [], []);
  assert.equal(stretches.length, 1);
  assert.equal(stretches[0]!.city, null);
  assert.equal(stretches[0]!.lastDay, 2);
});

test("an overnight city with no stay is named, a day trip is not", () => {
  const route = [
    { city: "Berlin", arrive_on: "2026-10-01", depart_on: "2026-10-03" },
    { city: "Potsdam", kind: "daytrip", arrive_on: "2026-10-02", depart_on: "2026-10-02" },
    { city: "Munich", arrive_on: "2026-10-03", depart_on: "2026-10-05" },
  ];
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
  const stretches = cityStretches(days, route, []);
  assert.deepEqual(
    missingStays(days, stretches, [], false).map((gap) => gap.city),
    ["Munich"],
  );
  assert.deepEqual(
    missingStays(days, stretches, ["2026-10-04"], true).map((gap) => gap.city),
    [],
  );
});

test("a multi-day trip with no overnight city and no stay says so once", () => {
  const days = ["2026-10-01", "2026-10-02"];
  const stretches = cityStretches(
    days,
    [
      { city: "Berlin", arrive_on: "2026-10-01", depart_on: "2026-10-01" },
      { city: "Prague", arrive_on: "2026-10-02", depart_on: "2026-10-02" },
    ],
    [],
  );
  assert.deepEqual(missingStays(days, stretches, [], false), [
    { city: null, start: "2026-10-01", end: "2026-10-02" },
  ]);
  assert.deepEqual(missingStays(days, stretches, [], true), []);
  assert.deepEqual(missingStays(["2026-10-01"], stretches, [], false), []);
});

test("a stay document with no day is a stay, and is not split by city", () => {
  const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
  const stretches = cityStretches(
    days,
    [{ city: "Berlin", arrive_on: "2026-10-01", depart_on: "2026-10-03" }],
    [],
  );
  assert.deepEqual(missingStays(days, stretches, [], true), []);
});

test("saved places are the trip's cities, unvisited first", () => {
  const places = [
    { name: "Old", city: "Hiroshima", visited: true },
    { name: "Café", city: "Montréal", visited: false },
    { name: "New", city: "Kyoto", visited: false },
  ];
  assert.deepEqual(
    placesForTrip(places, ["Hiroshima", "Kyoto, Japan"]).map((place) => place.name),
    ["New", "Old"],
  );
  assert.deepEqual(placesForTrip(places, []), []);
});

test("leaving in counts the days until the start", () => {
  assert.equal(leavingIn("2026-10-07", "2026-10-04"), "Leaving in 3 days");
  assert.equal(leavingIn("2026-10-05", "2026-10-04"), "Leaving tomorrow");
  assert.equal(leavingIn("2026-10-04", "2026-10-04"), "");
  assert.equal(leavingIn(null, "2026-10-04"), "");
});

test("a stretch's dates are said briefly", () => {
  assert.equal(stretchDates("2026-10-01", "2026-10-01"), "Oct 1");
  assert.equal(stretchDates("2026-10-01", "2026-10-03"), "Oct 1 – 3");
  assert.equal(stretchDates("2026-09-30", "2026-10-02"), "Sep 30 – Oct 2");
});
