/**
 * Contrast gate: reads the colour tokens of every theme straight out of
 * src/styles.css and checks the pairs the app depends on (WCAG 2.1: text
 * 4.5:1, non-text 3:1). Calm, Colorful and Dark are each checked under both
 * accents. Tokens that are not plain hex (oklch, color-mix) are left alone.
 *
 *   node scripts/check-contrast.mjs        exits 1 and lists any failures
 */
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const THEMES = ["calm", "colorful", "dark"];
const ACCENTS = ["pink", "periwinkle"];

/** [foreground token, background token, minimum ratio] */
const PAIRS = [
  ["--foreground", "--background", 4.5],
  ["--foreground", "--card", 4.5],
  ["--muted-foreground", "--card", 4.5],
  ["--primary-foreground", "--primary", 4.5],
  ["--destructive-foreground", "--destructive", 4.5],
  ["--field-border", "--card", 3],
  ["--ring", "--background", 3],
  ["--journal-done-ink", "--acc-done", 4.5],
];

const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function channels(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function luminance(hex) {
  const [r, g, b] = channels(hex).map((v) =>
    v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio of two hex colours. */
export function contrastRatio(fg, bg) {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (hi + 0.05) / (lo + 0.05);
}

/** Top-level `selector { declarations }` rules, comments removed, in file order. */
function topLevelRules(css) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let depth = 0;
  let start = 0;
  let selector = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "{") {
      if (depth === 0) selector = text.slice(start, i).trim();
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const body = text.slice(text.indexOf("{", start) + 1, i);
        if (!selector.startsWith("@")) rules.push({ selector, body });
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      start = i + 1;
    }
  }
  return rules;
}

const COMPOUND_TOKEN =
  /^(:root|\.dark|:not\(\.dark\)|\[data-theme="([\w-]+)"\]|:not\(\[data-theme="([\w-]+)"\]\)|\[data-accent="([\w-]+)"\])/;

/**
 * How specific `selector` is for this theme and accent, or 0 when it does not
 * apply. Only selectors made of root-level pieces are understood (:root,
 * .dark, :not(.dark), [data-theme], :not([data-theme]), [data-accent]); each
 * piece counts one class level, as in CSS. Anything with a space or another
 * piece describes an inner element and is not a token source.
 */
function specificity(selector, theme, accent) {
  let rest = selector.trim();
  let count = 0;
  while (rest) {
    const m = rest.match(COMPOUND_TOKEN);
    if (!m) return 0;
    const [piece, , isTheme, notTheme, isAccent] = m;
    const dark = theme === "dark";
    const ok =
      piece === ":root" ||
      (piece === ".dark" && dark) ||
      (piece === ":not(.dark)" && !dark) ||
      (isTheme !== undefined && isTheme === theme) ||
      (notTheme !== undefined && notTheme !== theme) ||
      (isAccent !== undefined && isAccent === accent);
    if (!ok) return 0;
    count++;
    rest = rest.slice(piece.length);
  }
  return count;
}

function declarations(body) {
  const out = [];
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out.push([m[1], m[2].trim()]);
  return out;
}

/** Every token the given theme and accent end up with, aliases followed. */
export function resolveTokens(css, theme, accent) {
  const raw = {};
  const won = {};
  let order = 0;
  for (const { selector, body } of topLevelRules(css)) {
    const spec = Math.max(0, ...selector.split(",").map((x) => specificity(x, theme, accent)));
    if (!spec) continue;
    for (const [name, value] of declarations(body)) {
      order++;
      const prior = won[name];
      if (prior && prior.spec > spec) continue;
      won[name] = { spec, order };
      raw[name] = value;
    }
  }
  const resolve = (name, seen = new Set()) => {
    const value = raw[name];
    if (value === undefined || seen.has(name)) return undefined;
    const alias = value.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/);
    if (!alias) return value;
    seen.add(name);
    return resolve(alias[1], seen) ?? alias[2]?.trim();
  };
  const tokens = {};
  for (const name of Object.keys(raw)) tokens[name] = resolve(name) ?? raw[name];
  return tokens;
}

/**
 * Every theme and accent checked: the pairs that fail, and the pairs that could
 * not be read (a token missing, or not a plain hex colour) so a gate that has
 * gone quiet is visible instead of green.
 */
export function contrastReport(css) {
  const failures = [];
  const skipped = [];
  for (const theme of THEMES) {
    for (const accent of ACCENTS) {
      const tokens = resolveTokens(css, theme, accent);
      for (const [fg, bg, min] of PAIRS) {
        const pair = `${fg} on ${bg}`;
        const a = tokens[fg];
        const b = tokens[bg];
        if (!a || !b || !HEX.test(a) || !HEX.test(b)) {
          skipped.push({ theme, accent, pair });
          continue;
        }
        const ratio = contrastRatio(a, b);
        if (ratio < min) failures.push({ theme, accent, pair, ratio, min });
      }
    }
  }
  return { failures, skipped };
}

/** Failing pairs only, for every theme and accent. */
export function checkContrast(css) {
  return contrastReport(css).failures;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const css = readFileSync(fileURLToPath(new URL("../src/styles.css", import.meta.url)), "utf8");
  const { failures, skipped } = contrastReport(css);
  for (const f of failures) {
    console.error(`${f.theme}/${f.accent}: ${f.pair} is ${f.ratio.toFixed(2)}:1, needs ${f.min}:1`);
  }
  for (const k of skipped) {
    console.error(`${k.theme}/${k.accent}: ${k.pair} could not be read (not a plain hex colour)`);
  }
  if (failures.length || skipped.length) process.exit(1);
  console.log("contrast: every theme and accent passes, no pair skipped");
}
