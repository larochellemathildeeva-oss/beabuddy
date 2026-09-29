import { strict as assert } from "node:assert";
import { test } from "node:test";
import { remindersFor, type ReminderItem } from "./reminders.ts";

const day = "2026-10-06";
const item = (id: string, extra: Partial<ReminderItem>): ReminderItem => ({
  id,
  title: id,
  kind: "sight",
  day_date: day,
  time_label: null,
  ...extra,
});
const at = (h: number, m = 0) => ({ day, minutes: h * 60 + m });

test("a departure is reminded up to four hours ahead, a table two", () => {
  const items = [
    item("Train to Sintra", { kind: "transport", time_label: "14:20" }),
    item("Dinner", { kind: "meal", time_label: "19:30", booked: true }),
  ];
  assert.deepEqual(
    remindersFor(items, at(11)).map((r) => r.text),
    ["Train to Sintra at 14:20, in 3 h 20 min"],
  );
  assert.deepEqual(
    remindersFor(items, at(18)).map((r) => [r.when, r.text]),
    [["later", "Dinner at 19:30, in 1 h 30 min"]],
  );
  assert.equal(remindersFor(items, at(19, 10))[0]!.when, "soon");
});

test("unbooked sights and stops with no clock time are never reminded", () => {
  const items = [
    item("Museum", { time_label: "15:00" }),
    item("Flight", { kind: "flight", time_label: "Morning" }),
  ];
  assert.deepEqual(remindersFor(items, at(14)), []);
});

test("a stop already reached is done with", () => {
  const items = [
    item("Train", { kind: "transport", time_label: "14:20", arrived_at: "2026-10-06T14:00:00Z" }),
  ];
  assert.deepEqual(remindersFor(items, at(14)), []);
});

test("check-in is said as a window that opens", () => {
  const items = [item("Hotel Avenida", { kind: "hotel", time_label: "15:00" })];
  assert.equal(remindersFor(items, at(13))[0]!.text, "Check-in at Hotel Avenida from 15:00");
  assert.deepEqual(remindersFor(items, at(16)), []);
});

test("an early departure tomorrow is mentioned in the evening", () => {
  const items = [
    item("Flight to Porto", { kind: "flight", time_label: "07:40", day_date: "2026-10-07" }),
  ];
  assert.deepEqual(remindersFor(items, at(15)), []);
  assert.equal(
    remindersFor(items, at(20))[0]!.text,
    "Early start: Flight to Porto at 07:40 tomorrow",
  );
});

test("walk and drive rows between stops are not reminders", () => {
  const items = [item("Drive to Cascais", { kind: "transport", time_label: "14:20" })];
  assert.deepEqual(remindersFor(items, at(13)), []);
});
