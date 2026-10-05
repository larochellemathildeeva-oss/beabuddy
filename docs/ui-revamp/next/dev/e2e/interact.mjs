import { chromium } from "playwright-core";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
// Usage (from dev/): node e2e/<file>.mjs  — needs Chrome; set CHROME=/path/to/chrome if not /usr/bin/google-chrome.
const ROOT = pathToFileURL(resolve(dirname(fileURLToPath(import.meta.url)), "../..")).href;
const CHROME = process.env.CHROME ?? "/usr/bin/google-chrome";
const browser = await chromium.launch({ executablePath: CHROME, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 420, height: 480 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("pageerror:", e.message));
await page.goto(ROOT + "/globe-demo.html?mood=calm&auto=off&rot=12,-30");
await page.waitForSelector('[data-earth="webgl"]', { timeout: 60000 });
const status = () => page.locator("p[aria-live]").textContent();
const pinPos = (name) => page.evaluate((n) => {
  const b = document.querySelector(`[data-globe-pin][aria-label^="${n}"]`);
  const r = b.getBoundingClientRect(); return { x: r.x, y: r.y, vis: getComputedStyle(b).visibility };
}, name);
const ok = (c, m) => { console.log(c ? "PASS" : "FAIL", m); if (!c) process.exitCode = 1; };

// Tap a place
let p = await pinPos("Paris");
await page.mouse.click(p.x, p.y);
ok((await status()).includes("Paris"), "tap a place selects it → " + (await status()));

// Drag turns the globe; the trailing click must not select
const before = await pinPos("Paris");
await page.mouse.move(p.x, p.y); await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(p.x + i * 8, p.y + i * 2);
await page.mouse.up();
await page.waitForTimeout(100);
const after = await pinPos("Paris");
ok(Math.abs(after.x - before.x) > 40, `drag moves the globe (Δx ${Math.round(after.x - before.x)})`);
ok((await status()).includes("Paris"), "a drag that ends on a place is not a tap");

// (Fling is checked deterministically in fling.mjs.)

// Home resets; arrow keys rotate
await page.locator('[role="group"][aria-label^="Interactive globe"]').focus();
await page.keyboard.press("Home");
await page.waitForTimeout(1500);
const h0 = await pinPos("Paris");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(50);
const h1 = await pinPos("Paris");
ok(h1.x - h0.x > 10, `ArrowRight turns the globe (Δx ${Math.round(h1.x - h0.x)})`);

// Zoom buttons
const z0 = await pinPos("Paris");
await page.getByRole("button", { name: "Zoom in" }).click();
await page.getByRole("button", { name: "Zoom in" }).click();
const z1 = await pinPos("Paris");
ok(Math.hypot(z1.x - z0.x, z1.y - z0.y) > 5, "zoom in spreads the places");
await page.getByRole("button", { name: "Reset the view" }).click();
await page.waitForTimeout(1500);

// Country tap (the centre of the globe at Home view is around lon 10 lat 18 → Chad/Niger/Libya)
const box = await page.locator('[data-earth]').boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
ok((await status()).startsWith("Country:"), "tap a country → " + (await status()));

// Select a place round the back → globe turns to it
await page.locator('[data-globe-pin][aria-label^="Tokyo"]').evaluate((b) => b.click());
await page.waitForTimeout(1600);
const t = await pinPos("Tokyo");
ok(t.vis === "visible", "selecting a hidden place turns the globe to it");
await browser.close();
if (process.exitCode) console.log("some checks failed");
