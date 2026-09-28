import { strict as assert } from "node:assert";
import { test } from "node:test";
import { nowTarget } from "./now-jump.ts";

const at = (h: number, m = 0) => h * 60 + m;
const day = [
  { id: "a", title: "Breakfast", time_label: "08:00" },
  { id: "b", title: "Louvre", time_label: "10:00" },
  { id: "c", title: "Lunch", time_label: "13:00" },
];

test("the stop you are at wins", () => {
  const here = day.map((s) => (s.id === "a" ? { ...s, arrived_at: "t" } : s));
  assert.equal(nowTarget(here, at(11))?.id, "a");
});

test("otherwise the next one by the clock", () => {
  assert.equal(nowTarget(day, at(9))?.id, "b");
});

test("a next stop already done gives way to the first one still open", () => {
  const done = day.map((s) => (s.id === "b" ? { ...s, arrived_at: "t", left_at: "t" } : s));
  assert.equal(nowTarget(done, at(9))?.id, "a");
});

test("a finished day has nowhere to go", () => {
  const all = day.map((s) => ({ ...s, arrived_at: "t", left_at: "t" }));
  assert.equal(nowTarget(all, at(9)), null);
});
