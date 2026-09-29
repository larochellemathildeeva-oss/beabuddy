/**
 * The frozen import checks CI runs — no keys, no calls, the same answer
 * every time:
 *
 *   - every fixture set through the list reader (--engine rules), and
 *   - every frozen Gemini answer (frozen/answers-<set>.json) through today's
 *     clean-up (--rescore … --replay),
 *
 * each against the findings it had when frozen (frozen/*-<set>.json). A new
 * finding, or a plan the list reader read before and hands on now, fails.
 *
 *   node scripts/itinerary-audit/ci.mjs            # check (what CI runs)
 *   node scripts/itinerary-audit/ci.mjs --save     # accept today's findings as the bar
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const save = process.argv.includes("--save");
const SETS = ["original", "fresh", "more", "world", "edge"];

let failed = 0;
for (const set of SETS) {
  const fixtures = set === "original" ? [] : ["--fixtures", set];
  const runs = [
    {
      name: `${set} · list reader`,
      args: ["--engine", "rules"],
      expect: `frozen/rules-${set}.json`,
    },
  ];
  if (existsSync(join(here, `frozen/answers-${set}.json`)))
    runs.push({
      name: `${set} · frozen Gemini answers`,
      args: ["--rescore", `frozen/answers-${set}.json`, "--replay"],
      expect: `frozen/replay-${set}.json`,
    });
  for (const run of runs) {
    const args = [
      join(here, "audit.mjs"),
      ...fixtures,
      ...run.args,
      save ? "--save-expected" : "--check",
      run.expect,
    ];
    const res = spawnSync(process.execPath, args, { encoding: "utf8" });
    const report = (res.stdout ?? "").split("\n");
    const at = report.findIndex(
      (l) => l.startsWith("Check against") || l.startsWith("Expected findings"),
    );
    console.log(`${res.status === 0 ? "✓" : "✗"} ${run.name}`);
    if (res.status !== 0 || save) {
      for (const line of report.slice(at >= 0 ? at : 0))
        if (line.trim()) console.log(`    ${line}`);
      if (res.stderr?.trim()) console.log(res.stderr);
    }
    if (res.status !== 0) failed++;
  }
}
if (failed) {
  console.log(
    `\n${failed} check(s) got worse. Fix the change, or if the new answer is right, re-save with --save.`,
  );
  process.exit(1);
}
