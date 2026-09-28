import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bookingKind, countBookings, documentBookingKind, tripBookings } from "./trip-overview.ts";

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
