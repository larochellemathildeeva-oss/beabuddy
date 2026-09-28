import { strict as assert } from "node:assert";
import { test } from "node:test";
import { planCities } from "./plan-cities.ts";

const row = (city: string | null, day_date: string, kind = "sight") => ({ city, day_date, kind });

test("a plan through several towns adds each with its days", () => {
  const rows = [
    row("Montréal, Canada", "2026-10-11", "flight"),
    row("Paris, France", "2026-10-12"),
    row("Paris, France", "2026-10-13"),
    row("Lyon, France", "2026-10-13", "lodging"),
    row("Lyon, France", "2026-10-14"),
  ];
  assert.deepEqual(planCities(rows, []), [
    { city: "Paris", country: "France", arrive_on: "2026-10-12", depart_on: "2026-10-13" },
    { city: "Lyon", country: "France", arrive_on: "2026-10-13", depart_on: "2026-10-14" },
  ]);
});

test("towns the trip has already are left alone, however they are spelled", () => {
  const rows = [row("Montreal", "2026-10-11"), row("Québec City", "2026-10-13")];
  assert.deepEqual(planCities(rows, [{ city: "Montréal" }]), [
    { city: "Québec City", arrive_on: "2026-10-13", depart_on: "2026-10-13" },
  ]);
});

test("a plan in one town adds nothing", () => {
  assert.deepEqual(planCities([row("Paris", "2026-10-12"), row(null, "2026-10-12")], []), []);
});
