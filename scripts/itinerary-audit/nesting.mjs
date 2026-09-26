/**
 * Does Béa recognise places inside places? Runs plans that nest — a museum
 * and its galleries, a park and its monuments, a temple and its halls — and
 * a plan that does not, through the real import (prompt, model ladder,
 * clean-up) and then the same save step the app uses (splitInsideNote,
 * parentIndex), and checks what would be saved.
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=… node scripts/itinerary-audit/nesting.mjs
 *   … --runs 3        answers per plan (default 2)
 *   … --only louvre   one plan
 *   … --delay 4000    ms between model calls (default 3000)
 *
 * Exits 1 when any check fails in any run.
 */
import { createJiti } from "jiti";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const args = process.argv.slice(2);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const runs = Number(value("--runs", "2")) || 2;
const only = value("--only", null);
const delayMs = Number(value("--delay", "3000"));

if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("Set GOOGLE_GENERATIVE_AI_API_KEY first.");
  process.exit(1);
}

const { runParse } = await jiti.import(join(root, "src/lib/itinerary.functions.ts"));
const { withModelFallback } = await jiti.import(join(root, "src/lib/ai.server.ts"));
const { parentIndex } = await jiti.import(join(root, "src/lib/import-stop.ts"));
const { splitInsideNote } = await jiti.import(join(root, "src/lib/inside-list.ts"));

const has = (text, word) => text.toLowerCase().includes(word.toLowerCase());

/**
 * Each plan says what must be saved:
 *   inside:  a stop whose title has `stop`, with a list holding each of `holds`
 *   within:  a stop whose title has `stop`, saved inside one whose title has `parent`
 *   alone:   a stop whose title has this word, saved as a stop of its own, not nested
 *   gone:    no saved stop's title has this word (it went into a list)
 *   noNesting: nothing is nested at all
 */
const PLANS = [
  {
    id: "hiroshima",
    tripCity: "Hiroshima, Japan",
    startDate: "2026-10-07",
    text: `Day 1 — Hiroshima
09:30 Hiroshima Peace Memorial Museum (BOOKED)
  - East building: Hiroshima before the bomb
  - Main building: personal belongings of the victims
10:30 Peace Memorial Park
  10:45 Cenotaph for the A-bomb Victims
  11:00 Children's Peace Monument
  - Flame of Peace
  - Peace Bell
12:00 Visit the Atomic Bomb Dome / stroll along the Motoyasu River
13:00 Lunch at Okonomimura`,
    expect: {
      inside: [
        { stop: "Museum", holds: ["East building", "Main building"] },
        { stop: "Peace Memorial Park", holds: ["Flame of Peace", "Peace Bell"] },
      ],
      within: [
        { stop: "Cenotaph", parent: "Peace Memorial Park" },
        { stop: "Children", parent: "Peace Memorial Park" },
      ],
      alone: ["Atomic Bomb Dome", "Motoyasu", "Okonomimura"],
      gone: ["East building", "Flame of Peace", "Peace Bell"],
    },
  },
  {
    id: "louvre",
    tripCity: "Paris, France",
    startDate: "2026-05-02",
    text: `Saturday in Paris. We start at the Louvre at 9:00 — inside, head straight for the Mona Lisa, then the Winged Victory of Samothrace and the Egyptian antiquities. At 13:00 lunch at Café Marly, then 15:00 a walk through the Tuileries Garden to Place de la Concorde. Dinner at 19:30 at Bouillon Chartier.`,
    expect: {
      inside: [{ stop: "Louvre", holds: ["Mona Lisa", "Winged Victory", "Egyptian"] }],
      within: [],
      alone: ["Café Marly", "Tuileries", "Chartier"],
      gone: ["Mona Lisa", "Winged Victory"],
    },
  },
  {
    id: "kyoto-temple",
    tripCity: "Kyoto, Japan",
    startDate: "2026-10-03",
    text: `Day 1
08:00 Kiyomizu-dera
  * Main hall and the wooden stage
  * Otowa waterfall
  * Jishu shrine
10:30 Sannenzaka and Ninenzaka
12:00 Lunch at Okutan Kiyomizu
14:00 Fushimi Inari Taisha`,
    expect: {
      inside: [{ stop: "Kiyomizu", holds: ["Otowa", "Jishu"] }],
      within: [],
      alone: ["Sannenzaka", "Okutan", "Fushimi Inari"],
      gone: ["Otowa waterfall", "Jishu"],
    },
  },
  {
    id: "rome-flat",
    tripCity: "Rome, Italy",
    startDate: "2026-06-10",
    text: `Rome day
09:00 Colosseum (tickets booked)
11:30 Roman Forum and Palatine Hill
13:30 Lunch at Armando al Pantheon
15:00 Pantheon
17:00 Trevi Fountain
20:00 Dinner in Trastevere`,
    expect: {
      inside: [],
      within: [],
      alone: ["Colosseum", "Forum", "Armando", "Pantheon", "Trevi", "Trastevere"],
      gone: [],
      noNesting: true,
    },
  },
  {
    id: "one-visit-list",
    tripCity: "Hiroshima, Japan",
    startDate: "2026-10-07",
    text: `Day 1
10:00 Peace Park / Atomic Bomb Dome / Cenotaph
12:30 Lunch at Okonomimura
14:00 Shukkei-en Garden`,
    expect: {
      inside: [],
      within: [],
      alone: ["Peace Park", "Okonomimura", "Shukkei-en"],
      gone: [],
    },
  },
];

/** The rows the app would save: the import's rows through ItineraryImport's save step. */
function saved(items) {
  return items.map((it, i) => {
    const { detail, inside } = splitInsideNote(it.detail);
    const parent = parentIndex(items, i);
    return { title: it.title, time: it.time_label, detail, inside, parent };
  });
}

function check(plan, rows) {
  const fails = [];
  const find = (word) => rows.findIndex((r) => has(r.title, word));
  for (const { stop, holds } of plan.expect.inside) {
    const i = find(stop);
    if (i < 0) {
      fails.push(`no stop "${stop}"`);
      continue;
    }
    const list = rows[i].inside.map((e) => e.title).join(" | ");
    for (const want of holds) {
      if (!has(list, want))
        fails.push(`"${rows[i].title}" list lacks "${want}" (has: ${list || "nothing"})`);
    }
  }
  for (const { stop, parent } of plan.expect.within) {
    const i = find(stop);
    if (i < 0) {
      fails.push(`no stop "${stop}"`);
      continue;
    }
    const p = rows[i].parent;
    if (p < 0 || !has(rows[p].title, parent)) {
      fails.push(
        `"${rows[i].title}" not inside "${parent}" (parent: ${p < 0 ? "none" : rows[p].title})`,
      );
    }
  }
  for (const word of plan.expect.alone) {
    const i = find(word);
    if (i < 0) fails.push(`no stop "${word}"`);
    else if (rows[i].parent >= 0)
      fails.push(`"${rows[i].title}" nested under "${rows[rows[i].parent].title}"`);
  }
  for (const word of plan.expect.gone) {
    const i = find(word);
    if (i >= 0) fails.push(`"${rows[i].title}" saved as its own stop`);
  }
  if (plan.expect.noNesting) {
    for (const r of rows) {
      if (r.inside.length)
        fails.push(`"${r.title}" got a list: ${r.inside.map((e) => e.title).join(", ")}`);
      if (r.parent >= 0) fails.push(`"${r.title}" nested under "${rows[r.parent].title}"`);
    }
  }
  return fails;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
let calls = 0;
for (const plan of PLANS.filter((p) => !only || p.id === only)) {
  for (let run = 1; run <= runs; run++) {
    if (calls++ > 0) await sleep(delayMs);
    const data = {
      imageDataUrls: null,
      pdfDataUrl: null,
      pageUrl: null,
      text: plan.text,
      tripCity: plan.tripCity,
      route: null,
      startDate: plan.startDate,
      endDate: null,
      mode: "import",
      pace: null,
      budgetLevel: null,
      currency: null,
      includeCosts: false,
    };
    let model = null;
    let out;
    try {
      out = await withModelFallback((m) => runParse(m, data, ""), {
        onModel: (id) => (model = id),
      });
    } catch (error) {
      failed++;
      console.log(`✗ ${plan.id} run ${run}: the model call failed — ${error?.message ?? error}`);
      continue;
    }
    const rows = saved(out.items);
    const fails = check(plan, rows);
    if (fails.length) failed++;
    console.log(`${fails.length ? "✗" : "✓"} ${plan.id} run ${run} (${model ?? "model"})`);
    for (const r of rows) {
      const nest = [
        r.parent >= 0 ? `in ${rows[r.parent].title}` : "",
        r.inside.length ? `inside: ${r.inside.map((e) => e.title).join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" · ");
      console.log(`    ${r.time ?? "     "}  ${r.title}${nest ? `   [${nest}]` : ""}`);
    }
    for (const f of fails) console.log(`    ! ${f}`);
  }
}
console.log(failed ? `\n${failed} run(s) failed.` : "\nEvery run passed.");
process.exit(failed ? 1 : 0);
