// Preview-only: node dev/next/shoot.mjs <url> <out.png> [width] [height] [fullPage] [waitMs]
import { chromium } from "playwright-core";
const [, , url, out, w = "390", h = "844", full = "0", wait = "2500"] =
  process.argv;
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
});
const page = await browser.newPage({
  viewport: { width: +w, height: +h },
  deviceScaleFactor: 2,
});
const seen = new Set();
page.on("console", (m) => {
  if (m.type() !== "error" && m.type() !== "warning") return;
  const t = m.text().slice(0, 300);
  if (!seen.has(t)) (seen.add(t), console.log(`console.${m.type()}:`, t));
});
page.on("pageerror", (e) => console.log("pageerror:", e.message));
page.on("requestfailed", (r) => console.log("failed:", r.url().slice(0, 120)));
page.on(
  "response",
  (r) =>
    r.status() >= 400 && console.log("http", r.status(), r.url().slice(0, 120)),
);
await page.goto(url, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(+wait);
await page.screenshot({ path: out, fullPage: full === "1" });
await browser.close();
