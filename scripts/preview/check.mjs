#!/usr/bin/env node
/**
 * Entry for preview:check. The script body is stored in part files so it can
 * be committed exactly; this joins them and runs that script.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const source = [
  "check.part-a1.mjs",
  "check.part-a2.mjs",
  "check.part-b.mjs",
  "check.part-ca.mjs",
  "check.part-cb.mjs",
]
  .map((name) => readFileSync(join(here, name), "utf8"))
  .join("");
const target = join(here, "check.assembled.mjs");
writeFileSync(target, source);
const child = spawnSync(process.execPath, [target], { stdio: "inherit" });
process.exit(child.status ?? 1);
