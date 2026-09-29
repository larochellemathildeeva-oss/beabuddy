#!/usr/bin/env node
/**
 * Where Béa pins each stop of the audit plans, against where it really is.
 *
 *   LOCATIONIQ_TOKEN=… node scripts/itinerary-audit/pins.mjs
 *   … --only osaka          plans whose id has this in it
 *   … --model out/<file>.json   rows for plans the list reader declines, from a
 *                               saved model run (no model calls are made here)
 *
 * Rows come from the list reader, as the app reads a tidy plan; a plan it
 * declines is taken from the saved model run, or skipped. Each is placed by
 * the real geocodePlanStops, bundled with the server-function stand-ins the
 * places bench uses, in batches as ItineraryImport sends them. A stop counts
 * as right within its `km` of the real place (default 0.7).
 *
 * Needs the network: Geoapify with GEOAPIFY_API_KEY set, else LocationIQ,
 * else public OpenStreetMap. Report only — the map's answer is what is measured.
 * Behind an HTTP proxy (a cloud session) Node's fetch ignores it unless
 * NODE_USE_ENV_PROXY=1 is set, and every lookup then reads as "not found".
 *
 * A pin counts as the import screen would treat it: saved unasked when its
 * match is confident (✓ right, ✗ WRONG), or left for the traveller to confirm
 * (✓? right, ✗? wrong but flagged). Saved-and-wrong is the number to keep at 0.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPinsBundle } from "./bundle.mjs";
import { installSpendGuard } from "./spend-guard.mjs";
import { TRUTH } from "./pins-truth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
// Every paid request counted, across runs, and refused past the day's cap.
const spend = await installSpendGuard(root);
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const only = value("--only");
const modelFile = value("--model");

const lib = await buildPinsBundle();

const saved = modelFile ? JSON.parse(readFileSync(resolve(here, modelFile), "utf8")).results : [];

const km = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
const fold = (s) => (s ?? "").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const PLACE_BATCH = 8;
let requests = 0;
/** A city venue's margin once its point is checked, as Gemini's review asked. */
const TIGHT_KM = 0.25;
/** Places whose point Wikipedia agrees with (out/truth-check.json), keyed plan|name. */
const verified = new Map();
try {
  for (const row of JSON.parse(readFileSync(join(out, "truth-check.json"), "utf8"))) {
    if (row.verdict === "agrees") verified.set(`${row.id}|${row.match}`, row);
  }
} catch {
  console.log(
    "No out/truth-check.json: run check-truth.mjs first to score against checked points.",
  );
}
/** One pace for the whole run: the provider's minute cap is the app's, not a plan's. */
let recent = [];
let throttles = 0;

/** The rows the app would place, as ItineraryImport builds them. */
function rowsFor(fixture) {
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
  const plain = lib.readPlainAsList(data);
  if (plain) return { by: "rules", items: plain.items };
  const answer = saved.find((r) => r.id === fixture.id && r.out);
  return answer ? { by: "model (saved)", items: answer.out.items } : null;
}

async function place(fixture, items) {
  const parents = items.map((_, i) => lib.parentIndex(items, i));
  const stops = items.map((item, i) => ({
    title: item.title,
    detail: item.detail ?? null,
    place: item.place ?? null,
    address: item.address ?? null,
    city: item.city ?? null,
    ...(lib.afterJourney(item, items[i - 1]) ? { fresh: true } : {}),
    ...(lib.afterRide(items[i - 1]) ? { rode: true } : {}),
  }));
  const placed = [];
  let near = null;
  for (const [from, to] of lib.placeBatches(parents, PLACE_BATCH)) {
    const batch = stops.slice(from, to).map((stop, k) => {
      const parent = parents[from + k];
      return parent >= from ? { ...stop, within: parent - from } : stop;
    });
    // The app gives up on a throttled batch; the audit waits and asks again,
    // so a pin is judged on the map's answer and not on the rate limit.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await lib.geocodePlanStops({
        data: { stops: batch, area: fixture.tripCity, recent, venues: true, inOrder: true, near },
      });
      requests += Math.max(0, (result.sent ?? []).filter((t) => !recent.includes(t)).length);
      recent = result.sent ?? [];
      near = result.lastPin ?? near;
      for (const hit of result.placed) {
        const index = hit.index + from;
        if (!placed.some((p) => p.index === index)) placed.push({ ...hit, index });
      }
      if (!result.throttled) break;
      throttles++;
      await new Promise((r) => setTimeout(r, 65_000));
    }
  }
  return placed;
}

const fixtures = [
  ...lib.WORLD,
  ...lib.FRESH,
  ...lib.MORE,
  ...lib.OLD,
  ...TRUTH.extraFixtures,
].filter((f) => TRUTH.places[f.id] && (!only || only.split(",").some((o) => f.id.includes(o))));
/** right/wrong: saved unasked; …Flagged: shown as "check this one", not saved. */
const tally = { right: 0, rightFlagged: 0, wrong: 0, wrongFlagged: 0, unplaced: 0, missingStop: 0 };
const report = [];
for (const fixture of fixtures) {
  const rows = rowsFor(fixture);
  if (!rows) {
    console.log(`· ${fixture.id}: not a plain list and no saved model answer — skipped`);
    continue;
  }
  const placed = await place(fixture, rows.items);
  console.log(`\n${fixture.id} (${rows.by}, ${fixture.tripCity})`);
  for (const truth of TRUTH.places[fixture.id]) {
    const index = rows.items.findIndex((i) =>
      fold(`${i.title} ${i.place ?? ""}`).includes(fold(truth.match)),
    );
    if (index < 0) {
      tally.missingStop++;
      console.log(`  ? ${truth.match}: no stop`);
      report.push({ id: fixture.id, ...truth, result: "no stop" });
      continue;
    }
    const hit = placed.find((p) => p.index === index);
    if (!hit) {
      tally.unplaced++;
      console.log(`  · ${truth.match}: not placed`);
      report.push({
        id: fixture.id,
        ...truth,
        result: "unplaced",
        verified: verified.has(`${fixture.id}|${truth.match}`),
      });
      continue;
    }
    // Checked against Wikipedia (check-truth.mjs): its point, and a city
    // venue's margin tightened to 250 m. Unchecked: the key as written, at
    // its own margin, and reported as unverified.
    const checked = verified.get(`${fixture.id}|${truth.match}`);
    const target = checked ? checked.wiki : truth;
    const margin = checked ? ((truth.km ?? 0.7) > 0.7 ? truth.km : TIGHT_KM) : (truth.km ?? 0.7);
    const off = km(hit, target);
    const ok = off <= margin;
    // Whether the import screen would save this pin unasked, as it decides.
    const row = rows.items[index];
    const rank = { high: 2, medium: 1, low: 0 };
    const confidence = hit.inside
      ? "medium"
      : lib.airportMatch(row, hit)
        ? "high"
        : lib.outsideAddressDistrict(row.address, hit.label)
          ? "low"
          : hit.farKm
            ? "low"
            : [row.title, row.place, row.address, hit.matchedAs]
                .filter((n) => n && n.trim())
                .map(
                  (title) =>
                    lib.scoreMatch({
                      title,
                      label: hit.label ?? null,
                      category: hit.category ?? null,
                      kind: hit.kind ?? null,
                      alsoNamed: hit.alsoNamed ?? null,
                    }).confidence,
                )
                .reduce((a, b) => (rank[b] > rank[a] ? b : a), "low");
    const saved = lib.pinIsSaved(confidence, undefined);
    const verdict = ok ? (saved ? "right" : "rightFlagged") : saved ? "wrong" : "wrongFlagged";
    tally[verdict]++;
    const where = (hit.label ?? "").split(",").slice(0, 2).join(",");
    console.log(
      `  ${ok ? (saved ? "✓" : "✓?") : saved ? "✗" : "✗?"} ${truth.match}: ${off.toFixed(2)} km off — ${where}${hit.farKm ? ` (flagged ${hit.farKm} km out)` : ""}${hit.overtureId ? " [Overture]" : ""}`,
    );
    report.push({
      id: fixture.id,
      ...truth,
      result: verdict,
      confidence,
      offKm: Number(off.toFixed(2)),
      verified: Boolean(checked),
      marginKm: margin,
      pin: { lat: hit.lat, lon: hit.lon },
      label: hit.label ?? null,
      farKm: hit.farKm ?? null,
    });
  }
}
const total = Object.values(tally).reduce((a, b) => a + b, 0);
const tier = (v) => {
  const rs = report.filter((r) => r.verified === v && r.result !== "no stop");
  const n = (k) => rs.filter((r) => r.result === k).length;
  return `${n("right")}/${rs.length} saved right, ${n("wrong")} saved WRONG, ${n("rightFlagged") + n("wrongFlagged")} flagged, ${n("unplaced")} not placed`;
};
console.log(`\nChecked against Wikipedia (250 m for city venues): ${tier(true)}`);
console.log(`Unchecked answer key (old margins): ${tier(false)}`);
console.log(
  `\nSaved right ${tally.right}/${total} · saved WRONG ${tally.wrong} · right but flagged ${tally.rightFlagged} · wrong and flagged ${tally.wrongFlagged} · not placed ${tally.unplaced} · no such stop ${tally.missingStop}`,
);
console.log(
  "(✓ saved right · ✗ saved wrong · ✓? right, left for the traveller to confirm · ✗? wrong, flagged so not saved)",
);
const file = join(out, `pins-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
writeFileSync(file, JSON.stringify({ tally, report }, null, 2));
console.log(`Report: ${file} · ${requests} map requests · throttled ${throttles}×`);
spend.report();
