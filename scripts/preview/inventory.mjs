#!/usr/bin/env node
/**
 * Lists every control a screen offers (buttons, links, fields, tabs), by the
 * name a person or screen reader meets, so a restyle can prove it removed
 * nothing: save the list before, change the screens, run it again and diff.
 *
 *   PREVIEW_RENDER_ONLY=1 node scripts/preview/check.mjs   # builds the bundle
 *   node scripts/preview/inventory.mjs save before          # writes out/inventory-before.json
 *   node scripts/preview/inventory.mjs diff before          # lists controls that went missing
 *
 * Controls that were removed on purpose are named in INTENDED below, with the
 * reason, so a missing one is either a decision written down or a failure.
 */
import { chromium } from "playwright-core";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const [mode, tag] = process.argv.slice(2);
const SCREENS = [
  { id: "home", sample: "homepage" },
  { id: "home-ontrip", sample: "homepage-ontrip" },
  { id: "home-empty", sample: "homepage-none" },
  { id: "trips", sample: "trips" },
  { id: "world", sample: "world" },
  { id: "trip-overview", sample: "default" },
  { id: "trip-map", sample: "default", click: '[role="tab"][aria-label="Map"]', plainMap: true },
  { id: "trip-timeline", sample: "default", click: '[role="tab"][aria-label="Timeline"]' },
  // Companion was a tab; it is now a switch inside Map. Either way it is reached.
  { id: "trip-companion", sample: "default", companion: true },
];
/** Controls removed on purpose: name -> why. */
const INTENDED = {
  Drafts: "Trips: the Drafts tab was removed at the owner's request; drafts show under Upcoming as Dates to set.",
  "1 draft with dates to set": "Trips: the Drafts teaser became the Dates to set list under Upcoming.",
  Search: "Home: the round search icon became the word Search (same link).",
  "Upcoming trip": "Home: the trip hero's title link and its round arrow became one Open trip button to the same trip.",
  Companion: "Trip: Companion moved from a tab to a Map | Companion switch under the Map tab.",
  "Béa.v": "The header link's name lost the logo picture and the 'Travel Buddy' caption; it is the wordmark Béa.",
};
const intendedFor = (name) => Object.entries(INTENDED).find(([key]) => name === key || name.startsWith(key))?.[1];

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json" };
const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/+/9fwAJ+wP9KobjigAAAABJRU5ErkJggg==", "base64");
const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : { channel: "chrome" });

async function names({ sample, click, companion, plainMap }) {
  const page = await browser.newPage({ viewport: { width: 414, height: 900 } });
  await page.addInitScript(() => { localStorage.setItem("bea-theme", "calm"); localStorage.setItem("bea-accent", "pink"); });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/tile/")) return route.fulfill({ body: tile, contentType: "image/png" });
    if (FONT_HOSTS.has(url.host)) return route.continue();
    if (url.host !== "preview.test") return route.abort();
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    const path = existsSync(join(out, file)) ? join(out, file) : join(here, "..", "..", "public", file);
    return existsSync(path) ? route.fulfill({ body: readFileSync(path), contentType: types[file.split(".").pop()] ?? "application/octet-stream" }) : route.fulfill({ status: 404 });
  });
  await page.goto(`https://preview.test/?sample=${sample}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  if (companion) {
    const tab = page.locator('[role="tab"][aria-label="Companion"]');
    if (await tab.count()) await tab.first().click();
    else {
      await page.locator('[role="tab"][aria-label="Map"]').first().click();
      await page.waitForTimeout(400);
      await page.getByRole("button", { name: "Companion", exact: true }).first().click();
    }
    await page.waitForTimeout(600);
  }
  if (click) { await page.locator(click).first().click({ timeout: 5000 }); await page.waitForTimeout(600); }
  if (plainMap) {
    // A trip under way opens Map on its Companion side; the plain map is one tap away.
    await page.locator('[aria-label="Map or Companion"] button', { hasText: /^Map$/ }).first().click().catch(() => {});
    await page.waitForTimeout(800);
  }
  const found = await page.evaluate(() => {
    const clean = (s) => (s ?? "").replace(/\s+/g, " ").trim();
    const list = new Set();
    for (const el of document.querySelectorAll('button, a[href], input, select, textarea, [role="tab"], [role="button"], [role="switch"]')) {
      const label = clean(el.getAttribute("aria-label")) || clean(el.textContent) || clean(el.getAttribute("placeholder")) || clean(el.getAttribute("title")) || clean(el.querySelector("img")?.getAttribute("alt"));
      if (label) list.add(`${el.tagName.toLowerCase()}: ${label.slice(0, 80)}`);
    }
    return [...list].sort();
  });
  await page.close();
  return found;
}

const result = {};
for (const screen of SCREENS) result[screen.id] = await names(screen);
await browser.close();
const file = join(out, `inventory-${tag ?? "now"}.json`);
if (mode === "save") {
  writeFileSync(file, JSON.stringify(result, null, 1));
  console.log(`saved ${Object.values(result).flat().length} controls to ${file}`);
} else if (mode === "diff") {
  const before = JSON.parse(readFileSync(file, "utf8"));
  let missing = 0;
  for (const [id, was] of Object.entries(before)) {
    const now = new Set(result[id] ?? []);
    for (const control of was) {
      const plain = control.replace(/^[a-z]+: /, "");
      if (now.has(control) || [...now].some((n) => n.endsWith(`: ${plain}`))) continue;
      const why = intendedFor(plain);
      console.log(`${why ? "removed on purpose" : "MISSING"}  ${id}  ${control}${why ? `  (${why})` : ""}`);
      if (!why) missing++;
    }
  }
  console.log(missing ? `${missing} control(s) missing` : "no control went missing");
  process.exit(missing ? 1 : 0);
} else {
  console.log("usage: inventory.mjs save|diff <tag>");
  process.exit(2);
}
