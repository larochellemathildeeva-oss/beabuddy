import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planEditPrompt, readPlanEdit, type PlanEditStop } from "./plan-edit.ts";

const days = ["2026-10-01", "2026-10-02"];
const stops: PlanEditStop[] = [
  { id: "id-a", title: "Louvre", day_date: days[0]!, time_label: "09:00", kind: "sight" },
  { id: "id-b", title: "Café Kitsuné", day_date: days[0]!, time_label: null },
  { id: "id-c", title: "Orsay", day_date: days[1]!, time_label: "14:00" },
];

test("the prompt lists stops by ref under their days, and never the row ids", () => {
  const text = planEditPrompt("Louvre on day 2", stops, days);
  assert.match(
    text,
    /d1 \(day 1, 2026-10-01\):\n {2}s1 09:00 Louvre \[sight\]\n {2}s2 Café Kitsuné/,
  );
  assert.match(text, /d2 \(day 2, 2026-10-02\):\n {2}s3 14:00 Orsay/);
  assert.doesNotMatch(text, /id-a/);
});

test("refs become ids, days and anchors", () => {
  const moves = readPlanEdit(
    [
      { stop: "s1", day: "d2", after: "s3", time: "16:00" },
      { stop: "s2", day: "same", after: "start", time: "keep" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, [
    { id: "id-a", day_date: days[1], at: { after: "id-c" }, time_label: "16:00" },
    { id: "id-b", day_date: days[0], at: "start" },
  ]);
});

test("unknown stops, days, anchors and times are dropped", () => {
  const moves = readPlanEdit(
    [
      { stop: "s9", day: "d1", after: "end", time: "keep" },
      { stop: "s1", day: "d7", after: "end", time: "keep" },
      { stop: "s1", day: "d1", after: "s1", time: "keep" },
      { stop: "s3", day: "d1", after: "end", time: "teatime" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, []);
});

test("clear removes a time, and a stop named twice keeps its last move", () => {
  const moves = readPlanEdit(
    [
      { stop: "s3", day: "d1", after: "end", time: "keep" },
      { stop: "s3", day: "d1", after: "start", time: "clear" },
    ],
    stops,
    days,
  );
  assert.deepEqual(moves, [{ id: "id-c", day_date: days[0], at: "start", time_label: null }]);
});
