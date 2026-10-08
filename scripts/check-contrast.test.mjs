import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { checkContrast, contrastRatio, contrastReport, resolveTokens } from "./check-contrast.mjs";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");

test("contrastRatio: black on white is 21", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff") * 100) / 100, 21);
});

test("contrastRatio: #777777 on white is below 4.5", () => {
  assert.ok(contrastRatio("#777777", "#ffffff") < 4.5);
});

test("contrastRatio: short hex and case are understood", () => {
  assert.equal(contrastRatio("#FFF", "#000"), contrastRatio("#ffffff", "#000000"));
});

test("resolveTokens: Calm field border is read from the stylesheet", () => {
  assert.equal(resolveTokens(css, "calm", "pink")["--field-border"], "#8a847e");
});

test("resolveTokens: Colorful follows the periwinkle accent into --primary", () => {
  assert.equal(resolveTokens(css, "colorful", "periwinkle")["--primary"], "#6675ff");
});

test("resolveTokens: Dark merges the .dark block over :root", () => {
  assert.equal(resolveTokens(css, "dark", "pink")["--background"], "#000000");
});

test("checkContrast: a muted text token that is too light is reported by name", () => {
  const fixture = `
    :root, [data-theme="calm"] { --card:#ffffff; --background:#ffffff; --foreground:#111111; --muted-foreground:#bbbbbb; }
    [data-theme="colorful"] {} .dark {}
  `;
  const failures = checkContrast(fixture);
  const hit = failures.find((f) => f.theme === "calm" && f.pair === "--muted-foreground on --card");
  assert.ok(hit, "expected a --muted-foreground on --card failure");
  assert.ok(hit.ratio < hit.min);
});

test("checkContrast: pairs whose tokens are unresolved are skipped, not failed", () => {
  const fixture = `:root, [data-theme="calm"] { --card: oklch(0.9 0 0); --muted-foreground: #000000; }`;
  assert.deepEqual(
    checkContrast(fixture).filter((f) => f.pair === "--muted-foreground on --card"),
    [],
  );
});

test("checkContrast: the real stylesheet passes in every theme and accent", () => {
  assert.deepEqual(checkContrast(css), []);
});

test("shape tokens: 8px corners (16px sheets) in every theme, nothing later squares them", () => {
  for (const theme of ["calm", "colorful", "dark"]) {
    const t = resolveTokens(css, theme, "pink");
    for (const name of ["--r-card", "--r-button", "--r-input", "--r-image"]) {
      assert.equal(t[name], "8px", `${theme} ${name}`);
    }
    assert.equal(t["--r-sheet"], "16px", `${theme} --r-sheet`);
    assert.equal(t["--radius"], "0.5rem", `${theme} --radius`);
  }
});

test("resolveTokens: :not() and .dark selectors on the root decide by theme, and specificity beats order", () => {
  const fixture = `
    :root:not(.dark):not([data-theme="colorful"])[data-accent="pink"] { --acc: #111111; }
    :root, [data-accent="pink"] { --acc: #f6466e; }
    :root.dark[data-accent="pink"] { --acc: #ffffff; }
    [data-theme="colorful"] .not-root { --acc: #00ff00; }
  `;
  assert.equal(resolveTokens(fixture, "calm", "pink")["--acc"], "#111111");
  assert.equal(resolveTokens(fixture, "colorful", "pink")["--acc"], "#f6466e");
  assert.equal(resolveTokens(fixture, "dark", "pink")["--acc"], "#ffffff");
  assert.equal(resolveTokens(fixture, "calm", "periwinkle")["--acc"], "#f6466e");
});

test("accent: Calm is black and Dark is white whichever accent is chosen; Colorful keeps the choice", () => {
  const acc = (theme, accent) => resolveTokens(css, theme, accent)["--acc"];
  assert.equal(acc("calm", "pink"), "#111111");
  assert.equal(acc("calm", "periwinkle"), "#111111");
  assert.equal(acc("dark", "pink"), "#ffffff");
  assert.equal(acc("dark", "periwinkle"), "#ffffff");
  assert.equal(acc("colorful", "pink"), "#5df0bf");
  assert.equal(acc("colorful", "periwinkle"), "#6675ff");
});

test("primary buttons: Calm and Dark buttons carry readable text on their fill", () => {
  const calm = resolveTokens(css, "calm", "periwinkle");
  assert.equal(calm["--primary"], "#111111");
  assert.equal(calm["--primary-foreground"], "#ffffff");
  const dark = resolveTokens(css, "dark", "periwinkle");
  assert.equal(dark["--primary"], "#ffffff");
  assert.equal(dark["--primary-foreground"], "#000000");
});

test("contrastReport: pairs that cannot be read are listed as skipped, not hidden", () => {
  const fixture = `:root, [data-theme="calm"] { --card: color-mix(in oklch, #fff 90%, #000); --muted-foreground: #000000; }`;
  const { skipped } = contrastReport(fixture);
  assert.ok(
    skipped.some((s) => s.theme === "calm" && s.pair === "--muted-foreground on --card"),
    "expected the unreadable pair to be reported",
  );
});

test("contrastReport: the real stylesheet skips no pair in any theme or accent", () => {
  assert.deepEqual(contrastReport(css).skipped, []);
});
