#!/usr/bin/env node
/**
 * Design drift guard (docs/DESIGN_TOKENS.md).
 *
 * Counts the patterns that pull screens away from the tokens and primitives
 * (hand-sized text, raw buttons, hex colours in components, styles.css
 * selectors that restyle utility classes) and fails when any count goes up
 * from scripts/design-drift-baseline.json. Counts going down are welcome:
 * re-save the baseline with `--save` in the same pull request.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const baselinePath = join(root, "scripts", "design-drift-baseline.json");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const files = walk(join(root, "src"));
const rel = (p) => relative(root, p).split(sep).join("/");
const tsx = files.filter((p) => p.endsWith(".tsx"));
const styles = readFileSync(join(root, "src", "styles.css"), "utf8");
const read = (p) => readFileSync(p, "utf8");
const count = (text, re) => (text.match(re) ?? []).length;
const sumTsx = (re, keep = () => true) =>
  tsx.filter((p) => keep(rel(p))).reduce((n, p) => n + count(read(p), re), 0);

export function measure() {
  return {
    arbitraryText: sumTsx(/text-\[\d+(\.\d+)?px\]/g),
    arbitraryRadius: sumTsx(/rounded-\[(?!var\()/g),
    arbitraryHeight: sumTsx(/\bh-\[\d+px\]/g),
    rawButton: sumTsx(/<button\b/g, (p) => !p.startsWith("src/components/ui/")),
    hexInTsx: sumTsx(/#[0-9a-fA-F]{6}\b/g, (p) => !p.startsWith("src/components/ui/")),
    tracking: sumTsx(/tracking-(\[[^\]]+\]|wide|wider|widest)\b/g),
    utilitySelectors: count(styles, /\[class\*=/g),
    important: count(styles, /!important/g),
    stylesLines: styles.split("\n").length,
    scrimLiterals: files
      .filter((p) => /\.(tsx?|css)$/.test(p) && !p.endsWith("tokens.css"))
      .reduce((n, p) => n + count(read(p), /linear-gradient\(to (top|bottom|right)/g), 0),
  };
}

const now = measure();
if (process.argv.includes("--save")) {
  writeFileSync(baselinePath, JSON.stringify(now, null, 2) + "\n");
  console.log("Saved design drift baseline:", now);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
const worse = Object.entries(now).filter(([key, value]) => value > (baseline[key] ?? 0));
for (const [key, value] of Object.entries(now)) {
  const was = baseline[key] ?? 0;
  const mark = value > was ? "✗" : value < was ? "↓" : " ";
  console.log(`${mark} ${key.padEnd(18)} ${String(value).padStart(6)}  (baseline ${was})`);
}
if (worse.length) {
  console.error(
    `\nDesign drift went up in ${worse.map(([k]) => k).join(", ")}. Use the tokens and ` +
      "src/components/ui/ primitives instead (docs/DESIGN_TOKENS.md).",
  );
  process.exit(1);
}
if (Object.entries(now).some(([key, value]) => value < (baseline[key] ?? 0))) {
  console.log("\nSome counts went down. Run `npm run check:drift -- --save` to lock them in.");
}
