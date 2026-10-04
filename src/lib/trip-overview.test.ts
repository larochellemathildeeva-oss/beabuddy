import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  beforeYouGoLine,
  bookingKind,
  cityStretches,
  countBookings,
  documentBookingKind,
  missingStays,
  overviewDayStatus,
  overviewMoment,
  stretchDates,
  tripBookings,
  unnamedStayNights,
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

test("overview leads with now, before you go, or a recap", () => {
  const now = new Date(2026, 9, 4);
  assert.equal(overviewMoment("2026-10-07", "2026-10-08", now), "before");
  assert.equal(overviewMoment("2026-10-04", "2026-10-08", now), "now");
  assert.equal(overviewMoment("2026-09-01", "2026-09-04", now), "after");
  assert.equal(overviewMoment(null, null, now), "before");
  assert.equal(beforeYouGoLine("2026-10-08", now), "Leaving in 4 days");
  assert.equal(beforeYouGoLine("2026-10-05", now), "Leaving tomorrow");
  assert.equal(beforeYouGoLine(null, now), "Dates still open");
});

test("a day card is Today or Done only while the trip is underway", () => {
  const done = [{ arrived_at: "t", left_at: "t" }];
  const open = [{ arrived_at: "t", left_at: null }];
  assert.equal(overviewDayStatus("2026-10-04", "2026-10-04", true, open), "today");
  assert.equal(overviewDayStatus("2026-10-03", "2026-10-04", true, done), "done");
  assert.equal(overviewDayStatus("2026-10-03", "2026-10-04", true, open), null);
  assert.equal(overviewDayStatus("2026-10-03", "2026-10-04", false, done), null);
  assert.equal(overviewDayStatus("2026-10-05", "2026-10-04", true, []), null);
});

test("a night with no stay is named, a day trip is not", () => {
  const route = [
    { city: "Berlin", arrive_on: "2026-10-01", depart_on: "2026-10-03" },
    { city: "Potsdam", kind: "daytrip", arrive_on: "2026-10-02", depart_on: "2026-10-02" },
    { city: "Munich", arrive_on: "2026-10-03", depart_on: "2026-10-05" },
  ];
  const days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"];
  const stretches = cityStretches(days, route, []);
  assert.deepEqual(missingStays(stretches, []), [
    { city: "Berlin", nights: 1 },
    { city: "Munich", nights: 2 },
  ]);
  assert.deepEqual(
    missingStays(stretches, [{ day_date: "2026-10-04", kind: "hotel", title: "A room" }]),
    [{ city: "Berlin", nights: 1 }],
  );
  assert.deepEqual(missingStays(cityStretches(["2026-10-01"], route.slice(0, 1), []), []), []);
  assert.equal(unnamedStayNights(["2026-10-01", "2026-10-02"], [], []), 1);
  assert.equal(
    unnamedStayNights(["2026-10-01", "2026-10-02"], [], [{ kind: "hotel", title: "Inn" }]),
    0,
  );
  assert.equal(
    unnamedStayNights(["2026-10-01", "2026-10-02"], [{ city: "Berlin", nights: 1 }], []),
    0,
  );
});

test("a stretch's dates are said briefly", () => {
  assert.equal(stretchDates("2026-10-01", "2026-10-01"), "Oct 1");
  assert.equal(stretchDates("2026-10-01", "2026-10-03"), "Oct 1 \u2013 3");
  assert.equal(stretchDates("2026-09-30", "2026-10-02"), "Sep 30 \u2013 Oct 2");
});
