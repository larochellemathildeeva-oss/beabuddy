// Preview-only: every screen × mood → PNGs.  node dev/next/shoot-all.mjs [base] [outDir]
// Serve next-preview/ first (python3 -m http.server -d next-preview 8765).
import { chromium } from "playwright-core";
const base = process.argv[2] ?? "http://localhost:8765/";
const out = process.argv[3] ?? "/workspace";
const MOODS = ["calm", "colorful", "dark"];
const TRIP = { calm: "alps", colorful: "italy", dark: "japan" };
const shots = [];
for (const m of MOODS) {
  const t = TRIP[m];
  shots.push([
    `bea-home-upcoming-${m}`,
    `screen=home&home=upcoming&trip=${t}&theme=${m}`,
    844,
  ]);
  shots.push([
    `bea-home-ontrip-${m}`,
    `screen=home&home=ontrip&trip=${t}&theme=${m}`,
    844,
  ]);
  shots.push([`bea-home-notrip-${m}`, `screen=home&home=none&theme=${m}`, 844]);
  shots.push([
    `bea-home-modules-${m}`,
    `screen=home&home=ontrip&trip=${t}&theme=${m}&modules=all`,
    2900,
  ]);
  shots.push([
    `bea-home-customize-${m}`,
    `screen=home&home=ontrip&trip=${t}&theme=${m}`,
    844,
    "customize",
  ]);
  shots.push([
    `bea-home-upcoming-${m}-terrain-slot`,
    `screen=home&home=upcoming&trip=${t}&theme=${m}&terrain=demo`,
    844,
  ]);
  shots.push([
    `bea-home-ontrip-${m}-terrain-slot`,
    `screen=home&home=ontrip&trip=${t}&theme=${m}&terrain=demo`,
    844,
  ]);
  for (const layout of ["big", "list"])
    for (const picture of ["stops", "photo"])
      shots.push([
        `bea-trips-${layout}-${picture}-${m}`,
        `screen=trips&theme=${m}&layout=${layout}&picture=${picture}`,
        1500,
      ]);
  shots.push([
    `bea-trips-big-stops-${m}-terrain-slot`,
    `screen=trips&theme=${m}&layout=big&picture=stops&terrain=demo`,
    1500,
  ]);
}
const only = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
});
for (const [name, query, height, action] of shots) {
  if (only && !only.test(name)) continue;
  const page = await browser.newPage({
    viewport: { width: 390, height },
    deviceScaleFactor: 2,
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}?${query}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(2200);
  if (action === "customize") {
    await page.click('[data-guide="customize-home"]');
    await page.waitForTimeout(900);
  }
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log(name, errors.length ? `ERRORS: ${errors.join(" | ")}` : "ok");
  await page.close();
}
await browser.close();
