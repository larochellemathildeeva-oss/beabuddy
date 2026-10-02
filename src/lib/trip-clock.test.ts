import { strict as assert } from "node:assert";
import { test } from "node:test";
import { clockIn, dateIn, offsetMinutes, wallTimeToInstant, zoneGap } from "./trip-clock.ts";

const AT = Date.parse("2026-10-02T23:14:00Z");

test("offsets, dates and clocks in a zone", () => {
  assert.equal(offsetMinutes("Asia/Tokyo", AT), 540);
  assert.equal(offsetMinutes("America/Bahia", AT), -180);
  assert.equal(offsetMinutes("UTC", AT), 0);
  assert.equal(dateIn("Asia/Tokyo", AT), "2026-10-03");
  assert.equal(dateIn("America/Bahia", AT), "2026-10-02");
  assert.equal(clockIn("Asia/Tokyo", AT), "08:14");
  assert.equal(clockIn("America/Bahia", AT), "20:14");
});

test("a planned time on the trip, as an instant", () => {
  assert.equal(
    wallTimeToInstant("2026-10-03", "14:00", "Asia/Tokyo"),
    Date.parse("2026-10-03T05:00:00Z"),
  );
  // Read back in the reader's zone.
  const at = wallTimeToInstant("2026-10-03", "14:00", "Asia/Tokyo")!;
  assert.equal(clockIn("America/Bahia", at), "02:00");
  assert.equal(dateIn("America/Bahia", at), "2026-10-03");
  assert.equal(wallTimeToInstant("2026-10-03", "Morning", "Asia/Tokyo"), null);
  assert.equal(wallTimeToInstant("someday", "14:00", "Asia/Tokyo"), null);
});

test("planned times either side of a daylight-saving change", () => {
  // London goes to summer time at 01:00 UTC on 29 March 2026.
  assert.equal(
    wallTimeToInstant("2026-03-29", "09:00", "Europe/London"),
    Date.parse("2026-03-29T08:00:00Z"),
  );
  assert.equal(
    wallTimeToInstant("2026-03-28", "09:00", "Europe/London"),
    Date.parse("2026-03-28T09:00:00Z"),
  );
});

test("the gap between the trip and the reader", () => {
  assert.equal(zoneGap("Asia/Tokyo", "America/Bahia", AT), "12 h ahead");
  assert.equal(zoneGap("America/Bahia", "Asia/Tokyo", AT), "12 h behind");
  assert.equal(zoneGap("Asia/Kolkata", "UTC", AT), "5 h 30 min ahead");
  assert.equal(zoneGap("Asia/Tokyo", "Asia/Seoul", AT), null);
});
