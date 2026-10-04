#!/usr/bin/env node
/**
 * Renders the real trip page (TripDetail) with sample data and clicks every
 * control on every tab, to prove there are no dead ends.
 *
 *   npm run build            # once, for the app's compiled stylesheet
 *   npm run preview:check    # this script
 *
 * For each sample (default, empty, undated, long, guest) it opens each tab,
 * saves a screenshot to scripts/preview/out/, and fails on any page error.
 * For the default sample it also clicks every visible button, tab, link and
 * select, one at a time from a fresh page, and fails when a click:
 *   - throws,
 *   - changes nothing (no text, no element count, no write, no focus move),
 *   - or opens a sheet that Escape does not close.
 * Links with a real href pass without being followed.
 *
 * Browser: CHROMIUM_PATH, else /opt/pw-browsers/chromium (cloud sessions),
 * else the installed Google Chrome.
 */
import { build } from "esbuild";
import { runThemeChecks } from "./run-themes.mjs";
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const out = join(here, "out");
mkdirSync(out, { recursive: true });

const assets = join(root, ".output", "public", "assets");
const css = existsSync(assets) && readdirSync(assets).find((f) => /^styles-.*\.css$/.test(f));
if (!css) {
  console.error("No built stylesheet found. Run `npm run build` first.");
  process.exit(2);
}

const src = join(here, "src");
if (process.env.PREVIEW_NO_BUILD !== "1") {
await build({
  entryPoints: { page: join(src, "main.tsx"), boot: join(src, "boot.ts") },
  bundle: true,
  outdir: out,
  jsx: "automatic",
  loader: { ".png": "dataurl", ".json": "json" },
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "error",
  plugins: [{ name: "preview-server-stubs", setup(build) {
    build.onResolve({ filter: /^(node:|undici$|string_decoder$)/ }, () => ({ path: join(src, "fake-node.ts") }));
    build.onResolve({ filter: /\?url$/ }, () => ({ path: "preview-url", namespace: "preview-url" }));
    build.onLoad({ filter: /.*/, namespace: "preview-url" }, () => ({ contents: 'export default "";', loader: "js" }));
  } }],
  alias: {
    "@/integrations/supabase/client": join(src, "fake-supabase.ts"),
    "@tanstack/react-start": join(src, "fake-start.ts"),
    "@tanstack/react-start/server": join(src, "fake-start.ts"),
    "@tanstack/react-router": join(src, "fake-router.tsx"),
    "@/lib/directions.functions": join(src, "fake-directions.ts"),
    "@/lib/itinerary.functions": join(src, "fake-itinerary.ts"),
    "@/lib/geocode-plan.functions": join(src, "fake-geocode-plan.ts"),
    "@/lib/place-details.functions": join(src, "fake-place-details.ts"),
    "node:net": join(src, "fake-node.ts"),
    "node:dns/promises": join(src, "fake-node.ts"),
  },
  define: {
    "__APP_VERSION__": JSON.stringify(JSON.parse(readFileSync(join(root, "package.json"))).version),
    "import.meta.env": JSON.stringify({ DEV: false, PROD: true, VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "x" }),
  },
});
writeFileSync(join(out, "app.css"), readFileSync(join(assets, css)));
const fontLinks = process.env.PREVIEW_FONT_DIR
  ? `<style>${[["Manrope", "200 800", "manrope.woff2"], ["Instrument Serif", "400", "serif.woff2"]].map(([family, weight, file]) => `@font-face{font-family:"${family}";font-weight:${weight};src:url(data:font/woff2;base64,${readFileSync(join(process.env.PREVIEW_FONT_DIR, file)).toString("base64")}) format("woff2");}`).join("")}</style>`
  : '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap">';
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><script src="boot.js"></script>
${fontLinks}
<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="page.css"></head>
<body class="bg-background text-foreground font-sans antialiased"><div id="root"></div><script src="page.js"></script></body></html>`,
);

}

if (process.env.PREVIEW_RENDER_ONLY === "1") process.exit(0);

// The full gate exercises every control and feature flow in all three themes.
if (!process.env.PREVIEW_THEME && process.env.PREVIEW_FLOWS_ONLY !== "1") {
  const reports = await runThemeChecks({ script: fileURLToPath(import.meta.url), out });
  process.exit(reports.some(({ code, failures }) => code !== 0 || failures.length > 0) ? 1 : 0);
}
const previewTheme = process.env.PREVIEW_THEME ?? "calm";

const executablePath =
  process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : { channel: "chrome", chromiumSandbox: true });

// A plain map tile: this checks the page, not the tile server.
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/+/9fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64",
);
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json" };

async function open(sample) {
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  page.setDefaultTimeout(5000);
  // "Show where I am" on the day map asks the phone's position. Grant it a
  // fixed one near the trip's city (Hiroshima) so the control exercises for
  // real — a position fix, not a browser prompt that never resolves.
  await page.context().grantPermissions(["geolocation"]);
  await page.context().setGeolocation({ latitude: 34.3853, longitude: 132.4553 });
  await page.addInitScript((theme) => {
    if (localStorage.getItem("bea-theme") === null) localStorage.setItem("bea-theme", theme);
    if (localStorage.getItem("bea-accent") === null) localStorage.setItem("bea-accent", "pink");
  }, previewTheme);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/tile/")) return route.fulfill({ body: tile, contentType: "image/png" });
    if (url.host.endsWith("googleapis.com") || url.host.endsWith("gstatic.com")) return route.continue();
    if (url.host !== "preview.test") return route.abort();
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      if (file === "/index.html") return route.fulfill({
        body: readFileSync(join(out, file), "utf8").replace('<html lang="en">', `<html lang="en" data-theme="${previewTheme}" data-accent="pink" class="${previewTheme === "dark" ? "dark" : ""}">`),
        contentType: "text/html",
      });
      return route.fulfill({ body: readFileSync(existsSync(join(out, file)) ? join(out, file) : join(root, "public", file)), contentType: types[file.split(".").pop()] ?? "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  // A full navigation of the large preview bundle, with three themes running
  // in parallel, can take longer than the 5s interaction default; give it room
  // so a slow reload does not crash the worker.
  await page.goto(`https://preview.test/?sample=${sample}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}

const tabNames = async (page) =>
  page.$$eval('[role="tablist"][aria-label="How to look at this trip"] [role="tab"]', (els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()));

async function goTab(page, name) {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForTimeout(500);
}

const failures = [];
const note = (msg) => {
  failures.push(msg);
  console.log("  ✗", msg);
};

let clicked = 0;
if (process.env.PREVIEW_FLOWS_ONLY !== "1") {
// 1. Every sample, every tab: renders without errors; screenshot.
for (const sample of ["default", "empty", "undated", "long", "guest"]) {
  const { page, errors } = await open(sample);
  const names = await tabNames(page);
  for (const name of names) {
    await goTab(page, name);
    // Day strip: pick the first dated day where offered, so day views have content.
    const day1 = page.getByRole("tab", { name: /Day 1/ });
    if ((await day1.count()) > 0) await day1.first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${previewTheme}-${sample}-${name.replace(/\W+/g, "-").toLowerCase()}.png`), fullPage: true });
  }
  // Asking for a day when there is no day strip to pick from is a dead end.
  await goTab(page, names[0]);
  const asks = (await page.getByText("Pick a day to follow.").count()) > 0;
  const strip = (await page.getByRole("tablist", { name: "Which day to show" }).count()) > 0;
  if (asks && !strip) note(`${sample}: Companion asks for a day but offers no way to pick one`);
  if (errors.length) note(`${sample}: page errors: ${errors.join(" | ").slice(0, 300)}`);
  console.log(`✓ ${sample}: rendered ${names.join(", ")}`);
  await page.close();
}

// 1b. Dark mode: the default sample, every tab.
{
  const { page, errors } = await open("default");
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  for (const name of await tabNames(page)) {
    await goTab(page, name);
    const day1 = page.getByRole("tab", { name: /Day 1/ });
    if ((await day1.count()) > 0) await day1.first().click().catch(() => {});
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(out, `${previewTheme}-dark-${name.replace(/\W+/g, "-").toLowerCase()}.png`), fullPage: true });
  }
  if (errors.length) note(`dark: page errors: ${errors.join(" | ").slice(0, 300)}`);
  console.log("✓ dark: rendered every tab");
  await page.close();
}

// 2. Default sample: click every control on every tab.
const CONTROL = 'button:not([disabled]), [role="tab"], a, select:not([disabled])';
const snapshot = (page) =>
