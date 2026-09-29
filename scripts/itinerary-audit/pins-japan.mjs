/**
 * The frozen pin check: a traveller's real 10-day Japan plan (127 stops,
 * frozen/japan) placed the way ItineraryImport places it, from frozen map
 * answers — no keys, no calls, the same answer every time — and scored
 * against an answer key reviewed by hand (frozen/japan/truth.json).
 *
 *   node scripts/itinerary-audit/pins-japan.mjs            # check (what CI runs)
 *   node scripts/itinerary-audit/pins-japan.mjs --save     # accept today's score as the bar
 *   NODE_USE_ENV_PROXY=1 node scripts/itinerary-audit/pins-japan.mjs --record
 *       # ask the real map (LocationIQ + Open Places keys, spend-capped) for
 *       # any question the frozen answers lack, and freeze those answers too
 *
 * A check fails when more pins are saved wrong, or fewer saved right, than
 * frozen/japan/expected.json. When a change asks the map something new, the
 * replay has no answer for it (it is reported): run --record, then --save.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const dir = join(here, "frozen/japan");
const args = process.argv.slice(2);
const record = args.includes("--record");
const save = args.includes("--save");

// The providers the answers were frozen with: LocationIQ, then Open Places.
// A replay needs no real keys, only the same choice of provider.
process.env.AUDIT_FROZEN_DIR = "scripts/itinerary-audit/frozen/japan/geo";
delete process.env.GEOAPIFY_API_KEY;
if (!record) {
  process.env.AUDIT_REPLAY = "1";
  process.env.LOCATIONIQ_TOKEN ||= "replay";
  process.env.OPEN_PLACES_API_KEY ||= "replay";
} else if (!process.env.LOCATIONIQ_TOKEN || !process.env.OPEN_PLACES_API_KEY) {
  console.error("--record needs LOCATIONIQ_TOKEN and OPEN_PLACES_API_KEY.");
  process.exit(1);
}

const { installSpendGuard } = await import("./spend-guard.mjs");
const spend = await installSpendGuard(root);
const { buildPinsBundle } = await import("./bundle.mjs");
const lib = await buildPinsBundle();

const items = JSON.parse(readFileSync(join(dir, "items.json"), "utf8")).items;
const truth = JSON.parse(readFileSync(join(dir, "truth.json"), "utf8")).stops;

// Placed as ItineraryImport places them: in batches, each stop under its
// parent, with the last pin carried to the next batch.
const parents = items.map((_, i) => lib.parentIndex(items, i));
const stops = items.map((item, i) => ({
  title: item.title,
  detail: item.detail ?? null,
  place: item.place ?? null,
  address: item.address ?? null,
  city: item.city ?? null,
  ...(lib.afterJourney(item, items[i - 1]) ? { fresh: true } : {}),
}));
const placed = new Map();
let recent = [];
let near = null;
for (const [from, to] of lib.placeBatches(parents, 8)) {
  const batch = stops.slice(from, to).map((stop, k) => {
    const parent = parents[from + k];
    return parent >= from ? { ...stop, within: parent - from } : stop;
  });
  for (let attempt = 0; attempt < 3; attempt++) {
    const r = await lib.geocodePlanStops({
      data: { stops: batch, area: "Japan", recent, venues: true, inOrder: true, near },
    });
    recent = r.sent ?? [];
    near = r.lastPin ?? near;
    for (const hit of r.placed)
      if (!placed.has(hit.index + from)) placed.set(hit.index + from, hit);
    if (!r.throttled) break;
    await new Promise((res) => setTimeout(res, 65_000));
  }
}

// Saved or flagged as the import screen decides it.
const rank = { high: 2, medium: 1, low: 0 };
function confidence(row, hit) {
  if (hit.inside) return "medium";
  if (lib.airportMatch(row, hit)) return "high";
  if (lib.outsideAddressDistrict(row.address, hit.label)) return "low";
  if (hit.farKm) return "low";
  return [row.title, row.place, row.address, hit.matchedAs]
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
}

const km = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b[0] - a[0]) * r) / 2) ** 2 +
    Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(((b[1] - a[1]) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
/** right, wrong or unverified: a pin against the answer key. */
function judge(key, hit) {
  if (!key || key.unverified) return "unverified";
  if (key.label) return new RegExp(key.label, "i").test(hit.label ?? "") ? "right" : "wrong";
  return km(key.near, [hit.lat, hit.lon]) <= key.km ? "right" : "wrong";
}

const result = {};
const counts = { savedRight: 0, savedWrong: 0, savedUnverified: 0, flagged: 0, notPlaced: 0 };
items.forEach((row, i) => {
  const hit = placed.get(i);
  if (!hit) {
    counts.notPlaced++;
    result[i] = { title: row.title, outcome: "not placed" };
    return;
  }
  const saved = lib.pinIsSaved(confidence(row, hit), undefined);
  const verdict = judge(truth[i], hit);
  if (!saved) counts.flagged++;
  else if (verdict === "right") counts.savedRight++;
  else if (verdict === "wrong") counts.savedWrong++;
  else counts.savedUnverified++;
  result[i] = {
    title: row.title,
    outcome: saved ? `saved ${verdict}` : `flagged (${verdict})`,
    label: (hit.label ?? "").slice(0, 90),
  };
});

const expectedFile = join(dir, "expected.json");
console.log(
  `Japan plan, ${items.length} stops: ${counts.savedRight} saved right · ${counts.savedWrong} saved WRONG · ` +
    `${counts.savedUnverified} saved, not in the key · ${counts.flagged} flagged · ${counts.notPlaced} not placed`,
);
if (spend.missed.length)
  console.log(
    `  ${spend.missed.length} map questions had no frozen answer: this change asks something new. Run --record, then --save.`,
  );

let failed = false;
if (save) {
  writeFileSync(expectedFile, `${JSON.stringify({ counts, stops: result }, null, 1)}\n`);
  console.log(`Saved as the bar: ${expectedFile}`);
} else if (existsSync(expectedFile)) {
  const was = JSON.parse(readFileSync(expectedFile, "utf8"));
  for (const [i, now] of Object.entries(result)) {
    const before = was.stops[i];
    if (before?.outcome === now.outcome && before?.label === now.label) continue;
    const mark = now.outcome === "saved wrong" ? "✗" : now.outcome === "saved right" ? "✓" : "·";
    console.log(
      `  ${mark} ${String(i).padStart(3)} ${now.title.slice(0, 40).padEnd(40)} ${before?.outcome ?? "-"} → ${now.outcome}${now.label ? `  (${now.label})` : ""}`,
    );
  }
  if (counts.savedWrong > was.counts.savedWrong) {
    console.log(`✗ saved wrong ${was.counts.savedWrong} → ${counts.savedWrong}`);
    failed = true;
  }
  if (counts.savedRight < was.counts.savedRight) {
    console.log(`✗ saved right ${was.counts.savedRight} → ${counts.savedRight}`);
    failed = true;
  }
  if (!failed) console.log("✓ no pin got worse");
} else {
  console.log("No bar yet: run with --save.");
}
spend.report();
if (failed) process.exit(1);
