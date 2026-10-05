import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
// Usage (from dev/): node e2e/<file>.mjs  — needs Chrome; set CHROME=/path/to/chrome if not /usr/bin/google-chrome.
const ROOT = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "../..")).href;
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 420, height: 480 } });
await page.goto(ROOT + "/globe-demo.html?mood=calm&auto=resume&rot=12,-30&clock=manual");
await page.waitForSelector('[data-earth="webgl"]', { timeout: 60000 });
const step = (ms) => page.evaluate((m) => window.__step(m), ms);
const px = () => page.evaluate(() => document.querySelector('[data-globe-pin][aria-label^="Paris"]').getBoundingClientRect().x);
await page.mouse.move(250, 240); await page.mouse.down();
for (let i = 1; i <= 6; i++) { await step(16); await page.mouse.move(250 - i * 15, 240); }
await page.mouse.up();
const a = await px(); await step(16); await step(16); const b = await px();
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) process.exitCode = 1; };
ok(Math.abs(b - a) > 4, `a flick coasts after release (${((b - a) / 2).toFixed(1)} px/frame)`);
for (let i = 0; i < 120; i++) await step(16);
const c = await px(); await step(16); const d = await px();
ok(Math.abs(d - c) < Math.abs(b - a) / 2 / 4, "and slows down");
// Hold without moving: the globe stops under the finger
await page.mouse.move(200, 300); await page.mouse.down();
const f = await px(); for (let i = 0; i < 60; i++) await step(16); const g = await px();
ok(Math.abs(g - f) < 0.01, "held still, it does not turn");
await page.mouse.up();
// Let go: after the resume pause (2.5 s) the gentle turn comes back
for (let i = 0; i < 200; i++) await step(16);
const h = await px(); for (let i = 0; i < 30; i++) await step(16); const j = await px();
ok(Math.abs(j - h) > 0.5, `auto-rotation resumes (${(j - h).toFixed(1)} px in 0.5 s)`);
await browser.close();
