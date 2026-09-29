#!/usr/bin/env node
/**
 * Check the pin audit's answer key (pins-truth.mjs) against an independent
 * source: Wikipedia's coordinates for the place's article.
 *
 *   node scripts/itinerary-audit/check-truth.mjs            # report only
 *   … --only kyoto                                         # some plans
 *
 * The answer key was written from memory by the same assistant that fixed the
 * code, and checking it against the geocoder under test would be circular:
 * a wrong answer would become the truth. Wikipedia's coordinates are entered
 * by its editors, not taken from the map services Béa uses. Keyless.
 *
 * Each place is searched as "<name> <town>", and the first article with
 * coordinates is taken, so read the article column: a wrong article (a
 * namesake, the town itself) is shown, not trusted. A place with no article
 * (most restaurants and small hotels) is listed for checking by hand.
 *
 * Writes out/truth-check.json. It never edits pins-truth.mjs: corrections are
 * made by hand, after reading the report.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { TRUTH } from "./pins-truth.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const jiti = createJiti(import.meta.url, { alias: { "@": join(root, "src") } });
const only = process.argv.includes("--only")
  ? process.argv[process.argv.indexOf("--only") + 1].split(",")
  : null;

/** Each plan's town, for searching its places by name and town. */
const towns = {};
for (const file of ["fixtures.ts", "fixtures-fresh.ts", "fixtures-more.ts", "fixtures-world.ts"]) {
  const { FIXTURES } = await jiti.import(join(here, file));
  for (const f of FIXTURES) towns[f.id] = f.tripCity;
}
for (const f of TRUTH.extraFixtures) towns[f.id] = f.tripCity;

const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const UA = "BeaItineraryAudit/1.0 (https://github.com/larochellemathildeeva-oss/beabuddy)";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const km = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};

async function article(query) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query",
    format: "json",
    generator: "search",
    gsrsearch: query,
    gsrlimit: "3",
    prop: "coordinates",
    colimit: "3",
  }).toString();
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return { error: `HTTP ${res.status}` };
  const json = await res.json();
  const pages = Object.values(json.query?.pages ?? {}).sort((a, b) => a.index - b.index);
  // The article must be about the place, not the town or a namesake that
  // happens to be searched first: its title shares a real word of the name.
  const words = fold(query.split(" ").slice(0, -1).join(" "))
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);
  const hit = pages.find((p) => p.coordinates?.[0] && words.some((w) => fold(p.title).includes(w)));
  return hit
    ? { title: hit.title, lat: hit.coordinates[0].lat, lon: hit.coordinates[0].lon }
    : null;
}

const rows = [];
for (const [id, places] of Object.entries(TRUTH.places)) {
  if (only && !only.some((o) => id.includes(o))) continue;
  const town = (towns[id] ?? "").split(",")[0];
  for (const p of places) {
    const found = await article(`${p.match} ${town.split(" ")[0]}`);
    await sleep(250);
    const row = { id, match: p.match, key: { lat: p.lat, lon: p.lon }, tolerance: p.km ?? 0.7 };
    if (!found) row.verdict = "no article";
    else if (found.error) row.verdict = found.error;
    else {
      row.article = found.title;
      row.offKm = Number(km(p, found).toFixed(2));
      row.wiki = { lat: found.lat, lon: found.lon };
      // An article far away is more often the wrong article than a wrong key.
      row.verdict =
        row.offKm <= Math.max(0.3, row.tolerance / 2)
          ? "agrees"
          : row.offKm > 20
            ? "check article"
            : "DISAGREES";
    }
    rows.push(row);
    const where = row.article ? `${row.article} — ${row.offKm} km` : "";
    console.log(`${row.verdict.padEnd(13)} ${id} · ${p.match}  ${where}`);
  }
}

const count = (v) => rows.filter((r) => r.verdict === v).length;
console.log(
  `\n${rows.length} places: ${count("agrees")} agree, ${count("DISAGREES")} disagree, ${count("check article")} matched a far article, ${count("no article")} have no article.`,
);
mkdirSync(join(here, "out"), { recursive: true });
writeFileSync(join(here, "out", "truth-check.json"), JSON.stringify(rows, null, 2));
