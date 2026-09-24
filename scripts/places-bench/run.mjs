#!/usr/bin/env node
/**
 * How well Béa's real place search finds real places.
 *
 * Bundles src/lib/places.functions.ts with server functions stubbed into
 * plain functions, then runs each case in cases.mjs the way the app would:
 * Recs with location on, Recs with none, and a trip's destination field.
 * A result counts when one of the first three answers is within the case's
 * distance of where the place really is.
 *
 * Needs the network (OpenStreetMap, or LocationIQ with LOCATIONIQ_TOKEN set).
 * Report only: it never fails, because the internet's answer is the thing
 * being measured. Runs in CI on changes to search; see places-bench.yml.
 */
import { build } from "esbuild";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CASES } from "./cases.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "out");
mkdirSync(out, { recursive: true });

await build({
  entryPoints: [join(root, "src/lib/places.functions.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: join(out, "places.mjs"),
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "error",
  packages: "external",
  alias: {
    "@tanstack/react-start": join(here, "fake-start.ts"),
    "@/integrations/supabase/auth-middleware": join(here, "fake-auth.ts"),
  },
});
const { searchPlaces } = await import(join(out, "places.mjs"));

const km = (a, b) => {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const runs = [];
for (const c of CASES) {
  const modes =
    c.mode === "destination" ? ["destination"] : c.near ? ["recs-here"] : ["recs-here", "recs"];
  for (const mode of modes) {
    const data = {
      query: c.query,
      ...(mode === "recs-here" ? { at: c.at } : {}),
      ...(mode === "destination" ? { areas: true } : {}),
    };
    let answers = [];
    let error = "";
    try {
      answers = await searchPlaces({ data });
    } catch (e) {
      error = String(e?.message ?? e).slice(0, 80);
    }
    const target = c.want ?? c.at;
    const top = answers.slice(0, 3);
    const hit = top.find((p) => p.lat != null && km(target, p) <= c.km);
    const fold = (v) =>
      v
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
    const branch =
      !hit && c.branches
        ? top.find(
            (p) => p.lat != null && km(target, p) <= 10 && fold(p.name).includes(fold(c.query)),
          )
        : undefined;
    runs.push({
      query: c.query,
      mode,
      found: Boolean(hit || branch),
      branch: Boolean(branch),
      first: answers[0] ? `${answers[0].name}${answers[0].city ? `, ${answers[0].city}` : ""}` : "",
      off: answers[0]?.lat != null ? `${km(target, answers[0]).toFixed(1)} km` : "",
      error,
    });
    // One search can be several requests; leave the public servers room.
    await sleep(2_000);
  }
}

const lines = [
  `### Place search benchmark — ${process.env.LOCATIONIQ_TOKEN ? "LocationIQ" : "public OpenStreetMap"}`,
  "",
  "| Search | Where | Found | First answer | Off by |",
  "| --- | --- | --- | --- | --- |",
  ...runs.map(
    (r) =>
      `| ${r.query} | ${r.mode} | ${r.branch ? "✅ other branch" : r.found ? "✅" : "❌"} | ${r.error ? `error: ${r.error}` : r.first || "(nothing)"} | ${r.off} |`,
  ),
  "",
  ...["recs-here", "recs", "destination"].map((m) => {
    const of = runs.filter((r) => r.mode === m);
    return `- **${m}**: ${of.filter((r) => r.found).length} of ${of.length} found`;
  }),
];
const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + "\n");
