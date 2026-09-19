import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pastedPlanNote, readPlanShape } from "./pasted-plan.ts";

// The itinerary that started all of this, trimmed.
const MONTREAL = `Here's a 2-day Montréal itinerary.

Day 1 — Old Montréal + Plateau
9:00 AM Breakfast at Olive et Gourmando
10:30 AM Notre-Dame Basilica and Place d'Armes
12:30 PM Lunch near Marché Bonsecours
2:00 PM Mount Royal, Kondiaronk Belvedere
6:30 PM Dinner in Little Italy

Day 2 — Markets
9:00 AM Coffee in Griffintown
12:00 PM Atwater Market
1:30 PM Marché Jean-Talon`;

const HIROSHIMA = `Day 1
08:36 Arrive Hiroshima Station
09:30 Peace Memorial Museum
11:00 Peace Memorial Park
13:00 Lunch at Kakiya
16:30 Miyajima Ferry`;

// What someone types when they want a trip made for them.
const REQUEST = `I want a relaxed few days somewhere warm. I like good food, markets and
walking, not museums. Travelling with my partner, we don't want to be rushed,
and we'd rather eat well than shop. Somewhere we can get to without a long flight.`;

test("a pasted itinerary is recognised as one", () => {
  assert.equal(readPlanShape(MONTREAL).existing, true);
  assert.equal(readPlanShape(HIROSHIMA).existing, true);
});

test("a description of the trip you want is not mistaken for one", () => {
  // The costly direction: guessing "import" here would refuse to plan at all.
  assert.equal(readPlanShape(REQUEST).existing, false);
});

test("a passing mention of a time is not an itinerary", () => {
  const casual = `We land quite late, around 9pm, and I'd like something easy for the
    first evening — nothing that needs booking, just a good place to eat near wherever
    we end up staying. After that we're open to anything.`;
  assert.equal(readPlanShape(casual).existing, false);
});

test("short text is never an itinerary, whatever it contains", () => {
  assert.equal(readPlanShape("Day 1 09:00 museum").existing, false);
  assert.equal(readPlanShape("").existing, false);
});

test("days alone are enough, when there are several", () => {
  const noTimes = `Day 1 — arrive, walk the old town, dinner somewhere local.
    Day 2 — the market in the morning, then the cathedral and a long lunch.
    Day 3 — day trip out to the coast, back for the evening.`;
  assert.equal(readPlanShape(noTimes).existing, true);
});

test("the note says what Béa actually noticed", () => {
  const note = pastedPlanNote(readPlanShape(MONTREAL));
  assert.ok(note?.includes("already have"));
  assert.equal(pastedPlanNote(readPlanShape(REQUEST)), null);
});
