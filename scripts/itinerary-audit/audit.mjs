/**
 * Put the fixtures through Béa's real import — the same list reader, prompt,
 * model ladder and clean-up the app uses — and score each answer.
 *
 *   GOOGLE_GENERATIVE_AI_API_KEY=… node scripts/itinerary-audit/audit.mjs
 *   … --runs 3              answers per fixture from the model (default 3)
 *   … --engine auto         as the app does: the list reader, else the model (default)
 *   … --engine model        every fixture through the model, to audit the prompt
 *   … --engine rules        the list reader only, no key needed
 *   … --model gemini-3.6-flash   that model only: no quiet step-down to another
 *   … --delay 4000          ms between model calls, under the rate limit (default 4000)
 *   … --only tokyo          one fixture
 *   … --save-baseline       write the trends to baseline.json for this engine
 *   … --compare             print what changed against baseline.json
 *   … --rescore out/<file>.json   score saved answers again, no calls: after changing the scorer
 *   node scripts/itinerary-audit/audit.mjs --mock --only paris   # checks the harness, no key
 *
 * Writes scripts/itinerary-audit/out/<timestamp>.json — every answer, the
 * model's rows before clean-up, which engine and model gave it — and prints
 * a table, every finding, and which findings came back in every run.
 */
import { createJiti } from "jiti";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const value = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : fallback;
};
const runs = Number(value("--runs", "3")) || 3;
const only = value("--only", null);
const engine = value("--engine", "auto");
const pinnedModel = value("--model", null);
const delayMs = Number(value("--delay", "4000"));
const mock = flag("--mock");
const baselineFile = join(here, "baseline.json");

if (!["auto", "model", "rules"].includes(engine)) {
  console.error(`--engine is auto, model or rules, not ${engine}.`);
  process.exit(1);
}
if (!mock && engine !== "rules" && !process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  console.error("Set GOOGLE_GENERATIVE_AI_API_KEY first, or use --engine rules.");
  process.exit(1);
}

const { FIXTURES } = await jiti.import(join(here, "fixtures.ts"));
const { runParse, readPlainAsList } = await jiti.import(
  join(root, "src/lib/itinerary.functions.ts"),
);
const { withModelFallback } =
  engine === "rules"
    ? { withModelFallback: null }
    : mock
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
  return (run, opts) => {
    opts?.onModel?.("mock");
    return run(model);
  };
}

const fold = (s) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const words = (s) =>
  fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/** "Getting there: …" and "Afterwards: …" notes in a stop's detail. */
function legNotes(detail) {
  return [...(detail ?? "").matchAll(/(Getting there|Afterwards):\s*([^·]*)/g)].map((m) => ({
    label: m[1],
    text: m[2].trim(),
  }));
}

const GENERIC = new Set(["take", "travel", "walk", "head", "from", "line", "back", "there"]);

/** Two notes about one journey: the same departure time, or a word naming the same service or place. */
function sameJourney(a, b) {
  const time = (s) => s.match(/\b\d{1,2}:\d{2}\b/)?.[0];
  if (time(a) && time(a) === time(b)) return true;
  const key = (s) => words(s).filter((w) => w.length >= 4 && !GENERIC.has(w));
  return key(a).some((w) => key(b).includes(w));
}

/** Every finding for one answer, each tagged with a trend key. */
function score(fixture, out) {
  const e = fixture.expect;
  const items = out.items;
  const findings = [];
  const add = (trend, text) => findings.push({ trend, text });
  const source = new Set(words(fixture.text));
  const hay = (i) => fold(`${i.title} ${i.place ?? ""} ${i.detail ?? ""}`);

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
  // Only the times a stop should have. Being somewhere in the source is not
  // enough: a chat's "[07/03, 21:14]" is in the source and is nobody's plan.
  const invented = got.filter((t) => !e.times.includes(t));
  if (invented.length) add("invented-times", `times no stop has: ${invented.join(", ")}`);

  const booked = items.filter((i) => i.booked).length;
  if (booked !== e.booked) add("booked", `booked: got ${booked}, want ${e.booked}`);

  for (const name of e.mustInclude) {
    if (!items.some((i) => hay(i).includes(fold(name)))) add("dropped-stop", `missing: ${name}`);
  }
  for (const name of e.mustExclude ?? []) {
    const kept = items.find((i) => fold(`${i.title} ${i.place ?? ""}`).includes(fold(name)));
    if (kept) add("kept-dropped-plan", `kept a plan the source dropped: ${kept.title}`);
  }
  for (const pin of e.pins ?? []) {
    const stop = items.find((i) => hay(i).includes(fold(pin.match)));
    if (stop && !fold(stop.place).includes(fold(pin.place)))
      add("pin", `${pin.match} pinned on "${stop.place ?? "nothing"}", want ${pin.place}`);
  }
  for (const a of e.addresses ?? []) {
    if (!items.some((i) => (i.address ?? "").includes(a)))
      add("address", `address not kept verbatim: ${a}`);
  }

  items.forEach((i, n) => {
    if (i.address && !fixture.text.includes(i.address))
      add("invented-address", `address not in source: ${i.address}`);
    if (!i.place && i.kind !== "note") add("no-place", `no place: ${i.title}`);
    // Any journey left on the timeline, however it is worded ("Hibiya Line
    // to Ginza" starts with no verb). A booked one is a stop.
    if (i.kind === "transport" && !i.booked) add("travel-leg", `leg left as a stop: ${i.title}`);
    if (i.estimated_cost != null) add("costs", `cost on import: ${i.title}`);

    const notes = legNotes(i.detail);
    const prev = items[n - 1];
    for (const [k, note] of notes.entries()) {
      const first = words(note.text)[0];
      if (!first || first === "getting") {
        add("doubled-leg", `empty or nested note on ${i.title}: "${note.label}: ${note.text}"`);
        continue;
      }
      // The journey's first word ("Walk", "Take", "Ferry") should be the
      // source's. Barcelona says "Paseo" and never "walk".
      if (!source.has(first))
        add("invented-leg", `note not in source on ${i.title}: "${note.text}"`);
      else if (
        prev &&
        [prev.title, prev.place].some((p) => p && fold(note.text).startsWith(fold(p)))
      )
        add("invented-leg", `note names the previous stop on ${i.title}: "${note.text}"`);
      const same = notes
        .slice(k + 1)
        .find((o) => o.label === note.label && sameJourney(o.text, note.text));
      if (same) add("doubled-leg", `same journey twice on ${i.title}`);
    }
  });
  return findings;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** One answer for a fixture: from the list reader, or from the model. */
async function answer(fixture) {
  const data = {
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
  };
  if (engine !== "model") {
    const plain = readPlainAsList(data);
    if (plain) return { engine: "rules", model: null, out: plain, raw: null };
    if (engine === "rules") return { engine: "rules", model: null, out: null, raw: null };
  }
  let model = null;
  let raw = null;
  const out = await withModelFallback(
    (m) =>
      runParse(m, data, "", (rows) => {
        raw = rows;
      }),
    { models: pinnedModel ? [pinnedModel] : undefined, onModel: (id) => (model = id) },
  );
  return { engine: "model", model, out, raw };
}

const results = [];
let modelCalls = 0;
const rescore = value("--rescore", null);
if (rescore) {
  const saved = JSON.parse(readFileSync(resolve(here, rescore), "utf8"));
  for (const r of saved.results) {
    const fixture = FIXTURES.find((f) => f.id === r.id);
    if (!fixture || (only && !r.id.includes(only)) || !r.out) continue;
    const findings = score(fixture, r.out);
    results.push({ ...r, engine: r.engine ?? "model", findings });
    console.log(
      `${findings.length ? "✗" : "✓"} ${r.id.padEnd(24)} run ${r.run}  ${r.model ?? r.engine ?? ""}`,
    );
    for (const f of findings) console.log(`    [${f.trend}] ${f.text}`);
  }
}
for (const fixture of FIXTURES.filter((f) => !rescore && (!only || f.id.includes(only)))) {
  for (let run = 1; run <= runs; run++) {
    const t0 = Date.now();
    let got = { engine: engine === "rules" ? "rules" : "model", model: null, out: null, raw: null };
    let error = null;
    try {
      got = await answer(fixture);
    } catch (err) {
      error = String(err?.message ?? err);
    }
    if (got.engine === "model" && !mock) modelCalls++;
    const findings = got.out
      ? score(fixture, got.out)
      : error
        ? [{ trend: "error", text: error }]
        : [{ trend: "declined", text: "not a plain list; the model would read it" }];
    const ms = Date.now() - t0;
    results.push({ id: fixture.id, run, ms, ...got, findings });
    const by = got.engine === "rules" ? "rules" : (got.model ?? "model?");
    console.log(
      `${findings.length ? (findings[0].trend === "declined" ? "·" : "✗") : "✓"} ${fixture.id.padEnd(24)} run ${run}  ${String(got.out?.items.length ?? "-").padStart(2)} stops  ${(ms / 1000).toFixed(1)}s  ${by}`,
    );
    for (const f of findings) console.log(`    [${f.trend}] ${f.text}`);
    // The list reader gives the same answer every time; once is the audit.
    if (got.engine === "rules") break;
    if (!mock && delayMs > 0) await sleep(delayMs);
  }
}

/** Findings per fixture and trend, as "runs it appeared in / runs". */
function consistency(rs) {
  const byFixture = {};
  for (const r of rs) {
    const f = (byFixture[r.id] ??= { runs: 0, trends: {} });
    f.runs++;
    for (const t of new Set(r.findings.map((x) => x.trend))) {
      // Handing a fixture to the model is the reader working, not a mistake.
      if (t !== "declined") f.trends[t] = (f.trends[t] ?? 0) + 1;
    }
  }
  return byFixture;
}

const trends = {};
for (const r of results) for (const f of r.findings) trends[f.trend] = (trends[f.trend] ?? 0) + 1;
const perFixture = consistency(results);
const models = {};
for (const r of results) {
  const k = r.engine === "rules" ? "rules (no model)" : (r.model ?? "none");
  models[k] = (models[k] ?? 0) + 1;
}

console.log(
  "\nAnswered by:",
  Object.entries(models)
    .map(([k, n]) => `${k} ×${n}`)
    .join(", "),
);
const modelIds = Object.keys(models).filter((k) => k !== "rules (no model)" && k !== "none");
if (modelIds.length > 1)
  console.log(
    "  ⚠ More than one model answered, so runs are not like for like. Re-run with --model <id>.",
  );
console.log(
  "Trends:",
  Object.entries(trends).sort((a, b) => b[1] - a[1]),
);

const every = [];
const some = [];
for (const [id, f] of Object.entries(perFixture)) {
  for (const [t, n] of Object.entries(f.trends)) {
    (n === f.runs ? every : some).push(`${id} [${t}] ${n}/${f.runs}`);
  }
}
console.log(`\nIn every run (${every.length}) — worth a fix:`);
for (const line of every) console.log(`  ${line}`);
console.log(`In some runs (${some.length}) — watch, don't fix yet:`);
for (const line of some) console.log(`  ${line}`);

/** Findings per answer for each trend, so runs of different sizes compare. */
function rates(rs) {
  const out = {};
  for (const r of rs) for (const f of r.findings) out[f.trend] = (out[f.trend] ?? 0) + 1;
  for (const k of Object.keys(out)) out[k] = Number((out[k] / rs.length).toFixed(3));
  return out;
}

const summary = {
  engine,
  model: pinnedModel,
  runs,
  answers: results.length,
  models,
  rates: rates(results),
  perFixture: Object.fromEntries(
    Object.entries(perFixture).map(([id, f]) => [
      id,
      Object.fromEntries(Object.entries(f.trends).map(([t, n]) => [t, `${n}/${f.runs}`])),
    ]),
  ),
};

if (flag("--compare")) {
  const base = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")) : {};
  const was = base[engine];
  if (!was) console.log(`\nNo baseline for --engine ${engine} yet. Run with --save-baseline.`);
  else {
    console.log(`\nAgainst the baseline (${was.savedAt}, ${Object.keys(was.models).join(", ")}):`);
    const keys = new Set([...Object.keys(was.rates), ...Object.keys(summary.rates)]);
    for (const k of [...keys].sort()) {
      const a = was.rates[k] ?? 0;
      const b = summary.rates[k] ?? 0;
      if (a === b) continue;
      console.log(`  ${b < a ? "better" : "worse "} ${k.padEnd(18)} ${a} → ${b} per answer`);
    }
    for (const id of Object.keys(summary.perFixture)) {
      const before = was.perFixture[id] ?? {};
      const now = summary.perFixture[id];
      for (const t of Object.keys(now))
        if (!before[t]) console.log(`  new     ${id} [${t}] ${now[t]}`);
      for (const t of Object.keys(before))
        if (!now[t]) console.log(`  gone    ${id} [${t}] was ${before[t]}`);
    }
  }
}

if (flag("--save-baseline")) {
  if (only) console.log("\nNot saving a baseline from --only: it would drop the other fixtures.");
  else {
    const base = existsSync(baselineFile) ? JSON.parse(readFileSync(baselineFile, "utf8")) : {};
    base[engine] = { savedAt: new Date().toISOString().slice(0, 10), ...summary };
    writeFileSync(baselineFile, `${JSON.stringify(base, null, 2)}\n`);
    console.log(`\nBaseline saved for --engine ${engine}: ${baselineFile}`);
  }
}

mkdirSync(join(here, "out"), { recursive: true });
const file = join(here, "out", `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ ...summary, trends, results }, null, 2));
console.log(`Raw answers: ${file}${modelCalls ? ` (${modelCalls} model calls)` : ""}`);
