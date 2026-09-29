import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planAsText } from "./plan-text.ts";

test("planAsText groups stops under their day, with times and details", () => {
  assert.equal(
    planAsText([
      { day_number: 1, time_label: "09:00", title: "Louvre", detail: "book ahead" },
      { day_number: 1, time_label: null, title: "Lunch" },
      { day_number: 2, title: "Versailles" },
    ]),
    "Day 1\n09:00 Louvre — book ahead\nLunch\n\nDay 2\nVersailles",
  );
});

test("planAsText prefers a real date and leaves undated stops bare", () => {
  assert.equal(
    planAsText([
      { day_date: "2026-04-12", day_number: 1, title: "Arrive" },
      { title: "Somewhere, sometime" },
    ]),
    "2026-04-12\nArrive\nSomewhere, sometime",
  );
});
