/**
 * Real Home components with the repo's fake account/trip data.
 * Run after npm run build and PREVIEW_RENDER_ONLY=1 node scripts/preview/check.mjs:
 *   node scripts/preview/home-widgets.mjs
 * Verifies mouse, touch, keyboard, sizes, switches, persistence, reduced motion
 * and all trip states. Writes the six PR screenshots to docs/home-widgets/.
 */
import assert from "node:assert/strict";
import { HOME_WIDGET_SIZES } from "../../src/lib/home-widget-grid.ts";
import { chromium } from "playwright-core";
import { readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const out = join(root, "scripts/preview/out");
const shots = join(root, "docs/home-widgets");
mkdirSync(shots, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium", headless: true, args: ["--no-sandbox"] });
const keys = ["saved", "group", "trip", "weather", "weatherThere", "suggested", "waiting", "future", "stops", "now", "tools", "detour", "notes"];
const seed = { order: keys, on: keys.filter((key) => !["stops", "now", "tools", "detour", "notes"].includes(key)), sizes: { saved: "small", group: "small", weather: "small", weatherThere: "small" } };
const types = { js: "text/javascript", css: "text/css", html: "text/html", png: "image/png", webp: "image/webp", jpg: "image/jpeg", svg: "image/svg+xml", json: "application/json" };
const errors = [];
async function open(theme, layout = seed, sample = "homepage", width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ theme, layout }) => {
    localStorage.setItem("bea-theme", theme);
    localStorage.setItem("bea-accent", "pink");
    if (layout && !localStorage.getItem("bea-home-layout-me")) localStorage.setItem("bea-home-layout-me", JSON.stringify(layout));
  }, { theme, layout });
  await page.route("**/*", (route) => {
    const url = new URL(route.request().url());
    if (url.host !== "preview.test") return route.abort();
    const name = url.pathname === "/" ? "index.html" : url.pathname;
    const built = join(out, name);
    const file = existsSync(built) ? built : join(root, "public", name);
    try { const body = name === "index.html" ? readFileSync(file, "utf8").replace('<head>', '<head><meta name="viewport" content="width=device-width, initial-scale=1">') : readFileSync(file); return route.fulfill({ body, contentType: types[file.split(".").pop()] ?? "application/octet-stream" }); }
    catch { return route.fulfill({ status: 404 }); }
  });
  await page.goto(`https://preview.test/?sample=${sample}&path=/`);
  await page.locator(".home-widget-grid").waitFor();
  return { page, context };
}
const order = (page) => page.locator(".home-widget").evaluateAll((nodes) => nodes.map((node) => node.dataset.module));
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem("bea-home-layout-me")));
async function arrange(page) {
  await page.getByRole("button", { name: "Customize home", exact: true }).click();
  await page.getByRole("button", { name: "Arrange widgets", exact: true }).click();
  await page.getByRole("button", { name: "Done", exact: true }).waitFor();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
}
async function pointerMove(page, from, to, touch = false) {
  const a = await page.getByRole("button", { name: `Move ${from}`, exact: true }).boundingBox();
  const b = await page.getByRole("button", { name: `Move ${to}`, exact: true }).boundingBox();
  const start = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const end = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  if (touch) {
    const client = await page.context().newCDPSession(page);
    await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
    for (let i = 1; i <= 10; i++) await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: start.x + (end.x - start.x) * i / 10, y: start.y + (end.y - start.y) * i / 10 }] });
    await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await client.detach();
  } else {
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();
  }
}
try {
  for (const theme of ["calm", "colorful", "dark"]) {
    const { page, context } = await open(theme);
    await arrange(page);
    const editingSmall = await page.locator('[data-module="saved"]').boundingBox();
    assert.ok(Math.abs(editingSmall.width - editingSmall.height) < 2, `${theme}: small stays square while editing`);
    const initial = await order(page);
    const handle = page.getByRole("button", { name: "Move Saved for this trip", exact: true });
    await handle.focus();
    await page.keyboard.press("Space");
    await page.locator('[data-module="saved"][data-dragging="true"]').waitFor();
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    assert.notDeepEqual(await order(page), initial, `${theme}: keyboard reorder`);
    await pointerMove(page, "Saved for this trip", "Group plans");
    assert.deepEqual(await order(page), initial, `${theme}: mouse reorder`);
    await pointerMove(page, "Saved for this trip", "Group plans", true);
    assert.notDeepEqual(await order(page), initial, `${theme}: touch reorder`);
    await pointerMove(page, "Trips", "Group plans");
    await page.waitForTimeout(150);
    assert.equal((await order(page))[0], "trip", `${theme}: large-to-small reorder follows the handle`);
    await page.getByRole("button", { name: "Move Trips", exact: true }).focus();
    await page.keyboard.press("Space");
    await page.locator('[data-module="trip"][data-dragging="true"]').waitFor();
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(150);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    assert.notEqual((await order(page))[0], "trip", `${theme}: keyboard reorder between different sizes`);
    await handle.focus();
    const beforeCancel = await order(page);
    await page.keyboard.press("Space");
    await page.locator('[data-module="saved"][data-dragging="true"]').waitFor();
    await page.waitForTimeout(150);
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await page.locator('.home-widget[data-dragging="true"]').waitFor({ state: "hidden" });
    assert.deepEqual(await order(page), beforeCancel, `${theme}: cancelled drag`);
    // Restore the same fixture arrangement for comparable theme screenshots.
    await page.evaluate((layout) => {
      const key = "bea-home-layout-me";
      const raw = JSON.stringify(layout);
      localStorage.setItem(key, raw);
      window.dispatchEvent(new StorageEvent("storage", { key, newValue: raw }));
    }, seed);
    await page.getByRole("combobox", { name: "Size of Saved for this trip", exact: true }).selectOption("wide");
    assert.equal((await saved(page)).sizes.saved, "wide");
    await page.getByRole("combobox", { name: "Size of Saved for this trip", exact: true }).selectOption("large");
    assert.equal((await saved(page)).sizes.saved, "large");
    await page.getByRole("combobox", { name: "Size of Saved for this trip", exact: true }).selectOption("small");
    const targets = await page.locator(".home-widget-controls button, .home-widget-controls select").evaluateAll((nodes) => nodes.map((node) => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })));
    assert.ok(targets.every(({ width, height }) => width >= 44 && height >= 44), `${theme}: 44px controls`);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".home-widget-inner").first().evaluate((node) => getComputedStyle(node).animationName), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.waitForFunction(() => getComputedStyle(document.querySelector(".home-widget-inner")).animationName === "home-widget-wiggle");
    assert.equal(await page.locator(".home-widget-inner").first().evaluate((node) => getComputedStyle(node).animationName), "home-widget-wiggle");
    await page.evaluate(() => document.documentElement.dataset.motion = "reduce");
    assert.equal(await page.locator(".home-widget-inner").first().evaluate((node) => getComputedStyle(node).animationName), "none");
    await page.evaluate(() => delete document.documentElement.dataset.motion);
    // Wait for the existing debounced account sync and verify the exact payload.
    await page.waitForFunction(() => window.__writes.some((write) => write.op === "merge" && write.payload.homeLayout && JSON.parse(write.payload.homeLayout).sizes?.saved === "small"));
    await page.evaluate(() => { document.activeElement?.blur(); document.querySelector("main").scrollTo(0, 0); });
    await page.screenshot({ path: join(shots, `${theme}-customize.png`), fullPage: true });
    const raw = await saved(page);
    await page.getByRole("button", { name: "Done", exact: true }).click();
    assert.equal(await page.locator(".home-widget-handle").count(), 0);
    await page.screenshot({ path: join(shots, `${theme}-normal.png`), fullPage: true });
    const small = await page.locator('[data-module="saved"]').boundingBox();
    assert.ok(Math.abs(small.width - small.height) < 2, `${theme}: small is square`);
    await page.reload();
    await page.locator(".home-widget-grid").waitFor();
    assert.deepEqual(await saved(page), raw, `${theme}: layout reload`);
    await page.getByRole("button", { name: "Customize home", exact: true }).click();
    await page.getByRole("switch", { name: "Show Group plans", exact: true }).click();
    assert.equal(await page.locator('[data-module="group"]').count(), 0);
    await page.getByRole("switch", { name: "Show Group plans", exact: true }).click();
    assert.equal((await saved(page)).sizes.group, "small");
    await page.getByRole("button", { name: "Reset to default", exact: true }).click();
    assert.equal(await page.evaluate(() => localStorage.getItem("bea-home-layout-me")), null);
    await context.close();
    console.log(`${theme}: mouse, touch, keyboard, cancel, sizes, switches, persistence, motion and screenshots passed`);
  }
  for (const sample of ["homepage", "homepage-ontrip", "homepage-none"]) {
    for (const width of [320, 390, 768]) {
      const { page, context } = await open("calm", null, sample, width);
      assert.equal(await page.locator(".home-widget-handle").count(), 0);
      assert.ok(await page.locator(".home-widget").count() > 0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, `${sample} ${width}: no horizontal page overflow`);
      await context.close();
    }
  }
  for (const theme of ["calm", "colorful", "dark"]) {
    const { page, context } = await open(theme, { order: keys, on: keys }, "homepage-ontrip", 320);
    await arrange(page);
    for (const [key, sizes] of Object.entries(HOME_WIDGET_SIZES)) {
      const widget = page.locator(`[data-module="${key}"]`);
      const picker = widget.locator("select");
      assert.deepEqual(await picker.locator("option").evaluateAll((options) => options.map((option) => option.value)), sizes);
      for (const size of sizes) {
        await picker.selectOption(size);
        assert.equal(await widget.getAttribute("data-size"), size);
        const clipped = await widget.locator('.home-widget-content > [data-guide^="home-module-"]').evaluateAll((nodes) => nodes.some((node) => node.scrollHeight > node.clientHeight + 1 && !["auto", "scroll"].includes(getComputedStyle(node).overflowY)));
        assert.equal(clipped, false, `${theme}: ${key} ${size} content remains readable`);
      }
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log("All trip states at 320, 390 and 768px and all allowed module sizes passed; no page errors.");
} finally {
  await browser.close();
}
