
await flow("shell: phone widths and larger reading text keep labels and tap targets", async (page) => {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.evaluate(() => document.documentElement.style.setProperty("--text-scale", "1.35"));
    const problems = await page.evaluate(() => {
      const visible = (el) => el.getClientRects().length > 0;
      const small = [...document.querySelectorAll("header span, h1, p, [role=radio], nav a span")].filter(visible).filter((el) => parseFloat(getComputedStyle(el).fontSize) < 13);
      const short = [...document.querySelectorAll("header a, header button, nav a, [role=radio]")].filter(visible).filter((el) => el.getBoundingClientRect().height < 44 || el.getBoundingClientRect().width < 44);
      return { small: small.map((el) => el.textContent), short: short.map((el) => el.textContent || el.getAttribute("aria-label")), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    if (problems.small.length || problems.short.length || problems.overflow) throw new Error(`${width}px: ${JSON.stringify(problems)}`);
    const version = page.locator("header span").filter({ hasText: /^v\d+\.\d+\.\d+$/ });
    if (await version.isVisible() !== (width >= 390)) throw new Error(`${width}px: version visibility changed`);
  }
}, "shell");

await flow("shell: short pages stay stable and moderate overflow still compresses", async (page) => {
  for (const width of [320, 390]) for (const scale of [1, 1.35]) for (const overflow of [50, 100]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate((scale) => {
      document.documentElement.style.setProperty("--text-scale", String(scale));
      document.querySelector("main").scrollTop = 0;
      document.querySelector("[data-preview-spacer]").style.height = "1100px";
    }, scale);
    await page.waitForTimeout(250);
    const range = await page.evaluate((overflow) => {
      const main = document.querySelector("main");
      const spacer = document.querySelector("[data-preview-spacer]");
      spacer.style.height = "0px";
      const style = getComputedStyle(main);
      spacer.style.height = `${main.clientHeight + overflow - main.firstElementChild.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom)}px`;
      window.__compressionChanges = [];
      window.__compressionObserver?.disconnect();
      window.__compressionObserver = new MutationObserver((mutations) => window.__compressionChanges.push(...mutations.map((m) => m.oldValue)));
      window.__compressionObserver.observe(document.querySelector("[data-compressed]") ?? document.querySelector("h1").closest(".group"), { attributes: true, attributeFilter: ["data-compressed"], attributeOldValue: true });
      main.scrollTop = overflow;
      return main.scrollHeight - main.clientHeight;
    }, overflow);
    if (Math.abs(range - overflow) > 1) throw new Error(`scroll fixture has ${range}px overflow`);
    await page.waitForTimeout(1000);
    const changes = await page.evaluate(() => window.__compressionChanges);
    const compressed = await page.locator("[data-compressed]").count();
    if (overflow === 50 ? changes.length || compressed : changes.length !== 1 || compressed !== 1) throw new Error(`${width}px at ${scale}, ${overflow}px overflow: header toggled ${changes.length} times, compressed=${compressed}`);
  }
}, "shell");

await flow("shell: a null account accent resets visually without storing or uploading Pink", async (page) => {
  await page.getByRole("radio", { name: "Periwinkle", exact: true }).click();
  await page.waitForTimeout(900);
  await page.goto("https://preview.test/?sample=shell&reset-accent=yes", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await page.waitForTimeout(1000);
  const result = await page.evaluate(() => ({ accent: document.documentElement.dataset.accent, stored: localStorage.getItem("bea-accent"), uploaded: window.__writes.some((w) => w.table === "profiles" && w.payload?.accent === "pink") }));
  if (result.accent !== "pink" || result.stored !== null || result.uploaded) throw new Error(`account accent reset: ${JSON.stringify(result)}`);
}, "shell");

await flow("shell: compressed long titles stay on one line in both header layouts", async (page) => {
  const title = "Places worth remembering on a long journey through several cities.";
  for (const beside of [false, true]) {
    await page.goto(`https://preview.test/?sample=shell&path=%2Fprofile&title=${encodeURIComponent(title)}${beside ? "&beside=yes" : ""}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("heading", { level: 1, name: title }).waitFor();
    for (const scale of [1, 1.35]) {
      await page.setViewportSize({ width: 320, height: 844 });
      await page.evaluate((scale) => {
        document.documentElement.style.setProperty("--text-scale", String(scale));
        document.querySelector("main").scrollTop = 0;
      }, scale);
      await page.waitForTimeout(250);
      const expanded = await page.locator("h1").boundingBox();
      await page.locator("main").evaluate((el) => el.scrollTop = el.scrollHeight);
      await page.locator("[data-compressed]").waitFor();
      await page.waitForTimeout(300);
      const compact = await page.locator("h1").evaluate((el) => {
        const css = getComputedStyle(el);
        return { height: el.getBoundingClientRect().height, lineHeight: parseFloat(css.lineHeight), whiteSpace: css.whiteSpace, ellipsis: css.textOverflow, overflow: el.scrollWidth > el.clientWidth, text: el.textContent };
      });
      if (compact.height > compact.lineHeight + 1 || compact.whiteSpace !== "nowrap" || compact.ellipsis !== "ellipsis" || !compact.overflow || compact.text !== title || compact.height >= expanded.height) throw new Error(`long-title layout: ${JSON.stringify(compact)}`);
    }
  }
}, "shell");

await flow("shell: text tokens cover hover, opacity, sequence and dark error contrast", async (page) => {
  let previousSearchTint;
  for (const accent of ["Pink", "Periwinkle"]) {
    await page.getByRole("radio", { name: accent, exact: true }).click();
    await page.evaluate(() => {
      document.querySelector("[data-color-probes]")?.remove();
      const probes = document.createElement("div");
      probes.dataset.colorProbes = "";
      probes.className = "bg-elevated";
      for (const cls of ["text-primary", "text-primary/85", "text-foreground hover:text-primary", "text-destructive", "text-muted-foreground", "seq-text-1", "seq-1"]) {
        const el = document.createElement("p");
        el.className = cls;
        el.textContent = cls;
        probes.append(el);
      }
      const map = document.createElement("div");
      map.className = "journal-map";
      for (const tone of ["", "journal-pin--nested", "journal-pin--food", "journal-pin--transit", "journal-pin--stay"]) for (const selected of ["", "journal-pin--on"]) {
        const pin = document.createElement("p");
        pin.className = `journal-pin ${tone} ${selected}`;
        pin.textContent = "1";
        map.append(pin);
      }
      probes.append(map);
      const search = document.createElement("span");
      search.dataset.searchTint = "";
      search.style.backgroundColor = "var(--home-search)";
      probes.append(search);
      document.querySelector("main").prepend(probes);
    });
    await page.locator("[data-color-probes] p").nth(2).hover();
    // Wait for :hover to actually repaint the probe before reading colours —
    // under parallel load the hover can lag the getComputedStyle read, which
    // otherwise reports the un-hovered colour. A real token miss still fails
    // here (the wait times out and throws), it just stops flaking.
    await page.waitForFunction(() => {
      const ps = document.querySelectorAll("[data-color-probes] p");
      return ps.length > 2 && getComputedStyle(ps[0]).color === getComputedStyle(ps[2]).color;
    });
    const results = await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 1;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      const rgb = (ink, ground) => {
        ctx.clearRect(0, 0, 1, 1);
        ctx.fillStyle = ground;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillStyle = ink;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const lum = (rgb) => rgb.map((c) => c / 255).map((c) => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4).reduce((n, c, i) => n + c * [0.2126, 0.7152, 0.0722][i], 0);
      const ground = getComputedStyle(document.querySelector("[data-color-probes]")).backgroundColor;
      const b = lum(rgb(ground, ground));
      return [...document.querySelectorAll("[data-color-probes] p")].map((el) => {
        const color = getComputedStyle(el).color;
        const ownBackground = getComputedStyle(el).backgroundColor;
        const surface = ownBackground === "rgba(0, 0, 0, 0)" ? ground : ownBackground;
        const bg = ownBackground === "rgba(0, 0, 0, 0)" ? b : lum(rgb(surface, ground));
        const f = lum(rgb(color, surface));
        return { cls: el.className, ratio: (Math.max(bg, f) + 0.05) / (Math.min(bg, f) + 0.05), color };
      });
    });
    const bad = results.filter((r) => r.ratio < 4.5);
    if (bad.length) throw new Error(`${accent} text contrast: ${JSON.stringify(bad)}`);
    if (results[0].color !== results[2].color) throw new Error("hover:text-primary missed the text token");
    const searchTint = await page.locator("[data-search-tint]").evaluate((el) => getComputedStyle(el).backgroundColor);
    if (previewTheme === "colorful" && searchTint === previousSearchTint) throw new Error("the Colorful search tint did not follow the accent");
    previousSearchTint = searchTint;
    console.log(`  ${accent} text contrast: ${results.map((r) => `${r.cls}=${r.ratio.toFixed(2)}`).join(", ")}`);
  }
}, "shell");

await flow("trip shell: four views, device positions and sticky bars keep the main navigation clear", async (page) => {
  await page.goto("https://preview.test/?sample=default&frame=yes&path=/trips/t1");
  const bar = page.getByRole("tablist", { name: "How to look at this trip" });
  await bar.waitFor();
  if (JSON.stringify(await tabNames(page)) !== JSON.stringify(["Overview", "Companion", "Map", "Timeline"])) throw new Error("wrong trip views");
  for (const position of ["top", "bottom", "side"]) {
    await page.getByRole("button", { name: "Trip menu", exact: true }).click();
    await page.getByRole("button", { name: /Customize view/ }).click();
    await page.getByRole("group", { name: "Views bar position" }).getByRole("button", { name: new RegExp(`^${position}$`, "i") }).click();
    await page.getByRole("button", { name: "Close the trip menu" }).click();
    if (await page.evaluate(() => localStorage.getItem("bea-trip-tabs")) !== position) throw new Error("position did not save");
    if ((await writes(page)).some((w) => w.payload?.patch?.tripTabs)) throw new Error("device position uploaded to account");
    await page.reload();
    await page.locator(`[data-trip-bar="${position}"]`).waitFor();
    for (const name of ["Overview", "Companion", "Map", "Timeline"]) await goTab(page, name);
    await page.locator('[data-scroll-restoration-id="app-main"]').evaluate((el) => { el.scrollTop = 700; });
    await page.waitForTimeout(250);
    const geometry = await page.evaluate(() => {
      const r = document.querySelector("[data-trip-bar]").getBoundingClientRect();
      const main = document.querySelector('[data-scroll-restoration-id="app-main"]').getBoundingClientRect();
      const nav = document.querySelector('nav[aria-label="Main"]').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, mainTop: main.top, navTop: nav.top, width: innerWidth };
    });
    if (geometry.bottom > geometry.navTop || geometry.left < 0 || geometry.right > geometry.width || geometry.top < geometry.mainTop - 1) throw new Error(`${position} bad bounds: ${JSON.stringify(geometry)}`);
  }
  if ((await page.getByRole("navigation", { name: "Main", exact: true }).getByRole("link").count()) !== 5) throw new Error("lost global tabs");
});

await flow("trip shell: Bookings stays inside Overview with filters and booking saves", async (page) => {
  await goTab(page, "Overview");
  await page.getByRole("region", { name: "Bookings", exact: true }).getByRole("button", { name: /All bookings/ }).click();
  const bookings = page.getByRole("region", { name: "Bookings", exact: true });
  for (const name of ["Flights", "Stays", "Transport", "Activities", "All"]) await bookings.getByRole("button", { name, exact: true }).click();
  if (await page.getByRole("tab", { name: "Bookings", exact: true }).count()) throw new Error("Bookings is still a fifth view");
  await page.getByRole("button", { name: "Trip menu", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: /^Flights/ }).click();
  if (await page.getByRole("tab", { name: "Overview", exact: true }).getAttribute("aria-selected") !== "true") throw new Error("menu booking did not open Overview");
  if (await bookings.getByRole("button", { name: "Flights", exact: true }).getAttribute("aria-pressed") !== "true") throw new Error("lost booking kind");
  await page.evaluate(() => localStorage.setItem("bea-trip-page-t1", JSON.stringify({ perspective: "bookings" })));
  await page.reload();
  await page.waitForTimeout(500);
  if (await page.getByRole("tab", { name: "Overview", exact: true }).getAttribute("aria-selected") !== "true" || !await bookings.getByRole("button", { name: "All", exact: true }).isVisible()) throw new Error("legacy booking preference was lost");
});

await flow("trip shell: day tracker opens a stop from every day view", async (page) => {
  for (const name of ["Companion", "Map", "Timeline"]) {
    await goTab(page, name);
    const day = page.getByRole("tab", { name: /Day 1/ });
    if (await day.count()) await day.first().click();
    const tracker = page.getByRole("region", { name: "Today's progress" });
    await tracker.getByRole("button").first().click();
    await page.getByRole("button", { name: "Back to now" }).waitFor();
    await page.getByRole("button", { name: "Back to now" }).click();
  }
});

await flow("booking: mark booked with a reference", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: /tap to edit$/ }).first().click();
  await page.getByRole("button", { name: /^Booking for / }).first().click();
  await page.getByRole("switch").first().click();
  await page.getByPlaceholder("Confirmation or ticket number").fill("MBAM-4471");
  await page.getByRole("button", { name: "Save booking" }).click();
  await page.waitForTimeout(400);
  const w = (await writes(page)).find((x) => x.op === "update" && x.payload?.booking_ref === "MBAM-4471");
  if (!w || w.payload.booked !== true) throw new Error("no booked update with the reference was written");
  if ((await page.getByText(/✓ Booked · MBAM-4471/).count()) === 0) throw new Error("card back shows no booking");
  await page.getByRole("button", { name: /^Close / }).first().click();
  const bookedCard = page.getByRole("button", { name: /tap to edit$/ }).first().locator("xpath=ancestor::li[1]");
  if ((await bookedCard.getByText("Booked", { exact: true }).count()) === 0) throw new Error("card front shows no Booked mark");
});

await flow("saved places: add one to the chosen day", async (page) => {
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /Day 1/ }).first().click();
  await page.getByRole("button", { name: /Add stop/ }).first().click();
  await page.getByRole("button", { name: /^From Saved/ }).click();
  await page.locator("li", { hasText: "Nagata-ya" }).getByRole("button").click();
  await page.waitForTimeout(400);
  const w = (await writes(page)).find((x) => x.table === "itinerary_items" && x.op === "insert");
  if (!w) throw new Error("nothing was added to the itinerary");
  if (w.payload.day_date !== "2026-10-07") throw new Error(`added to ${w.payload.day_date}, not the chosen day`);
  const added = page.locator("li", { hasText: "Nagata-ya" }).getByRole("button", { name: "Added", exact: true });
  if (!await added.isDisabled()) throw new Error("Added did not retain its disabled state");
  const green = await added.evaluate((el) => {
    const probe = document.createElement("span");
    probe.className = "text-nexttime";
    el.parentElement.append(probe);
    const matches = getComputedStyle(el).color === getComputedStyle(probe).color;
    probe.remove();
    return matches;
  });
  if (!green) throw new Error("text-primary overrides disabled:text-nexttime on Added");
});

await flow("trip actions: To do, Add stop to the itinerary, Offline and Customize in Settings", async (page) => {
  if ((await page.getByRole("tab", { name: "Trip", exact: true }).count()) !== 0) throw new Error("the Trip tab is still there");
  if ((await page.getByRole("button", { name: "Optimize route" }).count()) !== 0) throw new Error("Optimize route is still in the bar");
  if ((await page.getByRole("button", { name: /^To do$/ }).count()) === 0) throw new Error("no To do button");
  await page.getByRole("button", { name: /Add stop/ }).first().click();
  await page.getByRole("button", { name: /^A stop on the itinerary/ }).click();
  await page.waitForTimeout(500);
  if ((await page.getByRole("tab", { name: "Timeline", exact: true }).getAttribute("aria-selected")) !== "true")
    throw new Error("Add stop did not open the Timeline");
  if ((await page.getByText("Add to the timeline").count()) === 0) throw new Error("Add stop did not open the add form");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Trip menu", exact: true }).first().click();
  await page.waitForTimeout(400);
  for (const label of ["Offline maps", "Destinations", "Customize view"]) {
    if ((await page.getByRole("button", { name: new RegExp(label) }).count()) === 0) throw new Error(`Settings has no ${label}`);
  }
  await page.getByRole("button", { name: /Customize view/ }).click();
  await page.waitForTimeout(300);
  if ((await page.getByRole("switch").count()) === 0) throw new Error("Customize switches missing in Settings");
});

await flow("locate on map: opens Map Split on that stop", async (page) => {
  await goTab(page, "Timeline");
  await page.getByRole("button", { name: /Peace Memorial Museum.*tap to edit$/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Locate Peace Memorial Museum on the map", exact: true }).click();
  await page.waitForTimeout(700);
  const on = await page.getByRole("tab", { name: "Map", exact: true }).getAttribute("aria-selected");
  if (on !== "true") throw new Error("Map Split did not open");
  if ((await page.getByRole("button", { name: /Peace Memorial Museum|09:30/, pressed: true }).count()) === 0)
    throw new Error("the located stop is not the one selected");
});

await flow("companion: pick a day from the prompt itself", async (page) => {
  await goTab(page, "Companion");
  await page.getByRole("tab", { name: /^All.*Trip$/ }).first().click();
  await page.waitForTimeout(300);
  if ((await page.getByText("Pick a day to follow.").count()) === 0) throw new Error("no prompt on Whole trip");
  const days = page.getByRole("group", { name: "Day to follow" }).getByRole("button");
  if ((await days.count()) < 2) throw new Error("the prompt offers fewer than two days");
  await days.first().click();
  await page.waitForTimeout(400);
  if ((await page.getByText("Pick a day to follow.").count()) > 0) throw new Error("picking a day left the prompt up");
  if ((await page.getByRole("tab", { name: /Day 1/, selected: true }).count()) === 0)
    throw new Error("the day strip does not show the picked day");
});
