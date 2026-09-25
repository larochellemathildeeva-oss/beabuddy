/**
 * Put the ten fixtures through Béa's real import — the same prompt, model
 * ladder and clean-up the app uses — and score each answer.
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=… node scripts/itinerary-audit/audit.mjs [--runs 2] [--only tokyo]
 *   node scripts/itinerary-audit/audit.mjs --mock --only paris   # checks the harness, no key
 *
 * Writes scripts/itinerary-audit/out/<timestamp>.json (every raw answer) and
 * prints a table plus every finding. Costs one Gemini call per fixture per run.
 */
import { createJiti } from "jiti";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const args = process.argv.slice(2);
const runs = Number(args[args.indexOf("--runs") + 1]) || 1;
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

const mock = args.includes("--mock");
if (!mock && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("Set GOOGLE_GENERATIVE_AI_API_KEY first.");
  process.exit(1);
}

const { FIXTURES } = await jiti.import(join(here, "fixtures.ts"));
const { runParse } = await jiti.import(join(root, "src/lib/itinerary.functions.ts"));
const { withModelFallback } = mock
  ? { withModelFallback: await mockModel() }
  : await jiti.import(join(root, "src/lib/ai.server.ts"));

/** A model that answers the Paris fixture perfectly, to check the harness itself. */
async function mockModel() {
  const { MockLanguageModelV3 } = await import("ai/test");
  const row = (time_label, title, place, extra = {}) => ({
    day_date: "2026-10-10",
    day_number: 1,
    time_label,
    end_time: null,
    duration_minutes: null,
    kind: "activity",
    title,
    detail: null,
    place,
    address: null,
    city: "Paris",
    estimated_cost: null,
    currency: null,
    source: null,
    booked: false,
    ...extra,
  });
  const answer = {
    summary: "A Paris Saturday.",
    trip_title: "Paris",
    start_date: "2026-10-10",
    end_date: "2026-10-10",
    estimated_total: null,
    currency: null,
    costs: [],
    items: [
      row("08:30", "Breakfast at Café de Flore", "Café de Flore", { kind: "meal" }),
      row("10:00", "Musée d'Orsay", "Musée d'Orsay", {
        kind: "sight",
        booked: true,
        detail: "conf #ORS-55821",
      }),
      row("13:00", "Lunch at Bouillon Chartier", "Bouillon Chartier", {
        kind: "meal",
        address: "7 Rue du Faubourg Montmartre",
      }),
      row("15:00", "Walk along the Seine", "Île de la Cité", { kind: "walk" }),
      row("16:00", "Sainte-Chapelle", "Sainte-Chapelle", { kind: "sight" }),
      row("19:30", "Dinner at Le Comptoir du Relais", "Le Comptoir du Relais", { kind: "meal" }),
    ],
  };
  const model = new MockLanguageModelV3({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(answer) }],
      finishReason: { unified: "stop", raw: "stop" },
      usage: { inputTokens: { total: 1 }, outputTokens: { total: 1 } },
      warnings: [],
    }),
  });
  return (run) => run(model);
}
const MOVEMENT_START = /^(travel|walk|head|go|take|hop|catch|board|ferry|train|jr|return|back)\b/i;

const fold = (s) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Every finding for one answer, each tagged with a trend key. */
function score(fixture, out) {
  const e = fixture.expect;
  const items = out.items;
  const findings = [];
  const add = (trend, text) => findings.push({ trend, text });

  const days = new Set(items.map((i) => i.day_date ?? `#${i.day_number ?? "?"}`));
  if (days.size !== e.days)
    add("days", `days: got ${days.size}, want ${e.days} (${[...days].join(", ")})`);
  if (items.some((i) => !i.day_date && i.day_number == null) && e.days > 1) {
    add("days", "some stops belong to no day");
  }

  if (Math.abs(items.length - e.stops) > 1) {
    add(
      items.length > e.stops ? "extra-stops" : "missing-stops",
      `stops: got ${items.length}, want ~${e.stops}`,
    );
  }

  const got = items.map((i) => i.time_label).filter(Boolean);
  const missing = [...e.times];
  for (const t of got) {
    const k = missing.indexOf(t);
    if (k >= 0) missing.splice(k, 1);
  }
  const inDetail = missing.filter((t) => items.some((i) => (i.detail ?? "").includes(t)));
  const lost = missing.filter((t) => !inDetail.includes(t));
  if (lost.length) add("lost-times", `times lost: ${lost.join(", ")}`);
  const invented = got.filter(
    (t) => !e.times.includes(t) && !fixture.text.includes(t.replace(/^0/, "")),
  );
  if (invented.length) add("invented-times", `times not in source: ${invented.join(", ")}`);
  if (e.times.length === 0 && got.length)
    add("invented-times", `blog had no times, got ${got.length}`);

  const booked = items.filter((i) => i.booked).length;
  if (booked !== e.booked) add("booked", `booked: got ${booked}, want ${e.booked}`);

  for (const name of e.mustInclude) {
    const hit = items.some((i) =>
      fold(`${i.title} ${i.place ?? ""} ${i.detail ?? ""}`).includes(fold(name)),
    );
    if (!hit) add("dropped-stop", `missing: ${name}`);
  }
  for (const a of e.addresses ?? []) {
    if (!items.some((i) => (i.address ?? "").includes(a)))
      add("address", `address not kept verbatim: ${a}`);
  }
  for (const i of items) {
    if (i.address && !fixture.text.includes(i.address))
      add("invented-address", `address not in source: ${i.address}`);
    if (!i.place && i.kind !== "note") add("no-place", `no place: ${i.title}`);
    if (i.kind === "transport" && !i.booked && MOVEMENT_START.test(i.title)) {
      add("travel-leg", `leg left as a stop: ${i.title}`);
    }
    if (i.estimated_cost != null) add("costs", `cost on import: ${i.title}`);
  }
  return findings;
}

const results = [];
for (const fixture of FIXTURES.filter((f) => !only || f.id.includes(only))) {
  for (let run = 1; run <= runs; run++) {
    const t0 = Date.now();
    let out = null;
    let error = null;
    try {
      out = await withModelFallback((model) =>
        runParse(
          model,
          {
            imageDataUrls: null,
            pdfDataUrl: null,
            pageUrl: null,
            text: fixture.text,
            tripCity: fixture.tripCity,
            startDate: fixture.startDate,
            endDate: null,
            mode: "import",
            pace: null,
            budgetLevel: null,
            currency: null,
            includeCosts: false,
          },
          "",
        ),
      );
    } catch (err) {
      error = String(err?.message ?? err);
    }
    const findings = out ? score(fixture, out) : [{ trend: "error", text: error }];
    results.push({ id: fixture.id, run, ms: Date.now() - t0, findings, out });
    console.log(
      `${findings.length ? "✗" : "✓"} ${fixture.id.padEnd(20)} run ${run}  ${String(out?.items.length ?? "-").padStart(2)} stops  ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    );
    for (const f of findings) console.log(`    [${f.trend}] ${f.text}`);
  }
}

const trends = {};
for (const r of results) for (const f of r.findings) trends[f.trend] = (trends[f.trend] ?? 0) + 1;
console.log(
  "\nTrends:",
  Object.entries(trends).sort((a, b) => b[1] - a[1]),
);

mkdirSync(join(here, "out"), { recursive: true });
const file = join(here, "out", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ trends, results }, null, 2));
console.log(`Raw answers: ${file}`);
