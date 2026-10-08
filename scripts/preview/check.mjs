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
    "@/lib/rates.functions": join(src, "fake-rates.ts"),
    "@/lib/itinerary.functions": join(src, "fake-itinerary.ts"),
    "@/lib/geocode-plan.functions": join(src, "fake-geocode-plan.ts"),
    "@/lib/place-details.functions": join(src, "fake-place-details.ts"),
    "@/lib/weather.functions": join(src, "fake-weather.ts"),
    "@/lib/city-locate": join(src, "fake-city-locate.ts"),
    "node:net": join(src, "fake-node.ts"),
    "node:dns/promises": join(src, "fake-node.ts"),
  },
  define: {
    "__APP_VERSION__": JSON.stringify(JSON.parse(readFileSync(join(root, "package.json"))).version),
    "import.meta.env": JSON.stringify({ DEV: false, PROD: true, VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "x" }),
  },
});
writeFileSync(join(out, "app.css"), readFileSync(join(assets, css)));
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><script src="boot.js"></script>
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
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json", woff2: "font/woff2" };

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
      // The built stylesheet points at /assets/dm-sans-*.woff2: serve the real font file.
      if (file.startsWith("/assets/") && existsSync(join(assets, file.slice(8)))) return route.fulfill({ body: readFileSync(join(assets, file.slice(8))), contentType: types[file.split(".").pop()] ?? "application/octet-stream" });
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
  if (["legs", "unpinned"].includes(sample)) await page.clock.setFixedTime(new Date("2026-10-07T10:30:00"));
  await page.goto(`https://preview.test/?sample=${sample}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1200);
  return { page, errors };
}

const tabNames = async (page) =>
  page.$$eval('[role="tablist"][aria-label="How to look at this trip"] [role="tab"]', (els) => els.map((e) => e.getAttribute("aria-label") ?? e.textContent.trim()));

async function goTab(page, name) {
  if (name === "Companion") {
    // Companion is the live side of the Map tab, reached by its switch.
    await page.getByRole("tab", { name: "Map", exact: true }).click();
    await page.waitForTimeout(300);
    const sw = page.getByRole("button", { name: "Companion", exact: true });
    if (!(await sw.count())) throw new Error("the Companion switch is missing under the Map tab");
    await sw.first().click();
    await page.waitForTimeout(500);
    const firstDay = page.getByRole("tab", { name: /Day 1/ });
    if (await firstDay.count()) await firstDay.first().click();
    return;
  }
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForTimeout(500);
  if (name === "Timeline") {
    const firstDay = page.getByRole("tab", { name: /Day 1/ });
    if (await firstDay.count()) await firstDay.first().click();
  }
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
const flowSelected = (name) => !process.env.PREVIEW_FLOW_FILTER || process.env.PREVIEW_FLOW_FILTER.split("|").some(filter => name.includes(filter));
async function flow(name, run, sample = "default") {
  if (!flowSelected(name)) return;
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
// Calm and Dark keep their black and white whichever accent is chosen, so only
// Colorful shows the accent picker. Where the picker is absent, set the accent
// the way it does, so the colour tokens are still measured under both accents.
async function chooseAccent(page, name) {
  const radio = page.getByRole("radio", { name, exact: true });
  if (await radio.count()) return radio.click();
  await page.evaluate((n) => {
    document.documentElement.dataset.accent = n.toLowerCase();
    localStorage.setItem("bea-accent", n.toLowerCase());
  }, name);
}

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

await flow("trips: tabs, layout and picture switches, New trip and Join sheets", async (page) => {
  const text = () => page.evaluate(() => document.body.innerText);
  if (!(await text()).includes("Your trips.")) throw new Error("the Trips header is missing");
  if (!(await text()).toLowerCase().includes("next up")) throw new Error("Big banner shows no Next up");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.waitForTimeout(300);
  if (!(await text()).toLowerCase().includes("upcoming trips") || (await page.evaluate(() => localStorage.getItem("bea-trips-layout"))) !== "list") throw new Error("List did not apply and save");
  for (const [tab, expect] of [["Past", "Lisbon & Porto"], ["All", "Montréal Holidays"], ["Upcoming", "Trip documents"]]) {
    await page.getByRole("tab", { name: tab, exact: true }).click();
    await page.waitForTimeout(250);
    if (!(await text()).toLowerCase().includes(expect.toLowerCase())) throw new Error(`${tab} does not show ${expect}`);
  }
  await page.getByRole("button", { name: "More for JQAPALA A", exact: true }).click();
  for (const item of ["Open trip", "To-dos", "Packing", "Bookings"])
    if ((await page.getByRole("menuitem", { name: item, exact: true }).count()) !== 1) throw new Error(`the row menu lost ${item}`);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "New trip", exact: true }).click();
  await page.waitForTimeout(300);
  const sheet = page.getByRole("dialog");
  for (const label of ["Trip name", "Where is this trip going?"])
    if ((await sheet.getByLabel(label).count()) < 1) throw new Error(`New trip lost ${label}`);
  if ((await sheet.getByRole("button", { name: "Create trip" }).count()) !== 1) throw new Error("New trip lost Create trip");
  // Escape closes the open calendar first, and the sheet only on the next press.
  await sheet.getByRole("button", { name: /^Dates/ }).click();
  await page.waitForTimeout(250);
  const calendarOpen = () => page.getByRole("dialog").count();
  const before = await calendarOpen();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  if ((await calendarOpen()) >= before) throw new Error("Escape did not close the calendar");
  if ((await sheet.getByLabel("Trip name").count()) !== 1) throw new Error("Escape on the calendar closed the New trip sheet");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: /Join with a code/ }).click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("dialog").getByPlaceholder("Invite code").count()) !== 1) throw new Error("Join lost its code field");
  await page.keyboard.press("Escape");
  if ((await page.getByRole("link", { name: "Calendar view" }).getAttribute("href")) !== "/calendar") throw new Error("Calendar lost its route");
  if ((await page.getByRole("link", { name: /Plan with Béa/ }).getAttribute("href")) !== "/trips/plan") throw new Error("Plan with Béa lost its route");
}, "trips");

await flow("trips: draft refresh, discard and interrupted creation recovery", async (page) => {
  await page.getByRole("button", {name: "New trip", exact: true}).click();
  await page.getByLabel("Trip name", {exact: true}).fill("Kyoto spring draft");
  await page.getByRole("checkbox", {name: "Track a budget for this trip"}).check();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bea.trip-draft.me") ?? "null")?.draft.form.title === "Kyoto spring draft");
  await page.reload({waitUntil: "domcontentloaded", timeout: 30000});
  await page.getByRole("button", {name: "New trip", exact: true}).click();
  if (await page.getByLabel("Trip name", {exact: true}).inputValue() !== "Kyoto spring draft") throw new Error("Refresh lost the draft title");
  if (!await page.getByRole("checkbox", {name: "Track a budget for this trip"}).isChecked()) throw new Error("Refresh lost the budget choice");
  await page.getByRole("button", {name: "Clear draft", exact: true}).click();
  await page.waitForFunction(() => localStorage.getItem("bea.trip-draft.me") === null);
  if (await page.getByLabel("Trip name", {exact: true}).inputValue() !== "") throw new Error("Clear draft did not reset input");
  const stableId = "00000000-0000-4000-8000-000000000011";
  await page.evaluate((tripId) => {
    localStorage.setItem("bea.trip-draft.me", JSON.stringify({version:1,uid:"me",expiresAt:Date.now()+86400000,
      draft:{form:{title:"Recovered trip",city:"",country:"",start_date:"",end_date:"",dates_status:"tentative"},
        multiCity:false,cities:[],dayTrips:[],withBudget:false,packTemplateId:"",
        attempt:{ownerId:"me",tripId,stopIds:[]}}}));
  }, stableId);
  await page.reload({waitUntil: "domcontentloaded", timeout: 30000});
  await page.getByRole("button", {name: "New trip", exact: true}).click();
  if (!await page.getByLabel("Trip name", {exact: true}).isDisabled()) throw new Error("Interrupted payload is editable");
  await page.screenshot({path:join(out,`${previewTheme}-recovery-draft.png`),animations:"disabled"});
  const original = await page.evaluate(() => localStorage.getItem("bea.trip-draft.me"));
  await page.getByText("Recovery options",{exact:true}).click();
  await page.getByRole("button",{name:"Discard local recovery details",exact:true}).click();
  if (await page.getByLabel("Trip name",{exact:true}).isDisabled()) throw new Error("Discard left creation locked");
  await page.waitForFunction(() => localStorage.getItem("bea.trip-draft.me") === null);
  await page.evaluate(value => localStorage.setItem("bea.trip-draft.me",value), original);
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByRole("button", {name: "Retry creating this trip", exact: true}).click();
  await page.waitForFunction(() => localStorage.getItem("bea.trip-draft.me") === null);
  const tripWrites = (await writes(page)).filter(write => write.table === "trips" && write.op === "insert");
  if (tripWrites.length !== 1 || tripWrites[0].payload.id !== stableId) throw new Error("Recovery did not use the original trip ID");
}, "trips");

await flow("trips: partial packing copy retries without another list", async (page) => {
  const ids = Array.from({length: 4}, (_,i) => `00000000-0000-4000-8000-${String(i+20).padStart(12,"0")}`);
  await page.evaluate(([tripId, packId, a, b]) => {
    localStorage.setItem("bea.trip-draft.me", JSON.stringify({version:1,uid:"me",expiresAt:Date.now()+86400000,
      draft:{form:{title:"Packing recovery",city:"",country:"",start_date:"",end_date:"",dates_status:"tentative"},
        multiCity:false,cities:[],dayTrips:[],withBudget:false,packTemplateId:"old-template",
        attempt:{ownerId:"me",tripId,stopIds:[],packing:{ownerId:"me",id:packId,name:"Carry-on",emoji:"",
          items:[{id:a,label:"Raincoat",section:null,quantity:1},{id:b,label:"Socks",section:null,quantity:2}]}}}}));
  }, ids);
  await page.reload({waitUntil:"domcontentloaded", timeout:30000});
  await page.getByRole("button", {name:"New trip",exact:true}).click();
  await page.evaluate(() => {window.__failNextWrite = {table:"packing_items",afterCommit:false};});
  await page.getByRole("button", {name:"Retry creating this trip",exact:true}).click();
  await page.getByRole("alert").waitFor();
  const first = await writes(page);
  if (first.filter(w => w.table === "packing_lists" && w.op === "insert").length !== 1) throw new Error("Packing list was not created before the item failure");
  await page.getByRole("button", {name:"Retry creating this trip",exact:true}).click();
  await page.waitForFunction(() => localStorage.getItem("bea.trip-draft.me") === null);
  const retried = await writes(page);
  for (const table of ["trips", "packing_lists"]) if (retried.filter(w => w.table === table && w.op === "insert").length !== 1) throw new Error(`Retry duplicated ${table}`);
  const items = retried.filter(w => w.table === "packing_items" && w.op === "insert").flatMap(w => w.payload);
  if (items.length !== 2 || items[0].id !== ids[2] || items[1].id !== ids[3] || items[1].position !== 1) throw new Error("Retry lost original item IDs/order");
}, "trips");

await flow("trips: clearing a view query restores Upcoming", async (page) => {
  await page.evaluate(() => { const url = new URL(location.href);url.searchParams.set("view","past");history.pushState(null,"",url);dispatchEvent(new PopStateEvent("popstate")); });
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Past"));
  await page.evaluate(() => { const url = new URL(location.href);url.searchParams.delete("view");history.pushState(null,"",url);dispatchEvent(new PopStateEvent("popstate")); });
  await page.waitForFunction(() => document.querySelector('[role="tab"][aria-selected="true"]')?.textContent?.includes("Upcoming"));
}, "trips");

await flow("trips: date picker fits narrow phones and keeps 48px controls", async (page) => {
  for (const width of [320,390,768]) {
    await page.setViewportSize({width,height:844});
    await page.getByRole("button", {name:"New trip",exact:true}).click();
    await page.getByRole("dialog").getByRole("button", {name:/^(Dates|Mar)/}).click();
    const dialog = page.getByRole("dialog").last();
    const bounds = await dialog.evaluate(el => ({scroll:el.scrollWidth,width:el.clientWidth,viewport:innerWidth}));
    if (bounds.scroll > bounds.width + 1) throw new Error(`Date dialog overflows at ${width}px: ${JSON.stringify(bounds)}`);
    if (width < 416) {
      await dialog.getByLabel("Start date", {exact:true}).fill("2027-03-10");
      await dialog.getByLabel("End date", {exact:true}).fill("2027-03-12");
      if (width === 320) await page.screenshot({path:join(out,`${previewTheme}-date-picker.png`),animations:"disabled"});
    } else {
      const day = dialog.locator("button[data-day]").first();
      const rect = await day.boundingBox();
      if (rect.width < 48 || rect.height < 48) throw new Error("Calendar day is under 48px");
      for (const button of await dialog.locator("button.rdp-button_previous, button.rdp-button_next").all()) {
        const target = await button.boundingBox();
        if (target.width < 48 || target.height < 48) throw new Error("Month navigation is under 48px");
      }
    }
    await dialog.getByRole("button", {name:"Done",exact:true}).click();
    if (width < 416 && !(await page.getByRole("dialog").innerText()).includes("Mar")) throw new Error("Native dates did not update the range label");
    await page.keyboard.press("Escape");
  }
}, "trips");

await flow("trips: city removal and day-trip actions have 48px targets", async (page) => {
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByRole("radio",{name:"Several cities",exact:true}).click();
  await page.getByRole("button",{name:"Add another city",exact:true}).click();
  const removal = page.getByRole("button",{name:"Remove city 3",exact:true});
  let rect = await removal.boundingBox();
  if (rect.width < 48 || rect.height < 48) throw new Error("City removal is under 48px");
  await page.getByPlaceholder("City 1 — search it").fill("Kyoto");
  const dayTrip = page.getByRole("button",{name:"Day trip from Kyoto",exact:true});
  rect = await dayTrip.boundingBox();
  if (rect.width < 48 || rect.height < 48) throw new Error("Day-trip action is under 48px");
  await dayTrip.click();
  rect = await page.getByRole("button",{name:"Remove this day trip",exact:true}).boundingBox();
  if (rect.width < 48 || rect.height < 48) throw new Error("Day-trip removal is under 48px");
}, "trips");

await flow("trips: storage failure prevents creation and preserves an editable draft", async (page) => {
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByLabel("Trip name",{exact:true}).fill("Storage failure trip");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bea.trip-draft.me") ?? "null")?.draft.form.title === "Storage failure trip");
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key,value) {
      if (key === "bea.trip-draft.me" && JSON.parse(value).draft.attempt) throw new DOMException("Full","QuotaExceededError");
      return original.call(this,key,value);
    };
  });
  await page.getByRole("button",{name:"Create trip",exact:true}).click();
  await page.getByRole("alert").filter({hasText:/has not started creating/}).waitFor();
  if ((await writes(page)).some(w => w.table === "trips" && w.op === "insert")) throw new Error("Server writes started without a stored attempt");
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  if (await page.getByLabel("Trip name",{exact:true}).inputValue() !== "Storage failure trip") throw new Error("Failed snapshot erased editable input");
  await page.getByRole("button",{name:"Create trip",exact:true}).click();
  await page.waitForFunction(() => localStorage.getItem("bea.trip-draft.me") === null);
  if ((await writes(page)).filter(w => w.table === "trips" && w.op === "insert").length !== 1) throw new Error("Reload created more than one trip");
},"trips");

await flow("trips: untouched draft expiry and standalone choices survive reload", async (page) => {
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByRole("button",{name:"Confirmed dates",exact:true}).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bea.trip-draft.me") ?? "null")?.draft.form.dates_status === "confirmed");
  const first = await page.evaluate(() => localStorage.getItem("bea.trip-draft.me"));
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  if (await page.evaluate(() => localStorage.getItem("bea.trip-draft.me")) !== first) throw new Error("Opening extended draft expiry");
  await page.getByRole("radio",{name:"Several cities",exact:true}).click();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("bea.trip-draft.me") ?? "null")?.draft.multiCity === true);
  const second = await page.evaluate(() => localStorage.getItem("bea.trip-draft.me"));
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  if (await page.getByRole("radio",{name:"Several cities",exact:true}).getAttribute("aria-checked") !== "true") throw new Error("Reload lost multi-city mode");
  if (await page.evaluate(() => localStorage.getItem("bea.trip-draft.me")) !== second) throw new Error("Restoring mode extended expiry");
},"trips");

await flow("trips: failed cities still allow opening the saved trip", async (page) => {
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByLabel("Trip name",{exact:true}).fill("Saved trip, pending cities");
  await page.getByRole("radio",{name:"Several cities",exact:true}).click();
  await page.getByPlaceholder("City 1 — search it").fill("Kyoto");
  await page.getByPlaceholder("City 2 — search it").fill("Tokyo");
  await page.evaluate(() => {window.__failNextWrite = {table:"trip_stops",afterCommit:false};});
  await page.getByRole("button",{name:"Create trip",exact:true}).click();
  await page.getByText("Recovery options",{exact:true}).click();
  const tripId = await page.evaluate(() => JSON.parse(localStorage.getItem("bea.trip-draft.me")).draft.attempt.tripId);
  if (await page.getByRole("link",{name:"Open the saved trip",exact:true}).getAttribute("href") !== `/trips/${tripId}`) throw new Error("Recovery link does not open the confirmed trip");
  if ((await writes(page)).filter(w => w.table === "trips" && w.op === "insert").length !== 1) throw new Error("Opening recovery duplicated the trip");
},"trips");

await flow("trips: recovered city rows still receive background pinning", async (page) => {
  await page.getByRole("button",{name:"New trip",exact:true}).click();
  await page.getByLabel("Trip name",{exact:true}).fill("Recovered cities");
  await page.getByRole("radio",{name:"Several cities",exact:true}).click();
  await page.getByPlaceholder("City 1 — search it").fill("Kyoto");
  await page.getByPlaceholder("City 2 — search it").fill("Tokyo");
  await page.evaluate(() => {window.__failNextWrite = {table:"trip_stops",afterCommit:true};});
  await page.getByRole("button",{name:"Create trip",exact:true}).click();
  await page.waitForFunction(() => window.__cityPins?.some(rows => rows.some(row => row.city === "Kyoto")));
  const requests = await page.evaluate(() => window.__cityPins.flat());
  if (!requests.some(row => row.city === "Tokyo" && row.lat === null)) throw new Error("Committed city omitted from background pinning");
  if ((await writes(page)).filter(w => w.table === "trip_stops" && w.op === "insert").length !== 1) throw new Error("Recovery repeated a committed city insert");
},"trips");

await flow("home: trip ahead keeps its map, stats, search and ideas", async (page) => {
  const text = () => page.evaluate(() => document.body.innerText);
  for (const word of ["to-do", "packed", "Where to next?", "Suggested for your trip"])
    if (!(await text()).toLowerCase().includes(word.toLowerCase())) throw new Error(`Home lost "${word}"`);
  if ((await page.getByRole("link", { name: /Where to next/ }).getAttribute("href")) !== "/trips/plan") throw new Error("Where to next? lost its route");
  if ((await page.getByRole("link", { name: /Iconic Landmarks/ }).count()) !== 1) throw new Error("Suggested ideas are gone");
  // Customize home sits at the foot of Home: the trip modules from the
  // mockup switch on, reorder, and Reset brings back the first layout.
  await page.getByRole("button", { name: /^Customize home/ }).last().click();
  await page.waitForTimeout(400);
  for (const name of ["Saved for this trip", "Trip tools", "Weather there", "Notes from Béa", "Group plans", "Right now there", "Worth a detour"])
    await page.getByRole("switch", { name: `Show ${name}` }).click();
  await page.getByRole("button", { name: "Move Notes from Béa up" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
  const homeOrder = await page.evaluate(() => [...document.querySelectorAll("[data-guide^=home-module-]")].map((e) => e.getAttribute("data-guide")));
  const want = ["home-module-saved", "home-module-now", "home-module-group", "home-module-tools", "home-module-weather", "home-module-notes", "home-module-detour"];
  if (homeOrder.join() !== want.join()) throw new Error(`Home modules out of order: ${homeOrder.join()}`);
  for (const word of ["Currency", "Transport", "Translate", "Offline", "to go", "Griffith Observatory", "Live from Los Angeles"])
    if (!(await text()).includes(word)) throw new Error(`Home modules lost "${word}"`);
  if (!/\d+°[CF]/.test(await text())) throw new Error("the weather modules show no temperature");
  if ((await page.getByRole("link", { name: "Currency" }).getAttribute("href"))?.includes("menu=currency") !== true) throw new Error("Currency does not open the trip's converter");
  await page.getByRole("button", { name: /^Customize home/ }).last().click();
  await page.waitForTimeout(400);
  await page.getByRole("switch", { name: "Show Trips" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if ((await text()).includes("Upcoming trip")) throw new Error("Trips switch did not hide the trip");
  await page.getByRole("button", { name: /^Customize home/ }).last().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.keyboard.press("Escape");
}, "homepage");

await flow("home: on a trip shows the current and next stop under the route", async (page) => {
  const text = () => page.evaluate(() => document.body.innerText);
  for (const word of ["Paris to Berlin", "Current stop", "Museum Island", "Next stop", "Clärchens Ballhaus", "Day 3 · Today"])
    if (!(await text()).toLowerCase().includes(word.toLowerCase())) throw new Error(`On-trip Home lost "${word}"`);
  if (await page.getByText("Breakfast at Father Carpenter").count()) throw new Error("a stop already left is shown as current or next");
  if ((await page.getByRole("link", { name: /^Current stop: Museum Island/ }).count()) !== 1) throw new Error("the current stop is not a link");
  if ((await page.getByRole("link", { name: "Open Paris to Berlin" }).count()) !== 1) throw new Error("the trip arrow is gone");
}, "homepage-ontrip");

await flow("home: with no trip, saved cities wait on the map and in tiles", async (page) => {
  const text = () => page.evaluate(() => document.body.innerText);
  for (const word of ["Where to next?", "16 saved places", "3 cities", "Waiting for a trip", "8 places"])
    if (!(await text()).toLowerCase().includes(word.toLowerCase())) throw new Error(`No-trip Home lost "${word}"`);
  if ((await page.getByRole("link", { name: "Plan a trip" }).first().getAttribute("href")) !== "/trips/plan") throw new Error("Plan a trip lost its route");
  if ((await page.getByRole("link", { name: /^Lisbon: 8 saved places/ }).count()) !== 1) throw new Error("the Lisbon heart is not a link");
}, "homepage-none");

await flow("world: four views, filters, search, add sheet, bucket menu, stats options", async (page) => {
  const text = () => page.evaluate(() => document.body.innerText);
  const view = async (name) => { await page.getByRole("tab", { name, exact: true }).click(); await page.waitForTimeout(400); };
  for (const word of ["Your world.", "Cities", "Countries", "Add places"])
    if (!(await text()).includes(word)) throw new Error(`World lost "${word}"`);
  // Filters are toggles: tap once to narrow, again for everything.
  const cities = page.getByRole("button", { name: /^5 Cities$/ });
  await cities.click();
  if ((await cities.getAttribute("aria-pressed")) !== "true") throw new Error("the Cities filter did not turn on");
  await cities.click();
  if ((await cities.getAttribute("aria-pressed")) !== "false") throw new Error("the Cities filter did not turn off");
  // Search finds a city and spins to it.
  await page.getByRole("button", { name: "Search your world" }).click();
  await page.getByRole("textbox", { name: "Search your world" }).fill("lis");
  await page.getByRole("button", { name: "Lisbon Portugal", exact: true }).click();
  await page.waitForTimeout(400);
  // Customize world: "Add modules" opens the modules; a switch shows or hides
  // one, the arrows reorder them, and Reset restores the mockup's three.
  await page.getByRole("button", { name: "Add modules" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("switch", { name: "Show Globe filters" }).click();
  await page.getByRole("switch", { name: "Show Bucket list" }).click();
  await page.getByRole("switch", { name: "Show Notes from Béa" }).click();
  await page.getByRole("switch", { name: "Show Your travel lists" }).click();
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Move Notes from Béa up" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if ((await page.getByRole("group", { name: "Show on the map" }).count()) !== 0) throw new Error("Globe filters did not hide");
  if ((await text()).toLowerCase().includes("next time") === false) throw new Error("Your travel lists did not show on the Map");
  const order = await page.evaluate(() => [...document.querySelectorAll("[data-guide^=world-module-]")].map((e) => e.getAttribute("data-guide")));
  if (order.join() !== "world-module-notes,world-module-bucket") throw new Error(`modules out of order: ${order.join()}`);
  if (!(await text()).includes("so far.")) throw new Error("Notes from Béa says nothing");
  await page.getByRole("button", { name: "Bucket list: Open the bucket list" }).click();
  await page.waitForTimeout(400);
  if ((await page.getByRole("tab", { name: "Bucket list", exact: true }).getAttribute("aria-selected")) !== "true") throw new Error("the Bucket list module did not open its view");
  await view("Map");
  await page.getByRole("button", { name: "Add modules" }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.waitForTimeout(300);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  if ((await page.getByRole("group", { name: "Show on the map" }).count()) !== 1) throw new Error("Reset did not bring Globe filters back");
  // The globe wears terrain and its controls still work.
  await page.locator("[data-guide=globe] canvas").waitFor({ state: "attached" });
  for (const name of ["Zoom in", "Zoom out", "Reset the view"]) await page.getByRole("button", { name }).first().click();
  await page.waitForTimeout(300);
  if ((await page.locator("[data-guide=globe] canvas").count()) !== 1) throw new Error("the globe lost its terrain");
  // The add sheet opens from the globe button and closes with Escape.
  await page.getByRole("button", { name: "Add a city or country" }).click();
  await page.waitForTimeout(400);
  if ((await page.getByRole("dialog").count()) < 1) throw new Error("Add places did not open");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  // Bucket list: every row keeps its menu.
  await view("Bucket list");
  for (const word of ["Dream now, pin later.", "New Zealand", "Morocco", "Help me choose"])
    if (!(await text()).includes(word)) throw new Error(`Bucket list lost "${word}"`);
  await page.getByRole("button", { name: "More for New Zealand" }).click();
  for (const word of ["Open in Recs", "Been there"])
    if (!(await text()).includes(word)) throw new Error(`the bucket row menu lost "${word}"`);
  await page.getByRole("button", { name: "Compare places" }).click();
  if (!(await text()).toLowerCase().includes("what matters to you")) throw new Error("Help me choose did not open");
  // Been there: city chips are on the page and spin the globe.
  await view("Been there");
  if (!(await text()).includes("Where you've been")) throw new Error("Been there lost its list");
  await page.getByRole("button", { name: "Paris", exact: true }).click();
  await page.waitForTimeout(400);
  if ((await page.getByRole("tab", { name: "Map", exact: true }).getAttribute("aria-selected")) !== "true") throw new Error("a city chip did not return to the Map");
  if (!(await text()).toLowerCase().includes("you've been here")) throw new Error("a city chip did not select the city");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  if ((await text()).toLowerCase().includes("you've been here")) throw new Error("Close did not clear the city card");
  // Stats: the options sheet and the note.
  await view("Stats");
  await page.getByRole("button", { name: "What these numbers count" }).click();
  if (!(await text()).includes("These stats only include data")) throw new Error("the stats note did not open");
  await page.getByRole("button", { name: "Choose stats" }).click();
  for (const word of ["Countries as a world share", "Reset to default"])
    if (!(await text()).includes(word)) throw new Error(`Choose stats lost "${word}"`);
  await page.getByRole("button", { name: "Reset to default" }).click();
  await page.getByRole("button", { name: "Travel statistics" }).click();
  if ((await text()).includes("Choose stats")) throw new Error("Travel statistics did not collapse");
  await page.getByRole("button", { name: "Travel statistics" }).click();
  if ((await page.getByRole("button", { name: /^Bucket list/ }).count()) !== 1) throw new Error("the Bucket list tile is gone");
}, "world");

await flow("recs: header, pills, list chips, saved-for-trip cards, More ways and Add to a day", async (page) => {
  const text = async () => page.locator("body").innerText();
  for (const word of ["Places worth keeping.", "Add place", "Nearby map", "More ways", "Recently saved", "Explore nearby"])
    if (!(await text()).includes(word)) throw new Error(`Recs lost "${word}"`);
  await page.getByRole("button", { name: /^Wishlist/ }).click();
  if (await page.getByRole("button", { name: /^Wishlist/ }).getAttribute("aria-pressed") !== "true") throw new Error("the Wishlist chip did not apply");
  await page.getByRole("button", { name: /^All/ }).click();
  if (!(await text()).includes("Saved for ")) throw new Error("no Saved for the next trip's city");
  await page.getByRole("button", { name: "Add to a day" }).first().click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("dialog").count()) === 0) throw new Error("Add to a day opened nothing");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /More ways/ }).click();
  for (const word of ["From my trips", "I'm here now", "By hand", "Paste a list", "Send places", "Open a share", "Pin somewhere nearby"])
    if (!(await text()).includes(word)) throw new Error(`More ways lost "${word}"`);
}, "recs");

await flow("you: header, Béa card, grouped rows, Customize Home, theme and More", async (page) => {
  const text = async () => page.locator("body").innerText();
  for (const word of ["Travel, your way.", "Your Béa", "Travel preferences", "Packing lists", "Photos & memories", "Work travel", "Trip documents", "Settings & storage", "Appearance", "Data & imports", "Privacy & legal", "Help & FAQ", "Feedback", "About Béa", "Sign out"])
    if (!(await text()).includes(word)) throw new Error(`You lost "${word}"`);
  if ((await page.getByRole("link", { name: /Your Béa/ }).getAttribute("href")) !== "/profile/bea") throw new Error("Your Béa lost its route");
  await page.getByRole("button", { name: /Appearance/ }).click();
  await page.getByRole("dialog").getByText("Theme", { exact: true }).waitFor();
  await page.getByRole("button", { name: /Customize home/ }).first().click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("dialog").count()) === 0) throw new Error("Customize home opened nothing");
  await page.keyboard.press("Escape");
}, "you");

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
  await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Home", exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator("header").getByRole("link").first().click();
  await page.waitForTimeout(400);
  const search = page.getByRole("link", { name: "Search your places", exact: true });
  if (new URL(await search.getAttribute("href"), "https://preview.test").pathname !== "/recommendations") throw new Error("Home search lost its route");
  await search.click();
  await page.waitForTimeout(400);
  await page.goBack({ waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(400);
  if (await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Home", exact: true }).getAttribute("aria-current") !== "page") throw new Error("history back did not return Home");
  await page.setViewportSize({ width: 760, height: 900 });
  await page.locator("header").getByRole("link", { name: /Béa, version/ }).click();
  await page.locator("header").getByRole("link", { name: /Béa, version/ }).waitFor({ state: "visible" });
  if (await page.getByText("Travel Buddy", { exact: true }).count() !== 0) throw new Error("the wordmark caption came back");
  await page.setViewportSize({ width: 414, height: 900 });
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("button", { name: /Help for this page/ }).click();
  await page.waitForTimeout(300);
  if (await page.getByRole("dialog").count() !== 1) throw new Error("the page guide did not open");
  await page.keyboard.press("Escape");
  await page.context().setOffline(true);
  if (await page.getByRole("status").filter({ hasText: "You're offline" }).count() !== 1) throw new Error("the offline explanation disappeared");
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page.getByRole("img", { name: "Offline", exact: true }).waitFor();
  if (await page.getByRole("img", { name: "Offline", exact: true }).count() !== 1) throw new Error("the offline indicator disappeared");
  await page.getByRole("button", { name: /Close menu/i }).click();
  await page.context().setOffline(false);
}, "shell");

await flow("shell: phone widths and larger reading text keep labels and tap targets", async (page) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.documentElement.style.setProperty("--text-scale", "1.35"));
    const problems = await page.evaluate(() => {
      const visible = (el) => el.getClientRects().length > 0;
      const small = [...document.querySelectorAll("header span, h1, p, [role=radio], nav a span")].filter(visible).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13);
      const short = [...document.querySelectorAll("header a, header button, nav a, [role=radio]")].filter(visible).filter((el) => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44);
      return { small: small.map((el) => el.textContent), short: short.map((el) => el.textContent || el.getAttribute("aria-label")), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    if (problems.small.length || problems.short.length || problems.overflow) throw new Error(`${width}px: ${JSON.stringify(problems)}`);
    const version = page.locator("header span").filter({ hasText: /^v\d+\.\d+\.\d+$/ });
    if (await version.isVisible() !== (width >= 390)) throw new Error(`${width}px: version visibility changed`);
  }
}, "shell");

await flow("shell: short pages stay stable and moderate overflow still compresses", async (page) => {
  for (const width of [320, 390]) for (const scale of [1, 1.35]) for (const overflow of [50, 300]) {
    await page.setViewportSize({ width, height: 1400 });
    await page.evaluate((scale) => {
      document.documentElement.style.setProperty("--text-scale", String(scale));
      document.querySelector("main").scrollTop = 0;
      document.querySelector("[data-preview-spacer]").style.height = "1100px";
    }, scale);
    await page.waitForTimeout(250);
    const range = await page.evaluate((overflow) => {
      const main = document.querySelector("main");
      const spacer = document.querySelector("[data-preview-spacer]");
      spacer.style.height = "0px";
      const style = getComputedStyle(main);
      spacer.style.height = `${main.clientHeight + overflow - main.firstElementChild.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)}px`;
      window.__compressionChanges = [];
      window.__compressionObserver?.disconnect();
      window.__compressionObserver = new MutationObserver((mutations) => window.__compressionChanges.push(...mutations.map((m) => m.oldValue)));
      window.__compressionObserver.observe(document.querySelector("[data-compressed]") ?? document.querySelector("h1").closest(".group"), { attributes: true, attributeFilter: ["data-compressed"], attributeOldValue: true });
      main.scrollTop = overflow;
      return main.scrollHeight - main.clientHeight;
    }, overflow);
    if (Math.abs(range - overflow) > 1) throw new Error(`scroll fixture has ${range}px overflow`);
    await page.waitForTimeout(1000);
    const changes = await page.evaluate(() => window.__compressionChanges);
    const compressed = await page.locator("[data-compressed]").count();
    if (overflow === 50 ? changes.length || compressed : changes.length !== 1 || compressed !== 1) throw new Error(`${width}px at ${scale}, ${overflow}px overflow: header toggled ${changes.length} times, compressed=${compressed}`);
  }
}, "shell");

await flow("shell: a null account accent resets visually without storing or uploading Pink", async (page) => {
  await chooseAccent(page, "Periwinkle");
  await page.waitForTimeout(900);
  await page.goto("https://preview.test/?sample=shell&reset-accent=yes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => ({ accent: document.documentElement.dataset.accent, stored: localStorage.getItem("bea-accent"), uploaded: window.__writes.some((w) => w.table === "profiles" && w.payload?.accent === "pink") }));
  if (result.accent !== "pink" || result.stored !== null || result.uploaded) throw new Error(`account accent reset: ${JSON.stringify(result)}`);
}, "shell");

await flow("shell: header actions are named icon buttons at least 48px", async (page) => {
  for (const [role, name] of [["link", "Search your places"], ["button", "Menu"]]) {
    const el = page.getByRole(role, { name, exact: true });
    const box = await el.boundingBox();
    if (!box || box.width < 48 || box.height < 48) throw new Error(`${name} is ${box?.width}x${box?.height}`);
    if (!(await el.locator("svg").count())) throw new Error(`${name} has no icon`);
  }
}, "shell");

await flow("shell: the main bar shows an icon and a label per tab, 48px tall, one current", async (page) => {
  const links = page.locator('nav[aria-label="Main"] a');
  if ((await links.count()) !== 5) throw new Error(`expected 5 tabs, found ${await links.count()}`);
  for (let i = 0; i < 5; i++) {
    const link = links.nth(i);
    const box = await link.boundingBox();
    if (!box || box.height < 48) throw new Error(`tab ${i} is ${box?.height}px tall`);
    if (!(await link.locator("svg").first().isVisible())) throw new Error(`tab ${i} shows no icon`);
    if (!(await link.innerText()).trim()) throw new Error(`tab ${i} has no label`);
  }
  if ((await page.locator('nav[aria-label="Main"] a[aria-current="page"]').count()) !== 1) throw new Error("not exactly one current tab");
  if ((await page.locator('nav[aria-label="Main"] > div > span[aria-hidden]').count()) !== 0) throw new Error("the travelling indicator is still there");
  const blur = await page.locator('nav[aria-label="Main"]').evaluate((el) => getComputedStyle(el).backdropFilter);
  if (blur !== "none") throw new Error(`the bar still blurs: ${blur}`);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.evaluate(() => document.documentElement.style.setProperty("--text-scale", "1.45"));
  await page.waitForTimeout(250);
  const clipped = await links.evaluateAll((els) => els.filter((a) => a.querySelector("span").scrollWidth > a.clientWidth + 1).map((a) => a.textContent));
  if (clipped.length) throw new Error(`labels wider than their tab at 320px and 1.45x: ${clipped.join(", ")}`);
}, "shell");

await flow("shell: buttons are 8px, flat and sentence case; round icon buttons stay round", async (page) => {
  const read = (k) => page.locator(`[data-k="${k}"]`).evaluate((el) => {
    const css = getComputedStyle(el);
    return { radius: css.borderTopLeftRadius, shadow: css.boxShadow, image: css.backgroundImage, upper: css.textTransform, tracking: css.letterSpacing, height: el.getBoundingClientRect().height };
  });
  for (const k of ["default", "secondary", "destructive", "raw", "pill"]) {
    const b = await read(k);
    if (b.radius !== "8px") throw new Error(`${k} radius is ${b.radius}`);
    if (b.shadow !== "none") throw new Error(`${k} has a shadow: ${b.shadow}`);
    if (b.image !== "none") throw new Error(`${k} has a background image`);
    if (b.upper !== "none") throw new Error(`${k} is ${b.upper}`);
    if (b.tracking !== "normal" && b.tracking !== "0px") throw new Error(`${k} tracking is ${b.tracking}`);
  }
  for (const k of ["default", "secondary", "destructive"]) if ((await read(k)).height < 48) throw new Error(`${k} is under 48px`);
  const round = await read("round");
  if (parseFloat(round.radius) < 16) throw new Error(`the round icon button lost its shape: ${round.radius}`);
}, "buttons");

await flow("shell: text fields are 52px with a 3:1 edge and a 16px value", async (page) => {
  const input = page.locator('input[type="email"]').first();
  const m = await input.evaluate((el) => {
    const css = getComputedStyle(el);
    const label = el.id ? document.querySelector(`label[for="${el.id}"]`) : null;
    return { height: el.getBoundingClientRect().height, border: css.borderTopColor, radius: css.borderTopLeftRadius, size: css.fontSize, label: label ? getComputedStyle(label).fontSize : null };
  });
  if (m.height < 52) throw new Error(`field height ${m.height}`);
  if (m.border !== "rgb(138, 132, 126)") throw new Error(`field edge is ${m.border}, not --field-border`);
  if (m.radius !== "8px") throw new Error(`field radius ${m.radius}`);
  if (m.size !== "16px") throw new Error(`field text is ${m.size}`);
  if (m.label !== "14px") throw new Error(`field label is ${m.label}`);
}, "page-forgot");

await flow("shell: the sign-in fields are 8px, flat boxes with a 3:1 edge", async (page) => {
  const box = await page.locator('input[type="email"]').first().evaluate((el) => {
    const css = getComputedStyle(el.parentElement);
    return { radius: css.borderTopLeftRadius, shadow: css.boxShadow, border: css.borderTopColor, height: el.parentElement.getBoundingClientRect().height };
  });
  if (box.radius !== "8px") throw new Error(`sign-in field radius ${box.radius}`);
  if (box.shadow !== "none") throw new Error(`sign-in field has a shadow`);
  if (box.border !== "rgb(138, 132, 126)") throw new Error(`sign-in field edge ${box.border}`);
  if (box.height < 52) throw new Error(`sign-in field height ${box.height}`);
}, "auth");

await flow("shell: switches have a 48px target and a visible edge when off", async (page) => {
  const box = await page.locator('[data-k="switch"]').boundingBox();
  if (!box || box.width < 48 || box.height < 48) throw new Error(`switch is ${box?.width}x${box?.height}`);
}, "buttons");

await flow("shell: the Menu lists rows with a 16px title, a 14px muted note and a hairline", async (page) => {
  await page.getByRole("button", { name: "Menu", exact: true }).click();
  const row = page.locator(".menu-row").first();
  await row.waitFor();
  const m = await row.evaluate((el) => {
    const title = getComputedStyle(el.querySelector(".menu-row-title"));
    const note = getComputedStyle(el.querySelector(".menu-row-note"));
    return { titleSize: title.fontSize, noteSize: note.fontSize, titleColor: title.color, noteColor: note.color, height: el.getBoundingClientRect().height, rule: getComputedStyle(el).borderBottomWidth };
  });
  if (m.titleSize !== "16px") throw new Error(`row title is ${m.titleSize}`);
  if (m.noteSize !== "14px") throw new Error(`row note is ${m.noteSize}`);
  if (m.noteColor === m.titleColor) throw new Error("the note is not muted");
  if (m.height < 56) throw new Error(`row is ${m.height}px tall`);
  if (m.rule !== "1px") throw new Error(`row rule is ${m.rule}`);
  const titleSize = await page.locator(".sub-page-title").first().evaluate((el) => getComputedStyle(el).fontSize);
  if (titleSize !== "28px") throw new Error(`page title is ${titleSize}`);
  await page.keyboard.press("Escape");
  if (await page.locator(".menu-row").count()) throw new Error("Escape did not close the Menu");
}, "shell");

await flow("shell: compressed long titles stay on one line in both header layouts", async (page) => {
  const title = "Places worth remembering on a long journey through several cities.";
  for (const beside of [false, true]) {
    await page.goto(`https://preview.test/?sample=shell&path=%2Fprofile&title=${encodeURIComponent(title)}${beside ? "&beside=yes" : ""}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1, name: title }).waitFor();
    for (const scale of [1, 1.35]) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate((scale) => {
        document.documentElement.style.setProperty("--text-scale", String(scale));
        document.querySelector("main").scrollTop = 0;
      }, scale);
      await page.waitForTimeout(250);
      const expanded = await page.locator("h1").boundingBox();
      await page.locator("main").evaluate((el) => el.scrollTop = el.scrollHeight);
      await page.locator("[data-compressed]").waitFor();
      await page.waitForTimeout(300);
      const compact = await page.locator("h1").evaluate((el) => {
        const css = getComputedStyle(el);
        return { height: el.getBoundingClientRect().height, lineHeight: parseFloat(css.lineHeight), whiteSpace: css.whiteSpace, ellipsis: css.textOverflow, overflow: el.scrollWidth > el.clientWidth, text: el.textContent };
      });
      if (compact.height > compact.lineHeight + 1 || compact.whiteSpace !== "nowrap" || compact.ellipsis !== "ellipsis" || !compact.overflow || compact.text !== title || compact.height >= expanded.height) throw new Error(`long-title layout: ${JSON.stringify(compact)}`);
    }
  }
}, "shell");

await flow("shell: text tokens cover hover, opacity, sequence and dark error contrast", async (page) => {
  let previousSearchTint;
  for (const accent of ["Pink", "Periwinkle"]) {
    await chooseAccent(page, accent);
    await page.evaluate(() => {
      document.querySelector("[data-color-probes]")?.remove();
      const probes = document.createElement("div");
      probes.dataset.colorProbes = "";
      probes.className = "bg-elevated";
      for (const cls of ["text-primary", "text-primary/85", "text-foreground hover:text-primary", "text-destructive", "text-muted-foreground", "seq-text-1", "seq-1"]) {
        const el = document.createElement("p");
        el.className = cls;
        el.textContent = cls;
        probes.append(el);
      }
      const map = document.createElement("div");
      map.className = "journal-map";
      for (const tone of ["", "journal-pin--nested", "journal-pin--food", "journal-pin--transit", "journal-pin--stay", "journal-pin--done"]) for (const selected of ["", "journal-pin--on"]) {
        const pin = document.createElement("p");
        pin.className = `journal-pin ${tone} ${selected}`;
        pin.textContent = "1";
        map.append(pin);
      }
      probes.append(map);
      const search = document.createElement("span");
      search.dataset.searchTint = "";
      search.style.backgroundColor = "var(--home-search)";
      probes.append(search);
      document.querySelector("main").prepend(probes);
    });
    await page.addStyleTag({ content: "[data-color-probes] p { transition: none !important; }" });
    await page.locator("[data-color-probes] p").nth(2).hover();
    // Wait for :hover to actually repaint the probe before reading colours —
    // under parallel load the hover can lag the getComputedStyle read, which
    // otherwise reports the un-hovered colour. A real token miss still fails
    // here (the wait times out and throws), it just stops flaking.
    const measurements = await page.waitForFunction(() => {
      const ps = document.querySelectorAll("[data-color-probes] p");
      if (ps.length <= 2 || !ps[2].matches(":hover") || getComputedStyle(ps[0]).color !== getComputedStyle(ps[2]).color) return false;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgb = (ink, ground) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = (rgb) => rgb.map((c) => c / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
      const ground = getComputedStyle(document.querySelector("[data-color-probes]")).backgroundColor;
      const b = lum(rgb(ground, ground));
      return [...document.querySelectorAll("[data-color-probes] p")].map((el) => {
        const color = getComputedStyle(el).color;
        const ownBackground = getComputedStyle(el).backgroundColor;
        const surface = ownBackground === "rgba(0, 0, 0, 0)" ? ground : ownBackground;
        const bg = ownBackground === "rgba(0, 0, 0, 0)" ? b : lum(rgb(surface, ground));
        const f = lum(rgb(color, surface));
        return { cls: el.className, ratio: (Math.max(bg, f) + 0.05) / (Math.min(bg, f) + 0.05), color };
      });
    });
    const results = await measurements.jsonValue();
    await measurements.dispose();
    const bad = results.filter((r) => r.ratio < 4.5);
    if (bad.length) throw new Error(`${accent} text contrast: ${JSON.stringify(bad)}`);
    if (results[0].color !== results[2].color) throw new Error("hover:text-primary missed the text token");
    const searchTint = await page.locator("[data-search-tint]").evaluate((el) => getComputedStyle(el).backgroundColor);
    // Colorful is white with neon on pills now, so the search box is no longer tinted by the accent.
    if (!searchTint || searchTint === "rgba(0, 0, 0, 0)") throw new Error("the search probe lost its background");
    previousSearchTint = searchTint;
    console.log(`  ${accent} text contrast: ${results.map((r) => `${r.cls}=${r.ratio.toFixed(2)}`).join(", ")}`);
  }
}, "shell");

await flow("trip shell: four views, device positions and sticky bars keep the main navigation clear", async (page) => {
  await page.goto("https://preview.test/?sample=default&frame=yes&path=/trips/t1");
  const bar = page.getByRole("tablist", { name: "How to look at this trip" });
  await bar.waitFor();
  if (JSON.stringify(await tabNames(page)) !== JSON.stringify(["Overview", "Map", "Timeline"])) throw new Error("wrong trip views");
  for (const position of ["top", "bottom", "side"]) {
    await page.getByRole("button", { name: "Trip menu", exact: true }).click();
    await page.getByRole("button", { name: /Customize view/ }).click();
    await page.getByRole("group", { name: "Views bar position" }).getByRole("button", { name: new RegExp(`^${position}$`, "i") }).click();
    await page.getByRole("button", { name: "Close the trip menu" }).click();
    if (await page.evaluate(() => localStorage.getItem("bea-trip-tabs")) !== position) throw new Error("position did not save");
    if ((await writes(page)).some((w) => w.payload?.patch?.tripTabs)) throw new Error("device position uploaded to account");
    await page.reload();
    await page.locator(`[data-trip-bar="${position}"]`).waitFor();
    for (const name of ["Overview", "Map", "Timeline"]) await goTab(page, name);
    await page.locator('[data-scroll-restoration-id="app-main"]').evaluate((el) => { el.scrollTop = 700; });
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const r = document.querySelector("[data-trip-bar]").getBoundingClientRect();
      const main = document.querySelector('[data-scroll-restoration-id="app-main"]').getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Main"]').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, mainTop: main.top, navTop: nav.top, width: innerWidth };
    });
    if (geometry.bottom > geometry.navTop || geometry.left < 0 || geometry.right > geometry.width || geometry.top < geometry.mainTop - 1) throw new Error(`${position} bad bounds: ${JSON.stringify(geometry)}`);
  }
  if ((await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link").count()) !== 5) throw new Error("lost global tabs");
});

await flow("trip shell: Bookings stays inside Overview with filters and booking saves", async (page) => {
  await goTab(page, "Overview");
  await page.getByRole("button", { name: /^Booked ·/ }).click();
  const bookings = page.getByRole("region", { name: "Bookings", exact: true });
  await bookings.waitFor();
  for (const name of ["Flights", "Stays", "Transport", "Activities", "All"]) await bookings.getByRole("button", { name, exact: true }).click();
  if (await page.getByRole("tab", { name: "Bookings", exact: true }).count()) throw new Error("Bookings is still a fifth view");
  await page.getByRole("button", { name: /close bookings/i }).click();
  await page.getByRole("button", { name: "Trip menu", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Bookings/ }).click();
  if (await page.getByRole("tab", { name: "Overview", exact: true }).getAttribute("aria-selected") !== "true") throw new Error("menu booking did not open Overview");
  if (await bookings.getByRole("button", { name: "All", exact: true }).getAttribute("aria-pressed") !== "true") throw new Error("Bookings from the menu did not open on All");
  await page.evaluate(() => localStorage.setItem("bea-trip-page-t1", JSON.stringify({ perspective: "bookings" })));
  await page.reload();
  await page.waitForTimeout(500);
  if (await page.getByRole("tab", { name: "Overview", exact: true }).getAttribute("aria-selected") !== "true" || !await bookings.getByRole("button", { name: "All", exact: true }).isVisible()) throw new Error("legacy booking preference was lost");
});

await flow("trip shell: day tracker opens a stop from every day view", async (page) => {
  for (const name of ["Companion", "Map", "Timeline"]) {
    await goTab(page, name);
    const day = page.getByRole("tab", { name: /Day 1/ });
    if (await day.count()) await day.first().click();
    const tracker = page.getByRole("region", { name: "Today's progress" });
    await tracker.getByRole("button").first().click();
    await page.getByRole("button", { name: "Back to now" }).waitFor();
    await page.getByRole("button", { name: "Back to now" }).click();
  }
});

await flow("booking: mark booked with a reference", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: /tap to edit$/ }).first().click();
  await page.getByRole("button", { name: /^Booking for / }).first().click();
  await page.getByRole("switch").first().click();
  await page.getByPlaceholder("Confirmation or ticket number").fill("MBAM-4471");
  await page.getByRole("button", { name: "Save booking" }).click();
  await page.waitForTimeout(400);
  const w = (await writes(page)).find((x) => x.op === "update" && x.payload?.booking_ref === "MBAM-4471");
  if (!w || w.payload.booked !== true) throw new Error("no booked update with the reference was written");
  if ((await page.getByText(/✓ Booked · MBAM-4471/).count()) === 0) throw new Error("card back shows no booking");
  await page.getByRole("button", { name: /^Close / }).first().click();
  const bookedCard = page.getByRole("button", { name: /tap to edit$/ }).first().locator("xpath=ancestor::li[1]");
  if ((await bookedCard.getByText("Booked", { exact: true }).count()) === 0) throw new Error("card front shows no Booked mark");
});

await flow("saved places: add one to the chosen day", async (page) => {
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.getByRole("button", { name: /Add stop/ }).first().click();
  await page.getByRole("button", { name: /^From Saved/ }).click();
  await page.locator("li", { hasText: "Nagata-ya" }).getByRole("button").click();
  await page.waitForTimeout(400);
  const w = (await writes(page)).find((x) => x.table === "itinerary_items" && x.op === "insert");
  if (!w) throw new Error("nothing was added to the itinerary");
  if (w.payload.day_date !== "2026-10-07") throw new Error(`added to ${w.payload.day_date}, not the chosen day`);
  const added = page.locator("li", { hasText: "Nagata-ya" }).getByRole("button", { name: "Added", exact: true });
  if (!await added.isDisabled()) throw new Error("Added did not retain its disabled state");
  const green = await added.evaluate((el) => {
    const probe = document.createElement("span");
    probe.className = "text-nexttime";
    el.parentElement.append(probe);
    const matches = getComputedStyle(el).color === getComputedStyle(probe).color;
    probe.remove();
    return matches;
  });
  if (!green) throw new Error("text-primary overrides disabled:text-nexttime on Added");
});

await flow("trip actions: To do, Add stop to the itinerary, Offline and Customize in Settings", async (page) => {
  if ((await page.getByRole("tab", { name: "Trip", exact: true }).count()) !== 0) throw new Error("the Trip tab is still there");
  if ((await page.getByRole("button", { name: "Optimize route" }).count()) !== 0) throw new Error("Optimize route is still in the bar");
  if ((await page.getByRole("button", { name: /^To do$/ }).count()) === 0) throw new Error("no To do button");
  await page.getByRole("button", { name: /Add stop/ }).first().click();
  await page.getByRole("button", { name: /^A stop on the itinerary/ }).click();
  await page.waitForTimeout(500);
  if ((await page.getByRole("tab", { name: "Timeline", exact: true }).getAttribute("aria-selected")) !== "true")
    throw new Error("Add stop did not open the Timeline");
  if ((await page.getByText("Add to the timeline").count()) === 0) throw new Error("Add stop did not open the add form");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Trip menu", exact: true }).first().click();
  await page.waitForTimeout(400);
  for (const label of ["Offline maps", "Destinations", "Customize view"]) {
    if ((await page.getByRole("button", { name: new RegExp(label) }).count()) === 0) throw new Error(`Settings has no ${label}`);
  }
  await page.getByRole("button", { name: /Customize view/ }).click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("switch").count()) === 0) throw new Error("Customize switches missing in Settings");
});

await flow("trip header: every action is on screen at 390px, with the back button", async (page) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const names = [/^Go back/, /^Plan with Béa$/, /^Add stop$/, /^To do$/, /^Trip menu$/, /^Menu$/];
  for (const name of names) {
    const button = page.locator("header").getByRole(/Go back/.test(String(name)) ? "link" : "button", { name }).first();
    const box = await button.boundingBox();
    if (!box) throw new Error(`${name} is not in the header`);
    if (box.x < 0 || box.x + box.width > 390) throw new Error(`${name} is cut off (x ${Math.round(box.x)}, width ${Math.round(box.width)})`);
  }
  const slot = await page.locator("#app-header-slot").evaluate((el) => ({ scroll: el.scrollWidth, width: el.clientWidth }));
  if (slot.scroll > slot.width + 1) throw new Error(`header actions scroll sideways (${slot.scroll} > ${slot.width})`);
  // Room for the "pins to check" button (44px and a 6px gap) when that setting is on.
  const used = await page.locator("#app-header-slot > div").evaluate((row) =>
    [...row.children].reduce((sum, group) => sum + group.getBoundingClientRect().width, 0) + 6,
  );
  if (used + 50 > slot.width) throw new Error(`no room for pins to check (${Math.round(used)} + 50 > ${slot.width})`);
}, "default&path=/trips/demo");

await flow("locate on map: opens Map Split on that stop", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: /Peace Memorial Museum.*tap to edit$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Locate Peace Memorial Museum on the map", exact: true }).click();
  await page.waitForTimeout(700);
  const on = await page.getByRole("tab", { name: "Map", exact: true }).getAttribute("aria-selected");
  if (on !== "true") throw new Error("Map Split did not open");
  if ((await page.getByRole("button", { name: /Peace Memorial Museum|09:30/, pressed: true }).count()) === 0)
    throw new Error("the located stop is not the one selected");
});

await flow("companion: pick a day from the prompt itself", async (page) => {
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /All days|Whole trip/i }).first().click();
  await page.waitForTimeout(300);
  if ((await page.getByText("Pick a day to follow.").count()) === 0) throw new Error("no prompt on Whole trip");
  const days = page.getByRole("group", { name: "Day to follow" }).getByRole("button");
  if ((await days.count()) < 2) throw new Error("the prompt offers fewer than two days");
  await days.first().click();
  await page.waitForTimeout(400);
  if ((await page.getByText("Pick a day to follow.").count()) > 0) throw new Error("picking a day left the prompt up");
  if ((await page.getByRole("tab", { name: /Day 1/, selected: true }).count()) === 0)
    throw new Error("the day strip does not show the picked day");
});

await flow("companion: live day picker supports keyboard switching and All days", async (page) => {
  await goTab(page, "Companion");
  const day1 = page.getByRole("tab", { name: /Day 1/ }).first();
  await day1.waitFor({ state: "visible" });
  await day1.focus();
  await page.keyboard.press("ArrowRight");
  await page.getByRole("tab", { name: /Day 2/, selected: true }).first().waitFor();
  await page.keyboard.press("Home");
  await page.getByRole("tab", { name: "All days", selected: true }).first().waitFor();
  await page.getByText("Pick a day to follow.").waitFor();
});

await flow("companion: restored All days and city changes keep following today", async (page) => {
  await page.clock.setFixedTime(new Date("2026-10-07T10:30:00"));
  await page.evaluate(() => localStorage.setItem("bea-trip-page-t1", JSON.stringify({perspective:"companion",day:"__all__"})));
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button", {name:"Companion",exact:true,pressed:true}).waitFor();
  if (await page.getByText("Pick a day to follow.").count()) throw new Error("Restoring All days stopped automatic today-following");
  await page.getByRole("tab", {name:"All days",exact:true}).first().click();
  await page.getByText("Pick a day to follow.").waitFor();
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button", {name:"Companion",exact:true,pressed:true}).waitFor();
  if (await page.getByText("Pick a day to follow.").count()) throw new Error("An in-session opt-out persisted across reload");
  await page.getByRole("tab",{name:"Timeline",exact:true}).click();
  const all = page.getByRole("tab",{name:"All days",exact:true});
  if (await all.count()) await all.first().click();
  await page.getByRole("tab",{name:"Map",exact:true}).click();
  await page.getByRole("button",{name:"Companion",exact:true}).click();
  if (await page.getByText("Pick a day to follow.").count()) throw new Error("Timeline's All days stopped Companion following today");
  await page.evaluate(() => {const url = new URL(location.href);url.searchParams.set("route","1");history.replaceState(null,"",url);});
  await page.reload({waitUntil:"domcontentloaded",timeout:30000});
  await page.getByRole("button",{name:"Companion",exact:true,pressed:true}).waitFor();
  await page.getByRole("tab",{name:"All days",exact:true}).first().click();
  await page.getByText("Pick a day to follow.").waitFor();
  await page.locator('select:has(option[value="r1"])').selectOption("r1");
  await page.locator('select:has(option[value="r1"])').selectOption("");
  if (await page.getByText("Pick a day to follow.").count()) throw new Error("Changing city retained the manual All days opt-out");
});

await flow("companion: swipe to All days asks which day to follow", async (page) => {
  await goTab(page,"Companion");
  const surface = page.locator("[data-guide=trip-companion]");
  await surface.evaluate(el => {
    const touch = (x) => new Touch({identifier:1,target:el,clientX:x,clientY:400});
    el.dispatchEvent(new TouchEvent("touchstart",{bubbles:true,touches:[touch(100)]}));
    el.dispatchEvent(new TouchEvent("touchend",{bubbles:true,changedTouches:[touch(250)]}));
  });
  await page.getByText("Pick a day to follow.").waitFor();
});

await flow("stop card: one editor opens, saves and closes", async (page) => {
  await goTab(page, "Timeline");
  const front = page.getByRole("button", { name: /tap to edit$/ }).first();
  const box = await front.boundingBox();
  // Names wrap rather than cut off, so a long one takes a second or third line.
  if (!box || box.height > 130) throw new Error(`card front is ${box?.height}px tall, not compact`);
  const before = await page.getByRole("button", { name: /tap to edit$/ }).count();
  await front.click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("textbox", { name: "Name" }).count()) !== 1) throw new Error("the back has no name field");
  if ((await page.getByRole("dialog").count()) !== 1) throw new Error("more than one editor opened");
  await page.getByRole("textbox", { name: "Name" }).fill("Renamed stop");
  await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(300);
  const w = (await writes(page)).find((x) => x.op === "update" && x.payload?.title === "Renamed stop");
  if (!w) throw new Error("renaming on the back did not save");
  if ((await page.getByRole("button", { name: /tap to edit$/ }).count()) !== before) throw new Error("Done did not turn the card back");
  // Every action on the back writes something.
  for (const name of [/^Mark .* done$/, /^Save .* to your places$/, /^Delete /]) {
    const n = (await writes(page)).length;
    await page.getByRole("button", { name: /tap to edit$/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name }).first().click();
    await page.waitForTimeout(400);
    if ((await writes(page)).length === n) throw new Error(`${name} on the back wrote nothing`);
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
  }
});

await flow("timeline: Now moves focus to the stop and respects reduced motion", async (page) => {
  await goTab(page, "Timeline");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const original = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = function(options) {
      window.__lastScrollBehavior = options?.behavior;
      return original.call(this, options);
    };
  });
  const jump = page.getByRole("button", { name: /^Jump to / });
  const title = (await jump.getAttribute("aria-label")).slice("Jump to ".length);
  await jump.click();
  await page.waitForFunction(() => document.activeElement?.id.startsWith("stop-"));
  if (!(await page.evaluate(() => document.activeElement.textContent)).includes(title)) throw new Error("Now focused a different stop");
  if (await page.evaluate(() => window.__lastScrollBehavior) !== "auto") throw new Error("Now animated despite reduced motion");
});

await flow("timeline editor: move a stop later and save its order", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "Edit the itinerary", exact: true }).click();
  const before = (await writes(page)).length;
  await page.getByRole("button", { name: /^Move .* later$/ }).first().click();
  await page.waitForTimeout(400);
  const apply = page.getByRole("button", { name: "Apply changes", exact: true });
  if (await apply.isVisible()) {
    if ((await writes(page)).length !== before) throw new Error("the order changed before confirmation");
    await apply.click();
    await page.waitForTimeout(400);
  }
  if (!(await writes(page)).slice(before).some((entry) => entry.op === "update" && typeof entry.payload?.position === "number")) throw new Error("the order was not saved");
});

await flow("timeline: Not visited hides done stops, All brings them back", async (page) => {
  await goTab(page, "Timeline");
  const cards = () => page.getByRole("button", { name: /tap to edit$/ }).count();
  const all = await cards();
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: /^Not visited/ }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const open = await cards();
  if (open >= all) throw new Error("Not visited hid nothing (the sample has a done stop)");
  // Done is on the card's front now, as in the prototype.
  await page.getByRole("button", { name: /^Actions for / }).first().click();
  await page.getByRole("button", { name: /^Mark .* done$/ }).first().click();
  await page.waitForTimeout(500);
  if ((await cards()) !== open - 1) throw new Error("a stop marked done stayed on the Not visited list");
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if ((await cards()) !== all) throw new Error("All did not bring every stop back");
});

await flow("timeline: paws between stops open directions to the next one", async (page) => {
  await goTab(page, "Timeline");
  if ((await page.getByRole("button", { name: /Add stop between/ }).count()) > 0) throw new Error("Add stop between is still there");
  const paws = page.getByRole("link", { name: /^Directions from .* to / });
  if ((await paws.count()) < 2) throw new Error("no paw between stops");
  const href = await paws.first().getAttribute("href");
  if (!href || !/google\.com\/maps\/dir\//.test(href)) throw new Error(`paw goes to ${href}`);
  const front = page.getByRole("button", { name: /Peace Park.*tap to edit$/ });
  const text = await front.innerText();
  if (!text.includes("Peace Park / Atomic Bomb Dome / Cenotaph (原爆ドーム)")) throw new Error(`name cut off: ${text}`);
});

await flow("timeline: the map and directions sit under each stop's ⋯, Edit stops turns every card over", async (page) => {
  await goTab(page, "Timeline");
  // The master moved Map and Directions off the card's front into ⋯.
  if ((await page.getByRole("button", { name: /^Locate .* on the map$/ }).count()) !== 0) throw new Error("Map is still on the card's front");
  await page.getByRole("button", { name: "Actions for Peace Memorial Museum", exact: true }).click();
  if ((await page.getByRole("button", { name: "Locate Peace Memorial Museum on the map", exact: true }).count()) !== 1) throw new Error("no Show on the map under ⋯");
  if ((await page.getByRole("link", { name: "Directions to Peace Memorial Museum in Maps", exact: true }).count()) !== 1) throw new Error("no Directions under ⋯");
  await page.screenshot({ path: join(out, `${previewTheme}-timeline-menu.png`), fullPage: true });
  await page.getByRole("button", { name: "Locate Peace Memorial Museum on the map", exact: true }).click();
  if ((await page.getByRole("tab", { name: "Map", exact: true }).getAttribute("aria-selected")) !== "true") throw new Error("Show on the map did not open Map");
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: "Edit stops", exact: true }).first().click();
  if ((await page.getByRole("button", { name: /^Move .* later$/ }).count()) === 0) throw new Error("Edit stops did not turn the cards over");
  await page.screenshot({ path: join(out, `${previewTheme}-timeline-edit.png`), fullPage: true });
  await page.getByRole("button", { name: "Done", exact: true }).first().click();
  if ((await page.getByRole("button", { name: "Edit stops", exact: true }).count()) === 0) throw new Error("Done did not end editing");
  // The tip is dismissed once and stays dismissed.
  await page.getByRole("button", { name: "Dismiss the tip", exact: true }).click();
  if ((await page.getByText("Tap ⋯ on a stop", { exact: false }).count()) !== 0) throw new Error("the tip stayed");
});

await flow("import: places, times and stays reach the timeline; doubtful pins are held back", async (page) => {
  await page.getByRole("button", { name: /Plan with Béa/ }).click();
  await page.getByRole("button", { name: /^Import a plan/ }).click();
  await page.getByRole("textbox", { name: "Paste your plan" }).fill("Day 1: breakfast at the station 8-8:45, shrine at 10 for 90 min, lunch at Kakiya, evening stroll");
  await page.getByRole("button", { name: "Import plan", exact: true }).click();
  await page.waitForTimeout(800);
  // The trip page runs its own lookup for unplaced stops; this is the import's.
  const geo = await page.evaluate(() =>
    (window.__geoCalls ?? []).find((c) => c.stops?.[0]?.title === "Breakfast at the station"),
  );
  if (!geo) throw new Error("the plan was never placed");
  const shrine = geo.stops[1];
  if (shrine.city !== "Miyajima" || !/厳島神社/.test(shrine.place)) throw new Error(`shrine sent as ${JSON.stringify(shrine)}`);
  if (geo.stops[2].address !== "539 Miyajimacho") throw new Error("the address was not sent to the lookup");
  for (const text of ["45 min stay", "1 h 30 min stay", "Check this one — not pinned"]) {
    if ((await page.getByText(text, { exact: false }).count()) === 0) throw new Error(`review does not show "${text}"`);
  }
  // Remove the station pin: confident, but the person says no.
  await page.getByRole("button", { name: "Not this one" }).first().click();
  if ((await page.getByText("Pin removed", { exact: false }).count()) !== 1) throw new Error("removing a pin did not show");
  // The row is still ticked: the pin button must not toggle the row.
  const before = (await writes(page)).length;
  await page.getByRole("button", { name: /^Save 4 stops/ }).click();
  await page.waitForTimeout(800);
  const insert = (await writes(page)).slice(before).find((x) => x.table === "itinerary_items" && x.op === "insert");
  if (!insert) throw new Error("nothing was saved (was a row unticked by the pin button?)");
  const rows = insert.payload;
  const by = (t) => rows.find((r) => r.title === t);
  const breakfast = by("Breakfast at the station");
  const shrineRow = by("Itsukushima Shrine");
  const lunch = by("Oyster lunch");
  if (!breakfast || !shrineRow || !lunch || !by("Evening stroll")) throw new Error(`saved ${rows.map((r) => r.title).join(", ")}`);
  if (breakfast.lat != null) throw new Error("a removed pin was saved");
  if (breakfast.planned_stay_minutes !== 45) throw new Error(`breakfast stay ${breakfast.planned_stay_minutes}`);
  if (breakfast.time_label !== "08:00") throw new Error(`breakfast time ${breakfast.time_label}`);
  if (shrineRow.lat !== 34.2959 || shrineRow.planned_stay_minutes !== 90) throw new Error("the shrine lost its pin or its stay");
  if (lunch.lat != null) throw new Error("a doubtful pin was saved without being kept");
  if (lunch.address !== "539 Miyajimacho") throw new Error(`lunch address ${lunch.address}`);
  if (!breakfast.day_date) throw new Error("day 1 did not become a date");
});

await flow("import: after alternatives, pins are looked up again, not carried by position", async (page) => {
  await page.getByRole("button", { name: /Plan with Béa/ }).click();
  await page.getByRole("button", { name: /^Import a plan/ }).click();
  await page.getByRole("textbox", { name: "Paste your plan" }).fill("Day 1: breakfast, shrine, lunch, stroll");
  await page.getByRole("button", { name: "Import plan", exact: true }).click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder(/Rainy-day activities/).fill("cheaper lunch please");
  await page.getByRole("button", { name: /find alternatives/ }).click();
  await page.waitForTimeout(800);
  const again = await page.evaluate(() =>
    (window.__geoCalls ?? []).some((c) => c.stops?.[2]?.title === "Okonomiyaki lunch"),
  );
  if (!again) throw new Error("the revised plan was not placed again");
  if ((await page.getByText("Okonomiyaki lunch").count()) === 0) throw new Error("the revision did not show");
});

await flow("background lookup: a doubtful match is not pinned onto a stop", async (page) => {
  await page.waitForTimeout(800);
  const asked = await page.evaluate(() =>
    (window.__geoCalls ?? []).some((c) => c.stops?.[0]?.title === "Sunset ferry back to Hiroshima"),
  );
  if (!asked) throw new Error("the background lookup never ran for the unplaced stop");
  const pinned = (await writes(page)).some(
    (x) => x.table === "itinerary_items" && x.op === "update" && x.payload?.lat === 34.3,
  );
  if (pinned) throw new Error("the namesake park was saved onto the stop");
});

await flow("companion: tapping the ribbon or the tracker shows that stop, current stop stays", async (page) => {
  await page.getByRole("button", { name: "Trip menu", exact: true }).click();
  await page.getByRole("button", { name: /Customize view/ }).click();
  const ribbonSwitch = page.getByRole("switch", { name: /Itinerary ribbon/ });
  if ((await ribbonSwitch.getAttribute("aria-checked")) !== "true") await ribbonSwitch.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.waitForTimeout(300);
  const nowBefore = await page.getByText(/^Now:/).locator("..").innerText().catch(() => "");
  await page.getByRole("button", { name: /Lunch: Kakiya — show this stop/ }).first().click();
  await page.waitForTimeout(200);
  if ((await page.getByRole("region", { name: /Stop \d+: Lunch: Kakiya/ }).count()) !== 1)
    throw new Error("tapping a ribbon card did not show the stop");
  const pressed = await page.getByRole("button", { name: /Lunch: Kakiya, .* — show this stop/ }).getAttribute("aria-pressed");
  if (pressed !== "true") throw new Error("the tracker does not mark the same stop");
  const nowAfter = await page.getByText(/^Now:/).locator("..").innerText().catch(() => "");
  if (nowBefore !== nowAfter) throw new Error("looking at a stop moved Now");
  await page.getByRole("button", { name: /Omotesando food crawl, .* — show this stop/ }).click();
  if ((await page.getByRole("region", { name: /Stop \d+: Omotesando food crawl/ }).count()) !== 1)
    throw new Error("tapping a tracker dot did not show that stop");
  await page.getByRole("button", { name: "Back to now" }).click();
  if ((await page.getByRole("region", { name: /^Stop \d+:/ }).count()) !== 0) throw new Error("Back to now did not close it");
});

await flow("timeline editor: neighbourhood groups the day by area", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "Neighbourhood" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const heading = (area) => page.locator("li").filter({ hasText: new RegExp(`^${area} · \\d+ stops?$`) });
  for (const area of ["Naka Ward", "Miyajima Omotesando", "No place yet"]) {
    if ((await heading(area).count()) === 0) throw new Error(`no ${area} group`);
  }
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "Timeline", exact: true }).click();
  await page.keyboard.press("Escape");
  if ((await heading("Naka Ward").count()) !== 0) throw new Error("Timeline did not ungroup");
});

await flow("timeline: directions between stops open from the day heading", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: "Directions between stops", exact: true }).first().click();
  await page.waitForTimeout(400);
  if ((await page.getByRole("dialog").count()) !== 1) throw new Error("directions did not open");
  await page.getByRole("dialog").getByRole("button", { name: "Get directions", exact: true }).click();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  if ((await page.getByRole("link", { name: /^Directions from / }).count()) === 0) throw new Error("no Maps link in the directions");
  if ((await page.getByText("16 min walk", { exact: true }).count()) === 0) throw new Error("fresh directions did not reach the timeline");
});

await flow("optimize: estimated travel times, checked on real routes, days planned around opening hours", async (page) => {
  await page.getByRole("button", { name: /Plan with Béa/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Optimize my trip/ }).click();
  await page.getByRole("button", { name: /Open at visit time/ }).click();
  await page.getByRole("button", { name: "Optimize my trip", exact: true }).click();
  await page.waitForTimeout(500);
  const sent = await page.evaluate(() => (window.__optimizeCalls ?? [])[0]);
  if (!sent) throw new Error("Optimize was never asked");
  if (!sent.goals.includes("hours")) throw new Error(`goals sent: ${sent.goals.join(", ")}`);
  if (!sent.items.some((i) => "planned_stay_minutes" in i)) throw new Error("stay lengths were not sent");
  for (const text of [
    "Getting between stops: about 2 h 10 min on foot → about 1 h 15 min. Checked on real routes: 1 h 22 min.",
    "2 days were ordered",
    "One day was put in order again",
  ]) {
    if ((await page.getByText(text, { exact: false }).count()) === 0) throw new Error(`the result does not show "${text}"`);
  }
});

await flow("shell header and navigation stay visible while the content scrolls", async (page) => {
  const expanded = await page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
  const header = page.locator("header").first();
  const before = await header.boundingBox();
  await page.locator("main").evaluate((el) => el.scrollTop = el.scrollHeight);
  await page.waitForTimeout(300);
  if (await page.locator("main").evaluate((el) => el.scrollTop) < 100) throw new Error("the fixture never scrolled");
  if (await page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)) >= expanded) throw new Error("the page header did not compress");
  const after = await header.boundingBox();
  if (!before || !after || Math.abs(after.y - before.y) > 2) throw new Error("shell header scrolled away");
  const nav = await page.getByRole("navigation", { name: "Main" }).boundingBox();
  if (!nav || nav.y + nav.height > 900) throw new Error("main navigation left the viewport");
  await page.locator("main").evaluate((el) => el.scrollTop = 0);
  await page.waitForTimeout(300);
  if (await page.locator("h1").evaluate((el) => parseFloat(getComputedStyle(el).fontSize)) < expanded) throw new Error("the page header did not expand again");
}, "shell");

if (flowSelected("a stop pinned far from the trip is flagged, and only that one")) {
  const name = "a stop pinned far from the trip is flagged, and only that one";
  const { page, errors } = await open("stray");
  try {
    await goTab(page, "Timeline");
    const flagged = page.getByText("Pinned far from the rest of this trip", { exact: false });
    if ((await flagged.count()) !== 1) throw new Error(`${await flagged.count()} cards flagged, expected 1`);
    const card = page.getByRole("button", { name: /Motoyasubashi.*tap to edit$/ });
    if ((await card.getByText("Pinned far", { exact: false }).count()) !== 1) throw new Error("the wrong card is flagged");
    await card.click();
    if ((await page.getByText("may be a different place with the same name", { exact: false }).count()) !== 1)
      throw new Error("the back does not explain the flag");
    await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
    // Directions between same-day stops hundreds of km apart are a warning, not a drive.
    await page.getByRole("button", { name: "Directions between stops", exact: true }).first().click();
    await page.getByRole("dialog").getByRole("button", { name: "Get directions", exact: true }).click();
    await page.waitForTimeout(600);
    await page.keyboard.press("Escape");
    if ((await page.getByText(/km apart on the map on the same day/).count()) === 0)
      throw new Error("a 280 km same-day leg was shown as a journey");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
if (flowSelected("companion: a time to leave by, no planned stay, no journey rows as stops")) {
  const name = "companion: a time to leave by, no planned stay, no journey rows as stops";
  const { page, errors } = await open("legs");
  try {
    await goTab(page, "Companion");
    const day1 = page.getByRole("tab", { name: /Day 1/ });
    if (await day1.count()) await day1.first().click();
    await page.waitForTimeout(800);
    if ((await page.getByText("Plan to stay").count()) !== 0) throw new Error("Plan to stay is still offered");
    await page.locator(".now-leave").waitFor({ state: "visible" });
    if (!/\d{1,2}:\d{2}/.test(await page.locator(".now-leave").getAttribute("aria-label"))) throw new Error("departure guidance has no clock time");
    if ((await page.getByText(/^\d.*planned.*stay/i).count()) !== 0) throw new Error("the stay line still talks about a plan");
    const tracker = page.getByRole("region", { name: "Live journey" });
    if ((await tracker.getByText("Head to Motoyasubashi Pier").count()) !== 0) throw new Error("a journey row is a tracker stop");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
if (flowSelected("place details: hours on the stop, and a warning when the visit falls outside them")) {
  const name = "place details: hours on the stop, and a warning when the visit falls outside them";
  const { page, errors } = await open("default");
  try {
    await goTab(page, "Timeline");
    await page.getByRole("button", { name: /Peace Memorial Museum.*tap to edit$/ }).click();
    await page.waitForTimeout(400);
    if ((await page.getByText("Mo-Su 10:00-18:00").count()) === 0) throw new Error("no hours shown");
    if ((await page.getByText(/Likely closed at 09:30/).count()) === 0) throw new Error("no closed warning for a 09:30 visit");
    if ((await page.getByRole("link", { name: "hpmmuseum.jp" }).count()) === 0) throw new Error("no website link");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
if (flowSelected("companion: Leave by even when the next stop has no pin yet")) {
  const name = "companion: Leave by even when the next stop has no pin yet";
  const { page, errors } = await open("unpinned");
  try {
    await goTab(page, "Companion");
    const day1 = page.getByRole("tab", { name: /Day 1/ });
    if (await day1.count()) await day1.first().click();
    await page.waitForTimeout(800);
    const calls = await page.evaluate(() => window.__routeCalls ?? []);
    const asked = calls.find((c) => c?.stops?.some((s) => s.lat == null && s.title.startsWith("Peace Park")));
    if (!asked) throw new Error("the unpinned stop was not sent to be looked up");
    // Looked up around the stop that is on the map, not in the trip's area.
    if (!asked.near || Math.abs(asked.near.lat - 34.3915) > 0.001) throw new Error("not looked up around the pinned stop");
    await page.locator(".now-leave").waitFor({ state: "visible" });
    if (!/\d{1,2}:\d{2}/.test(await page.locator(".now-leave").getAttribute("aria-label"))) throw new Error("departure guidance has no clock time");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
if (flowSelected("a journey saved as a stop becomes a note on the stop it leads to")) {
  const name = "a journey saved as a stop becomes a note on the stop it leads to";
  const { page, errors } = await open("legs");
  try {
    await goTab(page, "Timeline");
    await page.getByRole("button", { name: /Head to Motoyasubashi Pier.*tap to edit$/ }).click();
    await page.getByRole("button", { name: "Make it a note on Motoyasubashi Pier ferry" }).click();
    await page.waitForTimeout(600);
    const writes = await page.evaluate(() => window.__writes);
    const noted = writes.some(
      (w) => w.op === "update" && String(w.payload?.detail ?? "").startsWith("Getting there: Head to Motoyasubashi Pier, 11:30"),
    );
    if (!noted) throw new Error("the next stop did not get the note");
    if (!writes.some((w) => w.op === "delete")) throw new Error("the journey row was not removed");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
{
  const { page } = await open("default");
  await goTab(page, "Timeline");
  if ((await page.getByText("Pinned far from the rest", { exact: false }).count()) !== 0)
    note("a normal trip has a stop flagged as far away");
  else console.log("✓ a normal trip has no stop flagged");
  await page.close();
}

if (flowSelected("home: upcoming trip shows real flight, packing and planning links")) {
  const name = "home: upcoming trip shows real flight, packing and planning links";
  const { page, errors } = await open("home");
  try {
    for (const text of ["AC781", "YUL → LAX", "67%", "Where to next?", "Suggested for your trip"]) {
      if ((await page.getByText(text, { exact: false }).count()) === 0) throw new Error(`missing "${text}"`);
    }
    const open = page.getByRole("link", { name: /Open LA/ });
    if ((await open.count()) !== 1) throw new Error("no Open itinerary link");
    if ((await open.getAttribute("href")) !== "/trips/la") throw new Error(`Open itinerary goes to ${await open.getAttribute("href")}`);
    const later = page.getByRole("link", { name: /JQAPALA A/ });
    if ((await later.count()) !== 1) throw new Error("the later trip is not listed");
    if ((await later.getAttribute("href")) !== "/trips/t1") throw new Error("the later trip does not open its page");
    if ((await page.getByText("Your trips", { exact: true }).count()) === 0) throw new Error("no other-trips heading");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}

await browser.close();
writeFileSync(join(process.env.PREVIEW_REPORT_DIR ?? out, `report-${previewTheme}.json`), JSON.stringify({ clicked, failures }, null, 2));
console.log(`\n${clicked} controls clicked, ${failures.length} problem(s). Screenshots in scripts/preview/out/`);
process.exit(failures.length ? 1 : 0);
