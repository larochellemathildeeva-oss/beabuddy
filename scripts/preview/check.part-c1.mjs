
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
  if (!text.includes("Peace Park / Atomic Bomb Dome / Cenotaph (\u539f\u7206\u30c9\u30fc\u30e0)")) throw new Error(`name cut off: ${text}`);
});
