import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calendarFileName, foldLine, icsText, tripCalendar } from "./itinerary-ics-export.ts";
import { icsToParsedItinerary } from "./itinerary-ics.ts";

const trip = { id: "t1", title: "Lisbon, again", start_date: "2026-10-05", end_date: "2026-10-07" };
const now = new Date(Date.UTC(2026, 8, 29, 12, 0, 0));

test("text is escaped and long lines are folded", () => {
  assert.equal(icsText("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const long = `SUMMARY:${"é".repeat(60)}`;
  const folded = foldLine(long);
  for (const line of folded.split("\r\n")) {
    assert.ok(new TextEncoder().encode(line).length <= 75);
  }
  assert.equal(folded.replace(/\r\n /g, ""), long);
});

test("timed stops last their planned stay; untimed ones are all day", () => {
  const text = tripCalendar(
    trip,
    [
      {
        id: "a",
        title: "Dinner",
        day_date: "2026-10-06",
        time_label: "23:30",
        planned_stay_minutes: 90,
        booking_ref: "X9",
        address: "Rua, 1",
      },
      { id: "b", title: "Sintra", day_date: "2026-10-07", time_label: "Morning" },
      { id: "c", title: "Walk to Alfama", day_date: "2026-10-06", time_label: "10:00" },
      { id: "d", title: "Someday", day_date: null, time_label: null },
    ],
    now,
  );
  assert.match(text, /DTSTART:20261006T233000\r\nDTEND:20261007T010000/);
  assert.match(text, /DTSTART;VALUE=DATE:20261007\r\nDTEND;VALUE=DATE:20261008/);
  assert.match(text, /LOCATION:Rua\\, 1/);
  assert.match(text, /DESCRIPTION:Booking: X9/);
  assert.doesNotMatch(text, /Walk to Alfama|Someday/);
  // The trip itself, across its dates, end exclusive.
  assert.match(text, /UID:trip-t1@bea[\s\S]*?DTEND;VALUE=DATE:20261008/);
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
});

test("Béa's own calendar reader reads the file back", () => {
  const text = tripCalendar(
    trip,
    [{ id: "a", title: "Dinner", day_date: "2026-10-06", time_label: "19:30" }],
    now,
  );
  const plan = icsToParsedItinerary(text);
  const dinner = plan.items.find((e) => e.title === "Dinner");
  assert.equal(dinner?.day_date, "2026-10-06");
  assert.match(dinner?.time_label ?? "", /19:30/);
});

test("file names are plain", () => {
  assert.equal(calendarFileName("Lisbon, again — Oct"), "lisbon-again-oct.ics");
  assert.equal(calendarFileName("東京"), "trip.ics");
});
