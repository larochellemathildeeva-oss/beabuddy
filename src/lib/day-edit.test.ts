import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  dayEditChanges,
  dayEditPrompt,
  dayEditRows,
  dayEditSchedule,
  joinAsks,
  readDayEdit,
  type DayEditStop,
} from "./day-edit.ts";

const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
const day = days[1]!;
const stops: DayEditStop[] = [
  { id: "id-a", title: "Louvre", day_date: day, time_label: "09:00", position: 1, kind: "sight" },
  { id: "id-b", title: "Lunch", day_date: day, time_label: "12:30", position: 2, kind: "meal" },
  { id: "id-c", title: "Orsay", day_date: day, time_label: "14:00", position: 3 },
  { id: "id-d", title: "Dinner", day_date: day, time_label: "19:30", position: 4, kind: "meal" },
];
const all = new Set(stops.map((s) => s.id));

test("the prompt marks which stops may change, and never shows row ids", () => {
  const text = dayEditPrompt("slower morning", stops, new Set(["id-a"]), days, day);
  assert.match(text, /d2, 2026-10-02/);
  assert.match(text, /s1 09:00 Louvre \[sight\] \(may change\)/);
  assert.match(text, /s4 19:30 Dinner \[meal\] \(keep as is\)/);
  assert.match(text, /d2 2026-10-02 \(this day\)/);
  assert.doesNotMatch(text, /id-a/);
  assert.doesNotMatch(text, /forecast/i);
});

test("with a forecast, Béa is told the hours and to plan around rain", () => {
  const text = dayEditPrompt("make it better", stops, all, days, day, {
    area: "Paris, France",
    rain: "09:00 10%, 14:00 80%",
  });
  assert.match(text, /, in Paris, France\./);
  assert.match(text, /chance of rain by hour \(from Open-Meteo\):\n {2}09:00 10%, 14:00 80%/);
  assert.match(text, /indoor places/);
});

test("refs become the new order, times and days", () => {
  const plan = readDayEdit(
    [
      { stop: "s3", day: "same", time: "10:00" },
      { stop: "s2", day: "same", time: "keep" },
      { stop: "s1", day: "d3", time: "clear" },
      { stop: "s4", day: "same", time: "keep" },
    ],
    stops,
    all,
    days,
    day,
    "Orsay first.",
  );
  assert.deepEqual(plan.order, [
    { id: "id-c", time_label: "10:00" },
    { id: "id-b", time_label: "12:30" },
    { id: "id-d", time_label: "19:30" },
  ]);
  assert.deepEqual(plan.away, [{ id: "id-a", day_date: days[2], time_label: null }]);
  assert.equal(plan.reply, "Orsay first.");
});

test("an unticked stop keeps its day and time, whatever the model says", () => {
  const plan = readDayEdit(
    [
      { stop: "s4", day: "none", time: "08:00" },
      { stop: "s1", day: "same", time: "10:00" },
    ],
    stops,
    new Set(["id-a"]),
    days,
    day,
  );
  assert.deepEqual(plan.away, []);
  assert.deepEqual(plan.order[0], { id: "id-d", time_label: "19:30" });
  assert.deepEqual(plan.order[1], { id: "id-a", time_label: "10:00" });
});

test("a stop the model forgot stays after the stop it followed", () => {
  const plan = readDayEdit(
    [
      { stop: "s1", day: "same", time: "keep" },
      { stop: "s3", day: "same", time: "keep" },
      { stop: "s9", day: "same", time: "keep" },
    ],
    stops,
    all,
    days,
    day,
  );
  assert.deepEqual(
    plan.order.map((r) => r.id),
    ["id-a", "id-b", "id-c", "id-d"],
  );
  assert.equal(dayEditChanges(plan, stops), false);
});

test("a stop set aside leaves the day, and nothing else is marked moved", () => {
  const plan = readDayEdit(
    [
      { stop: "s1", day: "same", time: "keep" },
      { stop: "s2", day: "none", time: "keep" },
      { stop: "s3", day: "same", time: "keep" },
      { stop: "s4", day: "same", time: "keep" },
    ],
    stops,
    all,
    days,
    day,
  );
  assert.deepEqual(plan.away, [{ id: "id-b", day_date: null, time_label: "12:30" }]);
  const rows = dayEditRows(plan, stops);
  assert.equal(
    rows.some((r) => r.moved || r.retimed),
    false,
  );
  assert.equal(dayEditChanges(plan, stops), true);
});

test("the schedule saves exactly Béa's version of the day", () => {
  const plan = readDayEdit(
    [
      { stop: "s3", day: "same", time: "10:00" },
      { stop: "s1", day: "same", time: "keep" },
      { stop: "s2", day: "d1", time: "keep" },
      { stop: "s4", day: "same", time: "keep" },
    ],
    stops,
    all,
    days,
    day,
  );
  const other = { id: "id-x", title: "Arrive", day_date: days[0]!, time_label: null, position: 7 };
  const { updates, added } = dayEditSchedule(plan, [...stops, other], day);
  assert.deepEqual(added, []);
  const after = [...stops, other].map((s) => ({ ...s, ...updates.find((u) => u.id === s.id) }));
  const onDay = after.filter((s) => s.day_date === day).sort((a, b) => a.position - b.position);
  assert.deepEqual(
    onDay.map((s) => `${s.title} ${s.time_label}`),
    ["Orsay 10:00", "Louvre 09:00", "Dinner 19:30"],
  );
  const lunch = after.find((s) => s.id === "id-b")!;
  assert.equal(lunch.day_date, days[0]);
  const arrive = after.find((s) => s.id === "id-x")!;
  assert.ok(lunch.position > arrive.position, "goes to the end of its new day");
  const rows = dayEditRows(plan, stops);
  assert.deepEqual(
    rows.map((r) => [r.title, r.moved, r.retimed]),
    [
      ["Orsay", true, true],
      ["Louvre", true, false],
      ["Dinner", false, false],
    ],
  );
});

test("rain: an outdoor stop is set aside and an indoor place takes its slot", () => {
  const plan = readDayEdit(
    [
      { stop: "s1", day: "same", time: "keep" },
      { stop: "s2", day: "same", time: "keep" },
      { stop: "s3", day: "none", time: "keep", why: "Outdoors, and rain is due" },
      {
        stop: "new",
        day: "same",
        time: "14:00",
        title: "Musée de l'Orangerie",
        kind: "museum",
        address: "Jardin des Tuileries",
        why: "Indoors, ten minutes away",
      },
      { stop: "s4", day: "same", time: "keep" },
    ],
    stops,
    all,
    days,
    day,
  );
  assert.deepEqual(plan.away, [
    { id: "id-c", day_date: null, time_label: "14:00", why: "Outdoors, and rain is due" },
  ]);
  const fresh = plan.order[2]!;
  assert.equal(fresh.id, "new:1");
  assert.deepEqual(fresh.fresh, {
    title: "Musée de l'Orangerie",
    kind: "sight",
    address: "Jardin des Tuileries",
  });
  const rows = dayEditRows(plan, stops);
  assert.deepEqual(
    rows.map((r) => [r.title, r.moved, Boolean(r.fresh)]),
    [
      ["Louvre", false, false],
      ["Lunch", false, false],
      ["Musée de l'Orangerie", false, true],
      ["Dinner", false, false],
    ],
  );
  const { updates, added } = dayEditSchedule(plan, stops, day);
  assert.deepEqual(added, [
    {
      title: "Musée de l'Orangerie",
      kind: "sight",
      address: "Jardin des Tuileries",
      key: "new:1",
      time_label: "14:00",
      why: "Indoors, ten minutes away",
      position: 3,
    },
  ]);
  const byId = new Map(updates.map((u) => [u.id, u]));
  assert.equal(byId.get("id-c")?.day_date, null);
  assert.equal(byId.has("id-d"), false, "Dinner keeps its place after the new stop");
  assert.equal(byId.has("id-a"), false, "unchanged rows are not written");
});

test("new places need a name, never a booking kind, and are capped", () => {
  const lines = Array.from({ length: 8 }, (_, i) => ({
    stop: "new",
    day: "same",
    time: "15:00",
    title: i === 0 ? "" : `Place ${i}`,
    kind: i === 1 ? "hotel" : "meal",
  }));
  const plan = readDayEdit(lines, stops, all, days, day);
  const fresh = plan.order.filter((r) => r.fresh);
  assert.equal(fresh.length, 5);
  assert.equal(fresh[0]!.fresh!.kind, "activity");
  assert.equal(fresh[0]!.fresh!.title, "Place 1");
});

test("asks join as a first request and its refinements", () => {
  assert.equal(joinAsks(["Slower morning", " ", "Lunch at 1"]), "Slower morning\nThen: Lunch at 1");
});
