  page.evaluate(() => ({
    text: document.body.innerText,
    count: document.querySelectorAll("*").length,
    writes: window.__writes.length,
    focus: document.activeElement?.outerHTML.slice(0, 80) ?? "",
    map: Array.from(document.querySelectorAll(".leaflet-map-pane, .leaflet-tile-pane")).map((el) => el.getAttribute("style")).join("|"),
    dialogs: document.querySelectorAll('[role="dialog"], .fixed.inset-0').length,
  }));

const tabs = await (async () => {
  const { page } = await open("default");
  const names = await tabNames(page);
  await page.close();
  return names;
})();
// One page per tab. After a click the page is reloaded only when it may
// have changed underneath the next control: a write to the database, or
// something that did not close with Escape.
for (const tab of tabs) {
  let { page, errors } = await open("default");
  await goTab(page, tab);
  const total = await page.locator(CONTROL).count();
  const reload = async () => {
    await page.close();
    ({ page, errors } = await open("default"));
    await goTab(page, tab);
  };
  for (let i = 0; i < total; i++) {
    const control = page.locator(CONTROL).nth(i);
    if (!(await control.isVisible().catch(() => false))) continue;
    // Hidden from people on purpose (the swipe tray before a swipe opens
    // it): not reachable, so not a control to judge.
    const reachable = await control.evaluate(
      (el) =>
        el.getAttribute("tabindex") !== "-1" &&
        !el.closest('[aria-hidden="true"]') &&
        // Already the current choice: choosing it again rightly does nothing.
        el.getAttribute("aria-selected") !== "true" &&
        el.getAttribute("aria-pressed") !== "true",
    );
    if (!reachable) continue;
    const info = await control.evaluate((el) => ({
      tag: el.tagName,
      label: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("title") || "").trim().slice(0, 50),
      href: el.getAttribute("href"),
      options: el.tagName === "SELECT" ? el.options.length : 0,
      role: el.getAttribute("role"),
      tabName: el.getAttribute("role") === "tab" ? el.textContent.trim() : "",
    }));
    const where = `${tab} › ${info.tag.toLowerCase()} "${info.label}"`;
    if (info.tag === "A" && info.href && info.href !== "#") continue;
    if (info.tag === "SELECT") {
      if (info.options < 2) note(`${where}: select with nothing to choose`);
      continue;
    }
    // Switching to another page tab is covered by the render pass.
    if (info.role === "tab" && tabs.includes(info.tabName) && info.tabName !== tab) continue;
    // Fit must be exercised from a changed camera/selection, not an already fitted map.
    if (info.label === "Fit the whole day") {
      const zoom = page.getByRole("button", { name: "Zoom in", exact: true }).first();
      if (await zoom.count()) await zoom.click();
      await page.waitForTimeout(400);
    }
    const before = await snapshot(page);
    const pressedBefore = await control.getAttribute("aria-pressed").catch(() => null);
    try {
      if (info.label.startsWith("Drag to reorder ")) {
        await control.focus();
        await page.keyboard.press("Space");
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Space");
      } else await control.click({ timeout: 2000 });
    } catch (e) {
      note(`${where}: could not be clicked (${String(e.message).split("\n")[0]})`);
      await reload();
      continue;
    }
    await page.waitForTimeout(300);
    const after = await snapshot(page);
    // A click always focuses what was clicked; that alone is not an effect.
    if (await control.evaluate((el) => el === document.activeElement).catch(() => false)) after.focus = before.focus;
    // A toggle flipping its own aria-pressed is an effect, even when the only
    // visible change is an icon (e.g. "Show where I am" on the day map).
    const pressedAfter = await control.getAttribute("aria-pressed").catch(() => null);
    clicked += 1;
    if (errors.length) {
      note(`${where}: threw ${errors.join(" | ").slice(0, 200)}`);
      errors.length = 0;
    }
    const changed =
      before.text !== after.text || before.count !== after.count || before.writes !== after.writes || before.focus !== after.focus || before.map !== after.map || (pressedBefore !== null && pressedBefore !== pressedAfter);
    if (!changed) note(`${where}: click changed nothing (dead end)`);
    let dirty = after.writes !== before.writes;
    if (after.dialogs > before.dialogs) {
      await page.keyboard.press("Escape");
      await page.waitForTimeout(250);
      const closed = await snapshot(page);
      if (closed.dialogs > before.dialogs) {
        note(`${where}: opened a sheet that Escape does not close`);
        dirty = true;
      }
    }
    if (dirty || (await page.locator(CONTROL).count()) !== total) await reload();
  }
  await page.close();
  console.log(`✓ clicked through ${tab}`);
}

}

// 3. Feature flows, end to end.
async function flow(name, run, sample = "default") {
  if (process.env.PREVIEW_FLOW_FILTER && !name.includes(process.env.PREVIEW_FLOW_FILTER)) return;
  const { page, errors } = await open(sample);
  try {
    await run(page);
    if (errors.length) note(`${name}: threw ${errors.join(" | ").slice(0, 200)}`);
    else console.log(`✓ ${name}`);
  } catch (e) {
    await page.screenshot({ path: join(out, `${previewTheme}-failure-${name.replace(/\W+/g, "-").toLowerCase()}.png`) });
    note(`${name}: ${String(e.message).split("\n").slice(0, 12).join(" ")}`);
  }
  await page.close();
}
const writes = (page) => page.evaluate(() => window.__writes);

await flow("shell: every theme and accent saves, restores and responds to account changes", async (page) => {
  for (const name of ["Dark", "Calm", "Colorful"]) {
    await page.getByRole("radio", { name: new RegExp(`^${name}:`) }).click();
    const live = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, stored: localStorage.getItem("bea-theme") }));
    if (live.theme !== name.toLowerCase() || live.stored !== name.toLowerCase()) throw new Error(`${name} did not apply and save`);
  }
  for (const name of ["Periwinkle", "Pink", "Periwinkle"]) {
    await page.getByRole("radio", { name, exact: true }).click();
    await page.waitForTimeout(900);
    const live = await page.evaluate(() => ({ accent: document.documentElement.dataset.accent, stored: localStorage.getItem("bea-accent") }));
    if (live.accent !== name.toLowerCase() || live.stored !== name.toLowerCase()) throw new Error(`${name} did not apply and save`);
    const ratios = await page.evaluate(() => {
      const tokens = getComputedStyle(document.documentElement);
      const luminance = (hex) => {
        hex = hex.trim();
        if (hex.length === 4) hex = `#${[...hex.slice(1)].map((digit) => digit + digit).join("")}`;
        const rgb = [1, 3, 5].map((i) => parseInt(hex.trim().slice(i, i + 2), 16) / 255).map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
        return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
      };
      const ink = luminance(tokens.getPropertyValue("--primary-foreground"));
      return ["--acc", "--acc2"].map((token) => (luminance(tokens.getPropertyValue(token)) + 0.05) / (ink + 0.05));
    });
    if (ratios.some((ratio) => !Number.isFinite(ratio) || ratio < 4.5)) throw new Error(`${name} button contrast: ${ratios}`);
    if (!(await writes(page)).some((entry) => entry.table === "profiles" && entry.payload?.accent === name.toLowerCase())) throw new Error(`${name} was not sent to the account`);
  }
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (await page.getByRole("radio", { name: "Periwinkle", exact: true }).getAttribute("aria-checked") !== "true") throw new Error("the picker lost the saved accent on remount");
  await page.evaluate(() => {
    localStorage.setItem("bea-accent", "pink");
    window.dispatchEvent(new StorageEvent("storage", { key: "bea-accent", newValue: "pink" }));
  });
  await page.waitForTimeout(100);
  if (await page.getByRole("radio", { name: "Pink", exact: true }).getAttribute("aria-checked") !== "true") throw new Error("the picker missed a synced accent change");
}, "shell");

await flow("shell: brand, back, guide, five tabs and offline status remain reachable", async (page) => {
  const labels = ["Home", "World", "Trips", "Recs", "You"];
  const paths = ["/", "/world", "/trips", "/recommendations", "/profile"];
  for (let i = 0; i < labels.length; i++) {
    const link = page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: labels[i], exact: true });
    if (await link.getAttribute("href") !== paths[i]) throw new Error(`${labels[i]} has the wrong route`);
    await link.click();
    await page.waitForTimeout(400);
    if (await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: labels[i], exact: true }).getAttribute("aria-current") !== "page") throw new Error(`${labels[i]} is not active after navigation`);
  }
  await page.getByRole("link", { name: "Go back home", exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator("header").getByRole("link").first().click();
  await page.waitForTimeout(400);
  const search = page.getByRole("link", { name: "Search your places", exact: true });
  if (await search.getAttribute("href") !== "/recommendations") throw new Error("Home search lost its route");
  await search.click();
  await page.waitForTimeout(400);
  await page.evaluate(() => history.replaceState(null, "", `${location.href}&back=yes`));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Go back", exact: true }).click();
  await page.waitForTimeout(400);
  if (await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link", { name: "Home", exact: true }).getAttribute("aria-current") !== "page") throw new Error("history back did not return Home");
  await page.setViewportSize({ width: 760, height: 900 });
  await page.locator("header").getByRole("link", { name: /Béa, version/ }).click();
  await page.getByText("Travel Buddy", { exact: true }).waitFor({ state: "visible" });
  if (await page.getByText("Travel Buddy", { exact: true }).count() !== 1) throw new Error("the desktop support label disappeared");
  await page.setViewportSize({ width: 414, height: 900 });
  const guide = page.getByRole("button", { name: /guide|help/i }).first();
  await guide.click();
  if (await page.getByRole("dialog").count() !== 1) throw new Error("the page guide did not open");
  await page.keyboard.press("Escape");
  await page.context().setOffline(true);
  await page.getByRole("img", { name: "Offline", exact: true }).waitFor();
  if (await page.getByRole("img", { name: "Offline", exact: true }).count() !== 1) throw new Error("the offline indicator disappeared");
  if (await page.getByRole("status").filter({ hasText: "You're offline" }).count() !== 1) throw new Error("the offline explanation disappeared");
  await page.context().setOffline(false);
}, "shell");
