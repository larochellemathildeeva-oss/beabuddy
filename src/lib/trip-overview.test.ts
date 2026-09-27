import { strict as assert } from "node:assert";
import { test } from "node:test";
import { bookingKind } from "./trip-overview.ts";

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
