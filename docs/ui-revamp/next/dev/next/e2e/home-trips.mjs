// Preview-only e2e for /next (Home) and /trips/next (Trips) on the sample data.
//   python3 -m http.server -d next-preview 8765 &   then   node dev/next/e2e/home-trips.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:8765/";
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? "/usr/bin/google-chrome",
});
let failed = 0;
const ok = (c, m) => {
  console.log(c ? "PASS" : "FAIL", m);
  if (!c) failed++;
};
async function open(query, height = 844) {
  const page = await browser.newPage({ viewport: { width: 390, height } });
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(`${BASE}?${query}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  return page;
}
const stored = (page, key) =>
  page.evaluate((k) => localStorage.getItem(k), key);
const KEY = "bea-home-next-layout-ontrip-u-preview";

// ── Home, on a trip ────────────────────────────────────────────────────────
let p = await open("screen=home&home=ontrip&trip=alps&theme=calm");
ok(
  (await p.locator(".aerial").first().getAttribute("data-terrain")) ===
    "relief",
  "on trip: empty terrain slot falls back to the relief tiles",
);
ok(
  (await p.locator("circle.aerial-here").count()) === 1,
  "on trip: the stop you are in (a Companion tap) is ringed",
);
ok(
  await p.getByText("Alps Road Trip.").isVisible(),
  "on trip: the trip's name as the title",
);
ok(
  await p.getByText("On trip · Day 3 of 7").isVisible(),
  "on trip: Day 3 of 7 kicker",
);
ok(await p.getByText("Current stop").isVisible(), "on trip: Current stop card");
ok(await p.getByText("Next stop").isVisible(), "on trip: Next stop card");
ok(await p.getByText("3/5").isVisible(), "on trip: stops chip 3/5");
ok(
  (await p.locator('a[href="/trips/t-main"]').count()) > 0,
  "on trip: cards open the trip",
);

// Customize: the sheet, state tabs, toggle, move, reset
await p.click('[data-guide="customize-home"]');
await p.waitForTimeout(500);
ok(
  await p.getByRole("tablist", { name: "Which moment" }).isVisible(),
  "customize: sheet opens with the three moments",
);
ok(
  (await p
    .getByRole("tab", { name: /On a trip/ })
    .getAttribute("aria-selected")) === "true",
  "customize: opens on the moment Home is in",
);
const nowCards = () => p.locator('[data-guide="home-module-now"]').count();
const before = await nowCards();
await p.getByRole("switch", { name: "Show Right now there" }).click();
await p.waitForTimeout(200);
ok(
  JSON.parse((await stored(p, KEY)) ?? "{}").on?.includes("now") === !before,
  "customize: toggling a module saves this moment's list on the device",
);
ok((await nowCards()) !== before, "customize: the module shows/hides at once");
const order0 = JSON.parse(await stored(p, KEY)).order;
ok(
  await p.getByRole("button", { name: /Move Trips up/ }).isDisabled(),
  "customize: nothing moves above Current / Next stop (fixed)",
);
await p.getByRole("button", { name: /Move Weather here up/ }).click();
await p.waitForTimeout(200);
const order1 = JSON.parse(await stored(p, KEY)).order;
ok(
  order1.indexOf("weather") < order1.indexOf("trip") &&
    order0.indexOf("weather") > order0.indexOf("trip"),
  "customize: arrows reorder",
);
ok(order1[0] === "stops", "customize: Current / Next stop stays first");
await p.getByRole("tab", { name: /No trip/ }).click();
await p.waitForTimeout(200);
ok(
  await p.getByRole("switch", { name: "Show Saved places" }).isVisible(),
  "customize: another moment's list is a tap away",
);
ok(
  (await p.getByRole("switch", { name: "Show Right now there" }).count()) === 0,
  "customize: a moment lists only its own modules",
);
await p.getByRole("tab", { name: /On a trip/ }).click();
await p.getByRole("button", { name: /^Reset/ }).click();
await p.waitForTimeout(200);
ok(
  (await stored(p, KEY)) === null,
  "customize: Reset forgets this moment's list",
);
ok(p.errors.length === 0, `on trip: no page errors ${p.errors.join(" | ")}`);
await p.close();

// ── Home, upcoming / none / terrain slot ───────────────────────────────────
p = await open("screen=home&home=upcoming&trip=italy&theme=colorful");
ok(
  (await p.locator(".hn-bubble").count()) >= 2,
  "upcoming: city bubbles over the map",
);
ok(
  (await p.locator('a[href="/trips/t-main?prep=todo"]').count()) === 1,
  "upcoming: to-dos stat opens the trip's to-dos",
);
ok(
  (await p.locator('a[href="/trips/t-main?prep=packing"]').count()) === 1,
  "upcoming: packing stat opens packing",
);
ok(
  await p.getByText("Suggested for your trip").isVisible(),
  "upcoming: Suggested kept",
);
ok(p.errors.length === 0, "upcoming: no page errors");
await p.close();
p = await open("screen=home&home=none&theme=dark");
ok(
  await p.getByText("Where to next?").isVisible(),
  "no trip: Where to next? over saved cities",
);
ok(
  (await p.locator('.hn-tag[href="/recommendations"]').count()) >= 1,
  "no trip: heart tags open Recs",
);
ok(
  await p.getByRole("heading", { name: "Waiting for a trip" }).isVisible(),
  "no trip: Waiting for a trip kept",
);
await p.close();
p = await open("screen=home&home=ontrip&trip=japan&theme=dark&terrain=demo");
ok(
  (await p.locator(".aerial").first().getAttribute("data-terrain")) ===
    "terrain",
  "terrain slot: a registered picture is used, stops drawn on it",
);
await p.close();

// ── Trips ──────────────────────────────────────────────────────────────────
p = await open("screen=trips&theme=calm&layout=big&picture=stops", 1400);
ok(
  await p.getByRole("heading", { name: "Your trips." }).isVisible(),
  "trips: title over the aerial header",
);
ok(
  (await p.locator(".tn-tag").count()) >= 3,
  "trips: a tag per place (Rome, Reykjavík, New York…)",
);
ok(
  (await p.locator("path.tn-trail").count()) === 1,
  "trips: dashed flight trail",
);
ok(
  await p.locator('[data-guide="plan-with-bea"]').isVisible(),
  "trips: Plan with Béa tile",
);
ok(
  (await p.locator('a[href="/profile/documents"]').count()) === 1,
  "trips: Trip documents link kept (Upcoming)",
);
await p.click('[data-guide="join-trip"]');
await p.waitForTimeout(300);
ok(
  (await p
    .locator('[data-guide="join-trip"]')
    .getAttribute("aria-expanded")) === "true",
  "trips: Join with a code opens its form",
);
await p.keyboard.press("Escape");
await p.waitForTimeout(400);
await p.getByRole("button", { name: "List" }).click();
await p.waitForTimeout(300);
ok(
  (await stored(p, "bea-trips-layout")) === "list",
  "trips: List layout saved on the device",
);
await p.getByRole("button", { name: /Photo/ }).click();
await p.waitForTimeout(300);
ok(
  (await stored(p, "bea-trip-picture")) === "photo",
  "trips: Photo pictures saved on the device",
);
await p.getByRole("button", { name: /More for Iceland Road Trip/ }).click();
await p.waitForTimeout(200);
const items = await p.getByRole("menuitem").allTextContents();
ok(
  ["Open", "To-dos", "Packing", "Bookings"].every((t) =>
    items.some((i) => i.includes(t)),
  ),
  `trips: row ⋯ menu → ${items.join(", ")}`,
);
await p.keyboard.press("Escape");
await p.getByRole("tab", { name: "Past" }).click();
await p.waitForTimeout(300);
ok(
  await p.getByText("Paris weekend").first().isVisible(),
  "trips: Past tab lists past trips",
);
await p.getByRole("button", { name: "New trip" }).click();
await p.waitForTimeout(500);
ok((await p.locator("input").count()) > 0, "trips: New trip opens its form");
ok(p.errors.length === 0, `trips: no page errors ${p.errors.join(" | ")}`);
await p.close();

await browser.close();
console.log(failed ? `${failed} FAILED` : "all passed");
process.exitCode = failed ? 1 : 0;
