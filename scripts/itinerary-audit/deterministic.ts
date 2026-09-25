/**
 * The parts of import that do not need the model, run on the fixtures:
 * would Béa notice this is a plan (readPlanShape), and would the times the
 * model is likely to hand back verbatim survive cleanup (normalizeClock)?
 *
 *   node scripts/itinerary-audit/deterministic.ts
 */
import { readPlanShape } from "../../src/lib/pasted-plan.ts";
import { isTravelLeg, normalizeClock } from "../../src/lib/import-stop.ts";
import { FIXTURES } from "./fixtures.ts";

console.log("== Plan detection (build mode offers 'Read my plan instead' when existing) ==");
for (const f of FIXTURES) {
  const s = readPlanShape(f.text);
  console.log(`${s.existing ? "ok  " : "MISS"} ${f.id.padEnd(20)} times=${s.times} days=${s.days}`);
}

console.log("\n== Time wordings as a model may echo them ==");
const wordings = [
  "9am",
  "11:30am",
  "6:30pm",
  "9h30",
  "13h30",
  "12h",
  "16h",
  "20h30",
  "19h",
  "~7:00",
  "9ish",
  "noon-ish",
  "noon",
  "at 3",
  "3pm",
  "5am",
  "8pm",
  "12:31",
  "7.30pm",
  "half past seven",
  "08:45",
];
for (const w of wordings) {
  const out = normalizeClock(w);
  console.log(`${out ? "ok  " : "LOST"} ${w.padEnd(16)} -> ${out}`);
}

console.log("\n== Travel-leg folding on titles a model may produce ==");
const titles: [string, string, boolean][] = [
  ["transport", "Take the Hibiya line to Ginza", false],
  ["transport", "JR Sanyo line Hiroshima → Miyajimaguchi", false],
  ["transport", "Ferry to Miyajima", false],
  ["transport", "Walk along the Seine to Île de la Cité", false],
  ["walk", "Walk along the Seine to Île de la Cité", false],
  ["transport", "Hop on Tram 28 up to Alfama", false],
  ["transport", "Eurostar 9O 9031 London St Pancras → Paris Gare du Nord", true],
  ["transport", "Back in Hiroshima", false],
  ["activity", "Walk to Harajuku, Takeshita Street", false],
];
for (const [kind, title, booked] of titles) {
  console.log(`${isTravelLeg({ kind, title, booked }) ? "fold" : "keep"} [${kind}] ${title}`);
}
