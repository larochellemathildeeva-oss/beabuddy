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
        // An area, then each spot in it on its own line: all of them stops.
        ["16:00", "walk", "Marais", null, "Paris, France"],
        ["16:10", "activity", "Place des Vosges", null, "Paris, France"],
        ["17:00", "sight", "Marché des Enfants Rouges", "39 Rue de Bretagne", "Paris, France"],
        ["18:15", "meal", "L'As du Fallafel", "34 Rue des Rosiers", "Paris, France"],
        ["08:30", "walk", "Jardin du Luxembourg", null, "Paris, France"],
        ["11:00", "transport", "Paris Gare de Lyon", null, "Paris, France"],
        ["13:30", "lodging", "Hôtel Carlton Lyon", "4 Rue Jussieu", "Lyon, France"],
        ["19:30", "meal", "Daniel et Denise Saint-Jean", "36 Rue Tramassac", "Lyon, France"],
      ],
    );
    assert.equal(plan.items[1]!.end_time, "12:00");
    // The spots of Le Marais are inside it; its span holds them, so it keeps no stay of its own.
    assert.deepEqual(
      plan.items.slice(4, 8).map((i) => i.within ?? null),
      [null, "Walk in Le Marais", "Walk in Le Marais", "Walk in Le Marais"],
    );
    assert.equal(plan.items[4]!.end_time, null);
    assert.equal(plan.items[0]!.day_date, "2026-10-12");
    assert.equal(plan.items[9]!.day_date, "2026-10-13");
    // Food tips stay with the meal.
    assert.equal(plan.items[2]!.detail, "cheap classic bistro; order the steak frites");
    // A getting-there tip must not turn a walk into a journey.
    assert.equal(plan.items[8]!.detail, "getting there: metro line 4, 15 min");
    assert.ok(plan.items.every((i) => i.booked === false));
  });

  it("reads a name given in both scripts, with its note", () => {
    const plan = readPlainPlan(
      `Day 1 — 2026-10-05 — Osaka, Japan
09:00 Kuromon Market (黒門市場), 2-4-1 Nipponbashi — try the grilled scallops
12:00 Lunch at Sushidokoro Amano (鮨処 あま野), 1-5-3 Dotonbori — order the omakase
15:45 Excelsior Caffé Shinsaibashi (エクセルシオール カフェ 心斎橋), 2-3-23 Shinsaibashisuji — Cremia ice cream`,
      { startDate: null, tripCity: null },
    );
    assert.ok(plan);
    assert.deepEqual(
      plan.items.map((i) => [i.place, i.address, i.detail]),
      [
        ["Kuromon Market (黒門市場)", "2-4-1 Nipponbashi", "try the grilled scallops"],
        ["Sushidokoro Amano (鮨処 あま野)", "1-5-3 Dotonbori", "order the omakase"],
        [
          "Excelsior Caffé Shinsaibashi (エクセルシオール カフェ 心斎橋)",
          "2-3-23 Shinsaibashisuji",
          "Cremia ice cream",
        ],
      ],
    );
  });

  it("reads a flight written on one line, landing time and all, as one flight", () => {
    const plan = readPlainPlan(
      `Day 1 — 2026-10-11 — Montréal, Canada → Paris, France
09:00 Breakfast at Olive et Gourmando, 351 Rue Saint-Paul Ouest
18:30 Flight AC 870 from Montréal-Trudeau Airport to Paris-Charles de Gaulle Airport — lands next day 07:30; book ahead
Day 2 — 2026-10-12 — Paris, France
10:00 Check in at Hôtel des Grands Boulevards, 17 Boulevard Poissonnière`,
      { startDate: null, tripCity: null },
    );
    assert.ok(plan);
    assert.deepEqual(
      plan.items.map((i) => [i.kind, i.time_label, i.place, i.detail]),
      [
        ["meal", "09:00", "Olive et Gourmando", null],
        ["flight", "18:30", "Montréal-Trudeau Airport", "lands next day 07:30; book ahead"],
        ["lodging", "10:00", "Hôtel des Grands Boulevards", null],
      ],
    );
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
