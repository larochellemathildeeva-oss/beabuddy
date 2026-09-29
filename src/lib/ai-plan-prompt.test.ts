import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AI_PLAN_EXAMPLE, AI_PLAN_PROMPT } from "./ai-plan-prompt.ts";
import { readPlainPlan } from "./plan-lines.ts";

describe("AI plan prompt", () => {
  it("carries its example", () => {
    assert.ok(AI_PLAN_PROMPT.endsWith(AI_PLAN_EXAMPLE));
  });

  it("has an example the line reader takes without a model", () => {
    const plan = readPlainPlan(AI_PLAN_EXAMPLE, { startDate: null, tripCity: "Paris, France" });
    assert.ok(plan, "the example should read as a tidy list");
    assert.deepEqual(
      plan.items.map((i) => [i.time_label, i.kind, i.place, i.address, i.city]),
      [
        ["09:00", "meal", "Café de Flore", "172 Boulevard Saint-Germain", "Paris, France"],
        ["10:00", "sight", "Musée d'Orsay", "1 Rue de la Légion d'Honneur", "Paris, France"],
        ["12:30", "meal", "Bouillon Chartier", "7 Rue du Faubourg Montmartre", "Paris, France"],
        [
          "15:00",
          "lodging",
          "Hôtel des Grands Boulevards",
          "17 Boulevard Poissonnière",
          "Paris, France",
        ],
        ["08:30", "walk", "Jardin du Luxembourg", null, "Paris, France"],
        ["11:00", "transport", "Paris Gare de Lyon", null, "Paris, France"],
        ["13:30", "lodging", "Hôtel Carlton Lyon", "4 Rue Jussieu", "Lyon, France"],
        ["19:30", "meal", "Daniel et Denise Saint-Jean", "36 Rue Tramassac", "Lyon, France"],
      ],
    );
    assert.equal(plan.items[1]!.end_time, "12:00");
    assert.equal(plan.items[0]!.day_date, "2026-10-12");
    assert.equal(plan.items[5]!.day_date, "2026-10-13");
    // Food tips stay with the meal.
    assert.equal(plan.items[2]!.detail, "cheap classic bistro; order the steak frites");
    // A getting-there tip must not turn a walk into a journey.
    assert.equal(plan.items[4]!.detail, "getting there: metro line 4, 15 min");
    assert.ok(plan.items.every((i) => i.booked === false));
  });

  it("keeps flights and airports as stops of their own", () => {
    const plan = readPlainPlan(
      `Day 1 — 2026-10-11 — Montréal, Canada → Paris, France
18:30 Flight AC 870 from Montréal-Trudeau Airport to Paris-Charles de Gaulle Airport — book ahead
Day 2 — 2026-10-12 — Paris, France
07:30 Arrive at Paris-Charles de Gaulle Airport
10:00 Check in at Hôtel des Grands Boulevards, 17 Boulevard Poissonnière
12:30 Lunch at Bouillon Chartier, 7 Rue du Faubourg Montmartre`,
      { startDate: null, tripCity: null },
    );
    assert.ok(plan);
    assert.deepEqual(
      plan.items.map((i) => [i.kind, i.place, i.city]),
      [
        ["flight", "Montréal-Trudeau Airport", "Montréal, Canada"],
        ["flight", "Paris-Charles de Gaulle Airport", "Paris, France"],
        ["lodging", "Hôtel des Grands Boulevards", "Paris, France"],
        ["meal", "Bouillon Chartier", "Paris, France"],
      ],
    );
  });
});
