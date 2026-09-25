import { strict as assert } from "node:assert";
import { test } from "node:test";
import { IcsReadError, icsToParsedItinerary, looksLikeIcs } from "./itinerary-ics.ts";

const cal = (...events: string[]) =>
  ["BEGIN:VCALENDAR", "VERSION:2.0", ...events, "END:VCALENDAR"].join("\r\n");
const event = (...lines: string[]) => ["BEGIN:VEVENT", ...lines, "END:VEVENT"].join("\r\n");

test("looksLikeIcs tells a calendar from a page", () => {
  assert.equal(looksLikeIcs("BEGIN:VCALENDAR\r\nVERSION:2.0"), true);
  assert.equal(looksLikeIcs("\uFEFF  BEGIN:VCALENDAR"), true);
  assert.equal(looksLikeIcs("<html>BEGIN:VCALENDAR</html>"), false);
});

test("a zoned time is kept as the local clock time where it happens", () => {
  const out = icsToParsedItinerary(
    cal(
      event(
        "SUMMARY:Dinner at Sushi Saito",
        "DTSTART;TZID=Asia/Tokyo:20261003T190000",
        "DTEND;TZID=Asia/Tokyo:20261003T210000",
        "LOCATION:Sushi Saito\\, 1-4-5 Roppongi\\, Minato\\, Tokyo",
        "DESCRIPTION:Confirmation number: 8812",
      ),
    ),
  );
  const [item] = out.items;
  assert.equal(item?.day_date, "2026-10-03");
  assert.equal(item?.time_label, "19:00");
  assert.equal(item?.end_time, "21:00");
  assert.equal(item?.duration_minutes, 120);
  assert.equal(item?.place, "Sushi Saito");
  assert.equal(item?.address, "Sushi Saito, 1-4-5 Roppongi, Minato, Tokyo");
  assert.equal(item?.booked, true);
  assert.equal(item?.kind, "reservation");
  assert.equal(item?.detail, "Confirmation number: 8812");
});

test("a UTC time moves to the calendar's own zone", () => {
  const out = icsToParsedItinerary(
    cal(
      "X-WR-TIMEZONE:Europe/Paris",
      event("SUMMARY:Louvre", "DTSTART:20260715T080000Z", "DTEND:20260715T100000Z"),
    ),
  );
  assert.equal(out.items[0]?.time_label, "10:00");
  assert.equal(out.items[0]?.end_time, "12:00");
});

test("a UTC time with no zone to go by is not guessed", () => {
  const out = icsToParsedItinerary(cal(event("SUMMARY:Pick up keys", "DTSTART:20260715T233000Z")));
  assert.equal(out.items[0]?.time_label, null);
  assert.equal(out.items[0]?.day_date, "2026-07-15");
  assert.match(out.items[0]?.detail ?? "", /23:30 UTC/);
});

test("an all-day hotel stay says when it ends, with the exclusive end date undone", () => {
  const out = icsToParsedItinerary(
    cal(
      event(
        "SUMMARY:Hotel Granvia Kyoto",
        "DTSTART;VALUE=DATE:20261005",
        "DTEND;VALUE=DATE:20261008",
        "DESCRIPTION:Booking reference ABC123\\nhttps://example.com/manage",
      ),
    ),
  );
  const [item] = out.items;
  assert.equal(item?.kind, "hotel");
  assert.equal(item?.time_label, null);
  assert.match(item?.detail ?? "", /Until 2026-10-07/);
  assert.match(item?.detail ?? "", /Booking reference ABC123/);
  assert.doesNotMatch(item?.detail ?? "", /https/);
});

test("flights are read from a flight number, and only booked ones are 'flight'", () => {
  const out = icsToParsedItinerary(
    cal(
      event("SUMMARY:AC 3 Vancouver to Tokyo", "DTSTART:20261001T130000", "DESCRIPTION:PNR XYZ12"),
      event("SUMMARY:Flight home?", "DTSTART:20261010T090000"),
      event("SUMMARY:10 30 standup", "DTSTART:20261002T103000"),
    ),
  );
  assert.deepEqual(
    out.items.map((i) => i.kind),
    ["flight", "activity", "transport"],
  );
});

test("events come out in date order, cancelled ones and alarms left out", () => {
  const out = icsToParsedItinerary(
    cal(
      "X-WR-CALNAME:Japan 2026",
      event("SUMMARY:Second", "DTSTART:20261002T090000"),
      event("SUMMARY:Cancelled", "STATUS:CANCELLED", "DTSTART:20261001T080000"),
      event(
        "SUMMARY:First",
        "DTSTART:20261001T090000",
        "BEGIN:VALARM",
        "DESCRIPTION:Reminder",
        "END:VALARM",
      ),
    ),
  );
  assert.deepEqual(
    out.items.map((i) => i.title),
    ["First", "Second"],
  );
  assert.equal(out.items[0]?.detail, null);
  assert.equal(out.trip_title, "Japan 2026");
  assert.equal(out.start_date, "2026-10-01");
  assert.equal(out.end_date, "2026-10-02");
});

test("folded lines and escapes are undone", () => {
  const out = icsToParsedItinerary(
    cal(
      event(
        "SUMMARY:Tea ceremony in\r\n  Gion",
        "DTSTART:20261004T140000",
        "LOCATION:Gion\\; Kyoto",
      ),
    ),
  );
  assert.equal(out.items[0]?.title, "Tea ceremony in Gion");
  assert.equal(out.items[0]?.place, "Gion; Kyoto");
});

test("a calendar with nothing readable says so", () => {
  assert.throws(() => icsToParsedItinerary(cal()), IcsReadError);
  assert.throws(() => icsToParsedItinerary("not a calendar"), IcsReadError);
});
