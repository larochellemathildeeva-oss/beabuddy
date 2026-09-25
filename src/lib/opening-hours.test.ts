import { strict as assert } from "node:assert";
import { test } from "node:test";
import { closedWarning, isOpenAt, openWindowsOn, parseOpeningHours } from "./opening-hours.ts";

// 2026-10-07 is a Wednesday.
const at = (day: number, hh: number, mm = 0) => new Date(2026, 9, 5 + day, hh, mm);
const MON = 0;
const WED = 2;
const SAT = 5;
const SUN = 6;

test("weekday hours: open inside, closed outside and at the weekend", () => {
  const h = "Mo-Fr 09:00-17:00";
  assert.equal(isOpenAt(h, at(WED, 10)), true);
  assert.equal(isOpenAt(h, at(WED, 17)), false, "the end is exclusive");
  assert.equal(isOpenAt(h, at(WED, 8, 59)), false);
  assert.equal(isOpenAt(h, at(SAT, 12)), false);
});

test("several rules, split hours, and a day off", () => {
  const h = "Mo-Sa 11:00-14:00,17:00-22:00; Su off";
  assert.equal(isOpenAt(h, at(MON, 12)), true);
  assert.equal(isOpenAt(h, at(MON, 15)), false);
  assert.equal(isOpenAt(h, at(MON, 18)), true);
  assert.equal(isOpenAt(h, at(SUN, 12)), false);
});

test("a later rule overrides an earlier one for its days", () => {
  const h = "Mo-Su 09:00-17:00; Mo off";
  assert.equal(isOpenAt(h, at(MON, 10)), false);
  assert.equal(isOpenAt(h, at(WED, 10)), true);
});

test("past midnight runs into the next morning", () => {
  const h = "Fr,Sa 18:00-02:00";
  assert.equal(isOpenAt(h, at(SAT, 1)), true, "Friday night, 1 am Saturday");
  assert.equal(isOpenAt(h, at(SUN, 1)), true, "Saturday night");
  assert.equal(isOpenAt(h, at(MON, 1)), false);
});

test("24/7 and every-day hours", () => {
  assert.equal(isOpenAt("24/7", at(SUN, 3)), true);
  assert.equal(isOpenAt("10:00-18:00", at(SAT, 12)), true);
});

test("anything beyond the common subset is 'can't tell', never a guess", () => {
  assert.equal(parseOpeningHours("Mo-Fr 09:00-17:00; PH off"), null);
  assert.equal(parseOpeningHours("sunrise-sunset"), null);
  assert.equal(isOpenAt("Apr-Oct Mo-Su 09:00-18:00", at(WED, 10)), null);
  assert.equal(isOpenAt("", at(WED, 10)), null);
  assert.equal(isOpenAt(null, at(WED, 10)), null);
});

test("closedWarning speaks only when the hours say closed", () => {
  assert.match(closedWarning("Mo-Fr 09:00-17:00", "2026-10-07", "17:15")!, /closed at 17:15/);
  assert.equal(closedWarning("Mo-Fr 09:00-17:00", "2026-10-07", "10:00"), null);
  assert.equal(closedWarning("PH off", "2026-10-07", "10:00"), null, "unreadable hours");
  assert.equal(closedWarning("Mo-Fr 09:00-17:00", null, "10:00"), null, "no day");
  assert.equal(closedWarning("Mo-Fr 09:00-17:00", "2026-10-07", "Lunch"), null, "no clock time");
});

test("a day's open stretches: by weekday, closed days empty, unknown null", () => {
  const hours = "Tu-Su 10:00-18:00; Mo off";
  assert.deepEqual(openWindowsOn(hours, "2026-10-07"), [[600, 1080]]); // Wednesday
  assert.deepEqual(openWindowsOn(hours, "2026-10-05"), []); // Monday
  assert.equal(openWindowsOn("sunrise-sunset", "2026-10-07"), null);
  assert.equal(openWindowsOn(hours, "next Tuesday"), null);
  assert.equal(openWindowsOn(null, "2026-10-07"), null);
});

test("a day's open stretches: the evening before runs on into the small hours", () => {
  // Open until 02:00 on Friday night: Saturday starts open.
  assert.deepEqual(openWindowsOn("Fr 18:00-02:00; Sa 12:00-15:00", "2026-10-10"), [
    [0, 120],
    [720, 900],
  ]);
  assert.deepEqual(openWindowsOn("24/7", "2026-10-10"), [[0, 1440]]);
});
