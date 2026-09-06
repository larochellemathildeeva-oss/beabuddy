import { strict as assert } from "node:assert";
import { test } from "node:test";
import { tripCompanionsLine, tripStillEditableNote, TRIP_STILL_EDITABLE } from "./trip-copy.ts";

test("tripStillEditableNote picks a line and rotates by day", () => {
  const a = tripStillEditableNote(new Date(Date.UTC(2026, 0, 1)));
  const b = tripStillEditableNote(new Date(Date.UTC(2026, 0, 2)));
  assert.ok(TRIP_STILL_EDITABLE.includes(a as (typeof TRIP_STILL_EDITABLE)[number]));
  assert.ok(TRIP_STILL_EDITABLE.includes(b as (typeof TRIP_STILL_EDITABLE)[number]));
  assert.notEqual(a, b);
});

test("tripCompanionsLine is Flying Solo when nobody else is on the trip", () => {
  assert.equal(tripCompanionsLine([], "me"), "Flying Solo");
  assert.equal(
    tripCompanionsLine([{ user_id: "me", display_name: "Mathilde" }], "me"),
    "Flying Solo",
  );
});

test("tripCompanionsLine names friends and never says Traveller", () => {
  assert.equal(
    tripCompanionsLine(
      [
        { user_id: "me", display_name: "Mathilde" },
        { user_id: "pal", display_name: "Sam" },
      ],
      "me",
    ),
    "With Sam",
  );
  assert.equal(
    tripCompanionsLine([{ user_id: "pal", display_name: null }], "me"),
    "With a friend",
  );
});
