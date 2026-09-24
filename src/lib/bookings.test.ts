import { strict as assert } from "node:assert";
import { test } from "node:test";
import { cleanBookingText, isBooked, isMissingColumn } from "./bookings.ts";

const cols = ["booked", "booking_ref", "booking_details"];

test("a missing booking column is recognised, other errors are not", () => {
  assert.equal(
    isMissingColumn(
      { code: "42703", message: "column itinerary_items.booked does not exist" },
      cols,
    ),
    true,
  );
  assert.equal(
    isMissingColumn({ code: "PGRST204", message: "Could not find the 'booking_ref' column" }, cols),
    true,
  );
  assert.equal(
    isMissingColumn(
      { code: "42501", message: "permission denied for table itinerary_items" },
      cols,
    ),
    false,
  );
  assert.equal(
    isMissingColumn({ code: "42703", message: "column title does not exist" }, cols),
    false,
    "another column",
  );
  assert.equal(isMissingColumn(null, cols), false);
});

test("only an explicit true is booked", () => {
  assert.equal(isBooked({ booked: true }), true);
  assert.equal(isBooked({ booked: false }), false);
  assert.equal(isBooked({ booked: null }), false);
  assert.equal(isBooked({}), false, "before the migration");
});

test("booking text is trimmed, capped and empty becomes null", () => {
  assert.equal(cleanBookingText("  MBAM-4471 ", 200), "MBAM-4471");
  assert.equal(cleanBookingText("   ", 200), null);
  assert.equal(cleanBookingText("x".repeat(250), 200)!.length, 200);
});
