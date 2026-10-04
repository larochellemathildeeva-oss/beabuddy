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
{
  const name = "companion: a time to leave by, no planned stay, no journey rows as stops";
  const { page, errors } = await open("legs");
  try {
    await goTab(page, "Companion");
    const day1 = page.getByRole("tab", { name: /Day 1/ });
    if (await day1.count()) await day1.first().click();
    await page.waitForTimeout(800);
    if ((await page.getByText("Plan to stay").count()) !== 0) throw new Error("Plan to stay is still offered");
    if ((await page.getByText(/Leave by \d|Be there by \d/).count()) === 0) throw new Error("no Leave by / Be there by chip");
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
{
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
{
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
    if ((await page.getByText(/Leave by \d/).count()) === 0) throw new Error("no Leave by");
    if (errors.length) throw new Error(errors.join(" | "));
    console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
{
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

{
  const name = "home: upcoming trip shows real flight, packing and planning links";
  const { page, errors } = await open("home");
  try {
    for (const text of ["Upcoming trip", "in 2 days", "AC781", "YUL → LAX", "67%", "Where to next?", "Suggested for your trip"]) {
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
