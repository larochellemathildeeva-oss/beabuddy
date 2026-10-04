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
  page.evaluate(() => ({
    text: document.body.innerText,
    count: document.querySelectorAll("*").length,
    writes: window.__writes.length,
    focus: document.activeElement?.outerHTML.slice(0, 80) ?? "",
    map: Array.from(document.querySelectorAll(".leaflet-map-pane, .leaflet-tile-pane")).map((el) => el.getAttribute("style")).join("|"),
    dialogs: document.querySelectorAll('[role="dialog"], .fixed.inset-0').length,
  }));

const tabs = await (async () => {
  const { page } = await open("default");
  const names = await tabNames(page);
  await page.close();
  return names;
})();
// One page per tab. After a click the page is reloaded only when it may
// have changed underneath the next control: a write to the database, or
// something that did not close with Escape.
for (const tab of tabs) {
  let { page, errors } = await open("default");
  await goTab(page, tab);
  const total = await page.locator(CONTROL).count();
  const reload = async () => {
    await page.close();
    ({ page, errors } = await open("default"));
    await goTab(page, tab);
  };
  for (let i = 0; i < total; i++) {
    const control = page.locator(CONTROL).nth(i);
    if (!(await control.isVisible().catch(() => false))) continue;
    // Hidden from people on purpose (the swipe tray before a swipe opens
    // it): not reachable, so not a control to judge.
    const reachable = await control.evaluate(
      (el) =>
        el.getAttribute("tabindex") !== "-1" &&
        !el.closest('[aria-hidden="true"]') &&
        // Already the current choice: choosing it again rightly does nothing.
        el.getAttribute("aria-selected") !== "true" &&
        el.getAttribute("aria-pressed") !== "true",
    );
    if (!reachable) continue;
    const info = await control.evaluate((el) => ({
      tag: el.tagName,
      label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim().slice(0, 50),
      href: el.getAttribute("href"),
      options: el.tagName === "SELECT" ? el.options.length : 0,
      role: el.getAttribute("role"),
      tabName: el.getAttribute("role") === "tab" ? el.textContent.trim() : "",
    }));
    const where = `${tab} › ${info.tag.toLowerCase()} "${info.label}"`;
    if (info.tag === "A" && info.href && info.href !== "#") continue;
    if (info.tag === "SELECT") {
      if (info.options < 2) note(`${where}: select with nothing to choose`);
      continue;
    }
    // Switching to another page tab is covered by the render pass.
    if (info.role === "tab" && tabs.includes(info.tabName) && info.tabName !== tab) continue;
    // Fit must be exercised from a changed camera/selection, not an already fitted map.
    if (info.label === "Fit the whole day") {
      const zoom = page.getByRole("button", { name: "Zoom in", exact: true }).first();
      if (await zoom.count()) await zoom.click();
      await page.waitForTimeout(400);
    }
    const before = await snapshot(page);
    const pressedBefore = await control.getAttribute("aria-pressed").catch(() => null);
    try {
      if (info.label.startsWith("Drag to reorder ")) {
        await control.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Space");
      } else await control.click({ timeout: 2000 });
    } catch (e) {
      note(`${where}: could not be clicked (${String(e.message).split("\n")[0]})`);
      await reload();
      continue;
    }
    await page.waitForTimeout(300);
    const after = await snapshot(page);
    // A click always focuses what was clicked; that alone is not an effect.
    if (await control.evaluate((el) => el === document.activeElement).catch(() => false)) after.focus = before.focus;
    // A toggle flipping its own aria-pressed is an effect, even when the only
    // visible change is an icon (e.g. "Show where I am" on the day map).
    const pressedAfter = await control.getAttribute("aria-pressed").catch(() => null);
    clicked += 1;
    if (errors.length) {
      note(`${where}: threw ${errors.join(" | ").slice(0, 200)}`);
      errors.length = 0;
    }
    const changed =
      before.text !== after.text || before.count !== after.count || before.writes !== after.writes || before.focus !== after.focus || before.map !== after.map || (pressedBefore !== null && pressedBefore !== pressedAfter);
    if (!changed) note(`${where}: click changed nothing (dead end)`);
    let dirty = after.writes !== before.writes;
    if (after.dialogs > before.dialogs) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      const closed = await snapshot(page);
      if (closed.dialogs > before.dialogs) {
        note(`${where}: opened a sheet that Escape does not close`);
        dirty = true;
      }
    }
    if (dirty || (await page.locator(CONTROL).count()) !== total) await reload();
  }
  await page.close();
  console.log(`✓ clicked through ${tab}`);
}

}

// 3. Feature flows, end to end.
async function flow(name, run, sample = "default") {
  if (process.env.PREVIEW_FLOW_FILTER && !name.includes(process.env.PREVIEW_FLOW_FILTER)) return;
  const { page, errors } = await open(sample);
  try {
    await run(page);
    if (errors.length) note(`${name}: threw ${errors.join(" | ").slice(0, 200)}`);
    else console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
const writes = (page) => page.evaluate(() => window.__writes);

await flow("shell: every theme and accent saves, restores and responds to account changes", async (page) => {
  for (const name of ["Dark", "Calm", "Colorful"]) {
    await page.getByRole("radio", { name: new RegExp(`^${name}:`) }).click();
    const live = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem("bea-theme") }));
    if (live.theme !== name.toLowerCase() || live.stored !== name.toLowerCase()) throw new Error(`${name} did not apply and save`);
  }
  for (const name of ["Periwinkle", "Pink", "Periwinkle"]) {
    await page.getByRole("radio", { name, exact: true }).click();
    await page.waitForTimeout(900);
    const live = await page.evaluate(() => ({ accent: document.documentElement.dataset.accent, stored: localStorage.getItem("bea-accent") }));
    if (live.accent !== name.toLowerCase() || live.stored !== name.toLowerCase()) throw new Error(`${name} did not apply and save`);
    const ratios = await page.evaluate(() => {
      const tokens = getComputedStyle(document.documentElement);
      const luminance = (hex) => {
        hex = hex.trim();
        if (hex.length === 4) hex = `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}`;
        const rgb = [1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ink = luminance(tokens.getPropertyValue("--primary-foreground"));
      return ["--acc", "--acc2"].map((token) => (luminance(tokens.getPropertyValue(token)) + 0.05) / (ink + 0.05));
    });
    if (ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 4.5)) throw new Error(`${name} button contrast: ${ratios}`);
    if (!(await writes(page)).some((entry) => entry.table === "profiles" && entry.payload?.accent === name.toLowerCase())) throw new Error(`${name} was not sent to the account`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (await page.getByRole("radio", { name: "Periwinkle", exact: true }).getAttribute("aria-checked") !== "true") throw new Error("the picker lost the saved accent on remount");
  await page.evaluate(() => {
    localStorage.setItem("bea-accent", "pink");
    window.dispatchEvent(new StorageEvent("storage", { key: "bea-accent", newValue: "pink" }));
  });
  await page.waitForTimeout(100);
  if (await page.getByRole("radio", { name: "Pink", exact: true }).getAttribute("aria-checked") !== "true") throw new Error("the picker missed a synced accent change");
}, "shell");

await flow("shell: brand, back, guide, five tabs and offline status remain reachable", async (page) => {
  const labels = ["Home", "World", "Trips", "Recs", "You"];
  const paths = ["/", "/world", "/trips", "/recommendations", "/profile"];
  for (let i = 0; i < labels.length; i++) {
    const link = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: labels[i], exact: true });
    if (await link.getAttribute("href") !== paths[i]) throw new Error(`${labels[i]} has the wrong route`);
    await link.click();
    await page.waitForTimeout(400);
    if (await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: labels[i], exact: true }).getAttribute("aria-current") !== "page") throw new Error(`${labels[i]} is not active after navigation`);
  }
  await page.getByRole("link", { name: "Go back home", exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator("header").getByRole("link").first().click();
  await page.waitForTimeout(400);
  const search = page.getByRole("link", { name: "Search your places", exact: true });
  if (await search.getAttribute("href") !== "/recommendations") throw new Error("Home search lost its route");
  await search.click();
  await page.waitForTimeout(400);
  await page.evaluate(() => history.replaceState(null, "", `${location.href}&back=yes`));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForTimeout(400);
  if (await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Home", exact: true }).getAttribute("aria-current") !== "page") throw new Error("history back did not return Home");
  await page.setViewportSize({ width: 760, height: 900 });
  await page.locator("header").getByRole("link", { name: /Béa, version/ }).click();
  await page.getByText("Travel Buddy", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByText("Travel Buddy", { exact: true }).count() !== 1) throw new Error("the desktop support label disappeared");
  await page.setViewportSize({ width: 414, height: 900 });
  const guide = page.getByRole("button", { name: /guide|help/i }).first();
  await guide.click();
  if (await page.getByRole("dialog").count() !== 1) throw new Error("the page guide did not open");
  await page.keyboard.press("Escape");
  await page.context().setOffline(true);
  await page.getByRole("img", { name: "Offline", exact: true }).waitFor();
  if (await page.getByRole("img", { name: "Offline", exact: true }).count() !== 1) throw new Error("the offline indicator disappeared");
  if (await page.getByRole("status").filter({ hasText: "You're offline" }).count() !== 1) throw new Error("the offline explanation disappeared");
  await page.context().setOffline(false);
}, "shell");
