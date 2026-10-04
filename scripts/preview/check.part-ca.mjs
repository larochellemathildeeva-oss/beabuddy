
await flow("stop card: one editor opens, saves and closes", async (page) => {
  await goTab(page, "Timeline");
  const front = page.getByRole("button", { name: /tap to edit$/ }).first();
  const box = await front.boundingBox();
  // Names wrap rather than cut off, so a long one takes a second or third line.
  if (!box || box.height > 130) throw new Error(`card front is ${box?.height}px tall, not compact`);
  const before = await page.getByRole("button", { name: /tap to edit$/ }).count();
  await front.click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("textbox", { name: "Name" }).count()) !== 1) throw new Error("the back has no name field");
  if ((await page.getByRole("dialog").count()) !== 1) throw new Error("more than one editor opened");
  await page.getByRole("textbox", { name: "Name" }).fill("Renamed stop");
  await page.getByRole("dialog").getByRole("button", { name: "Done", exact: true }).click();
  await page.waitForTimeout(300);
  const w = (await writes(page)).find((x) => x.op === "update" && x.payload?.title === "Renamed stop");
  if (!w) throw new Error("renaming on the back did not save");
  if ((await page.getByRole("button", { name: /tap to edit$/ }).count()) !== before) throw new Error("Done did not turn the card back");
  // Every action on the back writes something.
  for (const name of [/^Mark .* done$/, /^Save .* to your places$/, /^Delete /]) {
    const n = (await writes(page)).length;
    await page.getByRole("button", { name: /tap to edit$/ }).first().click();
    await page.getByRole("dialog").getByRole("button", { name }).first().click();
    await page.waitForTimeout(400);
    if ((await writes(page)).length === n) throw new Error(`${name} on the back wrote nothing`);
    await page.mouse.move(0, 0);
    await page.keyboard.press("Escape");
  }
});

await flow("timeline editor: move a stop later and save its order", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "Edit the itinerary", exact: true }).click();
  const before = (await writes(page)).length;
  await page.getByRole("button", { name: /^Move .* later$/ }).first().click();
  await page.waitForTimeout(400);
  const apply = page.getByRole("button", { name: "Apply changes", exact: true });
  if (await apply.isVisible()) {
    if ((await writes(page)).length !== before) throw new Error("the order changed before confirmation");
    await apply.click();
    await page.waitForTimeout(400);
  }
  if (!(await writes(page)).slice(before).some((entry) => entry.op === "update" && typeof entry.payload?.position === "number")) throw new Error("the order was not saved");
});

await flow("timeline: Not visited hides done stops, All brings them back", async (page) => {
  await goTab(page, "Timeline");
  const cards = () => page.getByRole("button", { name: /tap to edit$/ }).count();
  const all = await cards();
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: /^Not visited/ }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const open = await cards();
  if (open >= all) throw new Error("Not visited hid nothing (the sample has a done stop)");
  // Done is on the card's front now, as in the prototype.
  await page.getByRole("button", { name: /^Actions for / }).first().click();
  await page.getByRole("button", { name: /^Mark .* done$/ }).first().click();
  await page.waitForTimeout(500);
  if ((await cards()) !== open - 1) throw new Error("a stop marked done stayed on the Not visited list");
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "All", exact: true }).click();
  await page.keyboard.press("Escape");
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
  await page.getByRole("button", { name: /^Import a plan/ }).click();
  await page.getByRole("textbox", { name: "Paste your plan" }).fill("Day 1: breakfast at the station 8-8:45, shrine at 10 for 90 min, lunch at Kakiya, evening stroll");
  await page.getByRole("button", { name: "Import plan", exact: true }).click();
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
  await page.getByRole("button", { name: /^Import a plan/ }).click();
  await page.getByRole("textbox", { name: "Paste your plan" }).fill("Day 1: breakfast, shrine, lunch, stroll");
  await page.getByRole("button", { name: "Import plan", exact: true }).click();
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

await flow("companion: tapping the ribbon or the tracker shows that stop, current stop stays", async (page) => {
  await page.getByRole("button", { name: "Trip menu", exact: true }).click();
  await page.getByRole("button", { name: /Customize view/ }).click();
  const ribbonSwitch = page.getByRole("switch", { name: /Itinerary ribbon/ });
  if ((await ribbonSwitch.getAttribute("aria-checked")) !== "true") await ribbonSwitch.click();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.waitForTimeout(300);
  const nowBefore = await page.getByText(/^Now:/).locator("..").innerText().catch(() => "");
  await page.getByRole("button", { name: /Lunch: Kakiya — show this stop/ }).first().click();
  await page.waitForTimeout(200);
  if ((await page.getByRole("region", { name: /Stop \d+: Lunch: Kakiya/ }).count()) !== 1)
    throw new Error("tapping a ribbon card did not show the stop");
  const pressed = await page.getByRole("button", { name: /Lunch: Kakiya, .* — show this stop/ }).getAttribute("aria-pressed");
  if (pressed !== "true") throw new Error("the tracker does not mark the same stop");
  const nowAfter = await page.getByText(/^Now:/).locator("..").innerText().catch(() => "");
  if (nowBefore !== nowAfter) throw new Error("looking at a stop moved Now");
  await page.getByRole("button", { name: /Omotesando food crawl, .* — show this stop/ }).click();
  if ((await page.getByRole("region", { name: /Stop \d+: Omotesando food crawl/ }).count()) !== 1)
    throw new Error("tapping a tracker dot did not show that stop");
  await page.getByRole("button", { name: "Back to now" }).click();
  if ((await page.getByRole("region", { name: /^Stop \d+:/ }).count()) !== 0) throw new Error("Back to now did not close it");
});

await flow("timeline editor: neighbourhood groups the day by area", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.getByRole("button", { name: "Timeline options", exact: true }).first().click();
  await page.getByRole("button", { name: "Neighbourhood" }).click();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const heading = (area) => page.locator("li").filter({ hasText: new RegExp(`^${area} · \\d+ stops?$`) });
  for (const area of ["Naka Ward", "Miyajima Omotesando", "No place yet"]) {
