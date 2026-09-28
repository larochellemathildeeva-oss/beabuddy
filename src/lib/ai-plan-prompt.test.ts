import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { AI_PLAN_EXAMPLE, AI_PLAN_PROMPT } from "./ai-plan-prompt.ts";
import { readPlainPlan } from "./plan-lines.ts";

describe("AI plan prompt", () => {
  it("carries its example", () => {
    assert.ok(AI_PLAN_PROMPT.endsWith(AI_PLAN_EXAMPLE));
  });

  it("has an example the line reader takes without a model", () => {
    const plan = readPlainPlan(AI_PLAN_EXAMPLE, { startDate: null, tripCity: "Montréal, Canada" });
    assert.ok(plan, "the example should read as a tidy list");
    assert.deepEqual(
      plan.items.map((i) => [i.time_label, i.place, i.address]),
      [
        ["09:00", "Café Olimpico", "124 Rue Saint-Viateur O"],
        ["10:00", "Parc Jeanne-Mance", "4422 Avenue de l'Esplanade"],
        ["11:45", "Mile End", null],
        ["13:00", "Schwartz's Deli", "3895 Boulevard Saint-Laurent"],
      ],
    );
    assert.equal(plan.items[1]!.end_time, "11:30");
    // A place with no street number carries only its name.
    assert.equal(plan.items[2]!.title, "Walk in Mile End");
    assert.equal(plan.items[0]!.day_date, "2026-10-12");
    // A getting-there tip must not turn a meal into a journey.
    assert.equal(plan.items[3]!.kind, "meal");
    assert.ok(plan.items.every((i) => i.booked === false));
  });
});
