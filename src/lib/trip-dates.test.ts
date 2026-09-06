import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  datesStatusOrDefault,
  formatDateRangeLabel,
  isMissingDatesStatusColumn,
  parseLocalDate,
  toLocalISODate,
} from "./trip-dates.ts";

test("formatDateRangeLabel shows a same-year range", () => {
  assert.equal(formatDateRangeLabel("2026-09-12", "2026-09-14"), "Sep 12 – Sep 14, 2026");
});

test("formatDateRangeLabel shows a single day", () => {
  assert.equal(formatDateRangeLabel("2026-09-12", "2026-09-12"), "Sep 12, 2026");
});

test("formatDateRangeLabel keeps years when they differ", () => {
  assert.equal(formatDateRangeLabel("2026-12-30", "2027-01-02"), "Dec 30, 2026 – Jan 2, 2027");
});

test("formatDateRangeLabel allows an open start", () => {
  assert.equal(formatDateRangeLabel("2026-09-12", ""), "Sep 12, 2026");
});

test("toLocalISODate round-trips a local calendar day", () => {
  const date = parseLocalDate("2026-09-12");
  assert.ok(date);
  assert.equal(toLocalISODate(date), "2026-09-12");
});

test("datesStatusOrDefault treats missing values as confirmed", () => {
  assert.equal(datesStatusOrDefault("tentative"), "tentative");
  assert.equal(datesStatusOrDefault("confirmed"), "confirmed");
  assert.equal(datesStatusOrDefault(null), "confirmed");
});

test("isMissingDatesStatusColumn recognises PostgREST wording", () => {
  assert.equal(
    isMissingDatesStatusColumn({
      message: "Could not find the 'dates_status' column of 'trips' in the schema cache",
    }),
    true,
  );
  assert.equal(isMissingDatesStatusColumn({ message: "duplicate key" }), false);
});
