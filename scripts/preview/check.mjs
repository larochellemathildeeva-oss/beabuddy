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
await build({
  entryPoints: [join(src, "main.tsx")],
  bundle: true,
  outfile: join(out, "page.js"),
  jsx: "automatic",
  loader: { ".png": "dataurl", ".json": "json" },
  tsconfig: join(root, "tsconfig.json"),
  logLevel: "error",
  alias: {
    "@/integrations/supabase/client": join(src, "fake-supabase.ts"),
    "@tanstack/react-start": join(src, "fake-start.ts"),
    "@tanstack/react-start/server": join(src, "fake-start.ts"),
    "@tanstack/react-router": join(src, "fake-router.tsx"),
    "@/lib/directions.functions": join(src, "fake-directions.ts"),
    "@/lib/itinerary.functions": join(src, "fake-itinerary.ts"),
    "@/lib/geocode-plan.functions": join(src, "fake-geocode-plan.ts"),
    "node:net": join(src, "fake-node.ts"),
    "node:dns/promises": join(src, "fake-node.ts"),
  },
  define: {
    "import.meta.env": JSON.stringify({ DEV: false, PROD: true, VITE_SUPABASE_URL: "x", VITE_SUPABASE_PUBLISHABLE_KEY: "x" }),
  },
});
writeFileSync(join(out, "app.css"), readFileSync(join(assets, css)));
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="app.css"><link rel="stylesheet" href="page.css"></head>
<body class="bg-background text-foreground font-sans antialiased"><div id="root"></div><script src="page.js"></script></body></html>`,
);

const executablePath =
  process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath } : { channel: "chrome" });

// A plain map tile: this checks the page, not the tile server.
const tile = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/+/9fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64",
);
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png" };

async function open(sample) {
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/tile/")) return route.fulfill({ body: tile, contentType: "image/png" });
    if (url.host.endsWith("googleapis.com") || url.host.endsWith("gstatic.com")) return route.continue();
    if (url.host !== "preview.test") return route.abort();
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      return route.fulfill({ body: readFileSync(join(out, file)), contentType: types[file.split(".").pop()] ?? "application/octet-stream" });
    } catch {
      return route.fulfill({ status: 404 });
    }
  });
  await page.goto(`http://preview.test/?sample=${sample}`);
  await page.waitForTimeout(1200);
  return { page, errors };
}

const tabNames = async (page) =>
  page.$$eval('[role="tablist"][aria-label="How to look at this trip"] [role="tab"]', (els) => els.map((e) => e.textContent.trim()));

async function goTab(page, name) {
  await page.getByRole("tab", { name, exact: true }).click();
  await page.waitForTimeout(500);
}

const failures = [];
const note = (msg) => {
  failures.push(msg);
  console.log("  ✗", msg);
};

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
    await page.screenshot({ path: join(out, `${sample}-${name.replace(/\W+/g, "-").toLowerCase()}.png`), fullPage: true });
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
    await page.screenshot({ path: join(out, `dark-${name.replace(/\W+/g, "-").toLowerCase()}.png`), fullPage: true });
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
    dialogs: document.querySelectorAll('[role="dialog"], .fixed.inset-0').length,
  }));

let clicked = 0;
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
    const before = await snapshot(page);
    try {
      await control.click({ timeout: 2000 });
    } catch (e) {
      note(`${where}: could not be clicked (${String(e.message).split("\n")[0]})`);
      await reload();
      continue;
    }
    await page.waitForTimeout(300);
    const after = await snapshot(page);
    // A click always focuses what was clicked; that alone is not an effect.
    if (await control.evaluate((el) => el === document.activeElement).catch(() => false)) after.focus = before.focus;
    clicked += 1;
    if (errors.length) {
      note(`${where}: threw ${errors.join(" | ").slice(0, 200)}`);
      errors.length = 0;
    }
    const changed =
      before.text !== after.text || before.count !== after.count || before.writes !== after.writes || before.focus !== after.focus;
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

// 3. Feature flows, end to end.
async function flow(name, run) {
  const { page, errors } = await open("default");
  try {
    await run(page);
    if (errors.length) note(`${name}: threw ${errors.join(" | ").slice(0, 200)}`);
    else console.log(`✓ ${name}`);
  } catch (e) {
    note(`${name}: ${String(e.message).split("\n")[0]}`);
  }
  await page.close();
}
const writes = (page) => page.evaluate(() => window.__writes);

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
  if ((await page.locator("li").first().getByText("Booked").count()) === 0) throw new Error("card front shows no Booked mark");
});

await flow("saved places: add one to the chosen day", async (page) => {
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.getByRole("button", { name: "Saved", exact: true }).click();
  await page.locator("li", { hasText: "Nagata-ya" }).getByRole("button").click();
  await page.waitForTimeout(400);
  const w = (await writes(page)).find((x) => x.table === "itinerary_items" && x.op === "insert");
  if (!w) throw new Error("nothing was added to the itinerary");
  if (w.payload.day_date !== "2026-10-07") throw new Error(`added to ${w.payload.day_date}, not the chosen day`);
});

await flow("locate on map: opens Map Split on that stop", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: /Peace Memorial Museum.*tap to edit$/ }).click();
  await page.getByRole("button", { name: /^Locate .* on the map$/ }).first().click();
  await page.waitForTimeout(700);
  const on = await page.getByRole("tab", { name: "Map Split", exact: true }).getAttribute("aria-selected");
  if (on !== "true") throw new Error("Map Split did not open");
  if ((await page.getByRole("button", { name: /Peace Memorial Museum|09:30/, pressed: true }).count()) === 0)
    throw new Error("the located stop is not the one selected");
});

await flow("companion: pick a day from the prompt itself", async (page) => {
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /Whole trip/ }).first().click();
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

await flow("stop card: compact front turns over to edit, and back", async (page) => {
  await goTab(page, "Timeline");
  const front = page.getByRole("button", { name: /tap to edit$/ }).first();
  const box = await front.boundingBox();
  // Names wrap rather than cut off, so a long one takes a second or third line.
  if (!box || box.height > 130) throw new Error(`card front is ${box?.height}px tall, not compact`);
  const before = await page.getByRole("button", { name: /tap to edit$/ }).count();
  await front.click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("textbox", { name: "Name" }).count()) !== 1) throw new Error("the back has no name field");
  if ((await page.getByRole("button", { name: /tap to edit$/ }).count()) !== before - 1) throw new Error("more than one card turned");
  await page.getByRole("textbox", { name: "Name" }).fill("Renamed stop");
  await page.getByRole("button", { name: /^Close / }).click();
  await page.waitForTimeout(300);
  const w = (await writes(page)).find((x) => x.op === "update" && x.payload?.title === "Renamed stop");
  if (!w) throw new Error("renaming on the back did not save");
  if ((await page.getByRole("button", { name: /tap to edit$/ }).count()) !== before) throw new Error("Done did not turn the card back");
  // Every action on the back writes something.
  for (const name of [/^Mark .* done$/, /^Move .* later$/, /^Save .* to your places$/, /^Delete /]) {
    const n = (await writes(page)).length;
    await page.getByRole("button", { name: /tap to edit$/ }).first().click();
    await page.getByRole("button", { name }).first().click();
    await page.waitForTimeout(400);
    if ((await writes(page)).length === n) throw new Error(`${name} on the back wrote nothing`);
    const close = page.getByRole("button", { name: /^Close / });
    if (await close.count()) await close.first().click();
  }
});

await flow("timeline: Not visited hides done stops, All brings them back", async (page) => {
  await goTab(page, "Timeline");
  const cards = () => page.getByRole("button", { name: /tap to edit$/ }).count();
  const all = await cards();
  await page.getByRole("button", { name: /^Not visited/ }).click();
  await page.waitForTimeout(300);
  const open = await cards();
  if (open >= all) throw new Error("Not visited hid nothing (the sample has a done stop)");
  await page.getByRole("button", { name: /tap to edit$/ }).first().click();
  await page.getByRole("button", { name: /^Mark .* done$/ }).click();
  await page.waitForTimeout(500);
  if ((await cards()) !== open - 1) throw new Error("a stop marked done stayed on the Not visited list");
  await page.getByRole("button", { name: "All", exact: true }).click();
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

await flow("import: places, times and stays reach the timeline; doubtful pins are held back", async (page) => {
  await page.getByRole("button", { name: /Plan with Béa/ }).click();
  await page.getByRole("button", { name: /I already have a plan/ }).click();
  await page.getByPlaceholder(/Paste an itinerary here/).fill("Day 1: breakfast at the station 8-8:45, shrine at 10 for 90 min, lunch at Kakiya, evening stroll");
  await page.getByRole("button", { name: "Read this itinerary" }).click();
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
  await page.getByRole("button", { name: /I already have a plan/ }).click();
  await page.getByPlaceholder(/Paste an itinerary here/).fill("Day 1: breakfast, shrine, lunch, stroll");
  await page.getByRole("button", { name: "Read this itinerary" }).click();
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

await flow("banner stays pinned while the page scrolls", async (page) => {
  await goTab(page, "Timeline");
  const bar = page.locator("article > div.sticky").first();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const box = await bar.boundingBox();
  if (!box || Math.abs(box.y) > 2) throw new Error(`banner is at y=${box?.y}, not pinned to the top`);
  if (box.height > 80) throw new Error(`banner is ${box.height}px tall, not thin`);
});

{
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
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    note(`${name}: ${String(e.message).split("\n")[0]}`);
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

await browser.close();
writeFileSync(join(out, "report.json"), JSON.stringify({ clicked, failures }, null, 2));
console.log(`\n${clicked} controls clicked, ${failures.length} problem(s). Screenshots in scripts/preview/out/`);
process.exit(failures.length ? 1 : 0);
