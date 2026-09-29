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

test("planAsText keeps where each stop is, once", () => {
  assert.equal(
    planAsText([
      {
        title: "Dinner",
        address: "Le Train Bleu, Place Louis-Armand, Paris",
        place: "Le Train Bleu",
      },
      { title: "Louvre", place: "Louvre" },
      { title: "Lunch", detail: "book ahead", place: "Café Marly" },
    ]),
    "Dinner — at Le Train Bleu, Place Louis-Armand, Paris\nLouvre\nLunch — book ahead · at Café Marly",
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

test("planAsText keeps a place and an address that does not name it", () => {
  assert.equal(
    planAsText([{ title: "Dinner", place: "Le Train Bleu", address: "Place Louis-Armand, Paris" }]),
    "Dinner — at Le Train Bleu, Place Louis-Armand, Paris",
  );
});

test("planAsText matches the place as whole words", () => {
  assert.equal(planAsText([{ title: "Dinner", place: "Inn" }]), "Dinner — at Inn");
  assert.equal(planAsText([{ title: "Dinner at the Inn", place: "Inn" }]), "Dinner at the Inn");
});
