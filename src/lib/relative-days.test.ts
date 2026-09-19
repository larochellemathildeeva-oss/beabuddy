import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hasRelativeDays,
  lastDayDate,
  relativeDayCount,
  resolveDayDates,
} from "./relative-days.ts";

const row = (day_number: number | null, day_date: string | null = null) => ({
  day_date,
  ...(day_number === null ? {} : { day_number }),
});

test("hasRelativeDays spots a plan that knows its days but not its dates", () => {
  assert.equal(hasRelativeDays([row(1), row(2)]), true);
  assert.equal(hasRelativeDays([row(1, "2026-05-04")]), false);
  assert.equal(hasRelativeDays([row(null)]), false);
  assert.equal(hasRelativeDays([]), false);
});

test("relativeDayCount counts the days, not the rows", () => {
  assert.equal(relativeDayCount([row(1), row(1), row(1), row(2), row(2)]), 2);
  assert.equal(relativeDayCount([row(null), row(null)]), 0);
});

test("resolveDayDates counts day 1 as the start date itself", () => {
  const out = resolveDayDates([row(1), row(2), row(3)], "2026-05-04");
  assert.deepEqual(
    out.map((r) => r.day_date),
    ["2026-05-04", "2026-05-05", "2026-05-06"],
  );
});

test("resolveDayDates crosses a month boundary correctly", () => {
  const out = resolveDayDates([row(1), row(2)], "2026-05-31");
  assert.deepEqual(
    out.map((r) => r.day_date),
    ["2026-05-31", "2026-06-01"],
  );
});

test("resolveDayDates never overwrites a date the source actually stated", () => {
  const out = resolveDayDates([row(1, "2026-12-25"), row(2)], "2026-05-04");
  assert.equal(out[0]!.day_date, "2026-12-25");
  assert.equal(out[1]!.day_date, "2026-05-05");
});

test("resolveDayDates leaves a row with no day at all alone", () => {
  // Sweeping it onto day one would be a date nobody chose, quietly wrong.
  const out = resolveDayDates([row(null), row(2)], "2026-05-04");
  assert.equal(out[0]!.day_date, null);
  assert.equal(out[1]!.day_date, "2026-05-05");
});

test("resolveDayDates ignores a nonsense day number", () => {
  const out = resolveDayDates([{ day_date: null, day_number: 0 }], "2026-05-04");
  assert.equal(out[0]!.day_date, null);
});

test("resolveDayDates returns the rows unchanged when the start date is junk", () => {
  const out = resolveDayDates([row(1)], "not a date");
  assert.equal(out[0]!.day_date, null);
});

test("lastDayDate finds the end of a resolved plan", () => {
  assert.equal(lastDayDate(resolveDayDates([row(1), row(2), row(3)], "2026-05-04")), "2026-05-06");
  assert.equal(lastDayDate([row(null)]), null);
});
