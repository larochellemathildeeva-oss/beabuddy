#!/usr/bin/env node
/**
 * Screenshots of one preview sample in Calm, Colorful and Dark, for pull
 * requests (before / after beside the mockup).
 *
 *   PREVIEW_RENDER_ONLY=1 node scripts/preview/check.mjs   # builds the bundle
 *   node scripts/preview/shots.mjs recs recs-before        # sample, file prefix
 *
 * Optional third argument: a CSS selector to click first (a tab, a button).
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, "out");
const [sample, prefix, ...clicks] = process.argv.slice(2);
const dest = process.env.SHOTS_DIR ?? out;
mkdirSync(dest, { recursive: true });
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json" };
const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);
const tile = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/+/9fwAJ+wP9KobjigAAAABJRU5ErkJggg==", "base64");
const executablePath = process.env.CHROMIUM_PATH || (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
const browser = await chromium.launch(executablePath ? { executablePath, args: ["--no-sandbox"] } : { channel: "chrome" });
for (const theme of ["calm", "colorful", "dark"]) {
  const page = await browser.newPage({ viewport: { width: 390, height: Number(process.env.SHOTS_H ?? 1900) }, deviceScaleFactor: 2 });
  await page.addInitScript((t) => {
    localStorage.setItem("bea-theme", t);
    localStorage.setItem("bea-accent", "pink");
  }, theme);
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.startsWith("/api/tile/")) return route.fulfill({ body: tile, contentType: "image/png" });
    if (FONT_HOSTS.has(url.host)) return route.continue();
    if (url.host !== "preview.test") return route.abort();
    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    if (file === "/index.html")
      return route.fulfill({
        body: readFileSync(join(out, file), "utf8").replace('<html lang="en">', `<html lang="en" data-theme="${theme}" data-accent="pink" class="${theme === "dark" ? "dark" : ""}">`),
        contentType: "text/html",
      });
    const path = existsSync(join(out, file)) ? join(out, file) : join(here, "..", "..", "public", file);
    return existsSync(path) ? route.fulfill({ body: readFileSync(path), contentType: types[file.split(".").pop()] ?? "application/octet-stream" }) : route.fulfill({ status: 404 });
  });
  await page.goto(`https://preview.test/?sample=${sample}`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(1500);
  for (const sel of clicks) {
    await page.locator(sel).first().click();
    await page.waitForTimeout(600);
  }
  await page.screenshot({ path: join(dest, `${prefix}-${theme}.png`), fullPage: true });
  await page.close();
}
await browser.close();
