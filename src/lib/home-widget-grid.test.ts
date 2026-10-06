import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { HOME_WIDGET_SIZES, homeWidgetCells, normalizeHomeWidgets } from "./home-widget-grid.ts";
import {
  defaultModules,
  moveModule,
  readModules,
  shownModules,
  toggleModule,
  writeModules,
} from "./module-layout.ts";
import {
  cleanAccountSettings,
  homeLayoutKey,
  planSync,
  settingStorageKey,
} from "./account-settings.ts";
import type { HomeSectionKey } from "../hooks/useHomeLayout.ts";

const keys = Object.keys(HOME_WIDGET_SIZES) as HomeSectionKey[];
const defaults: HomeSectionKey[] = ["trip", "stops", "suggested", "weather", "waiting", "future"];
const load = (raw: string | null) =>
  normalizeHomeWidgets(readModules(raw, keys, defaults, ["suggested"]));

describe("Home widget layouts", () => {
  it("gives an old switch layout sensible sizes without losing its switches", () => {
    const layout = load('{"weather":false,"saved":true}');
    assert.equal(layout.sizes?.trip, "large");
    assert.equal(layout.sizes?.saved, "small");
    assert.equal(layout.sizes?.waiting, "wide");
    assert.equal(layout.on.has("weather"), false);
    assert.equal(layout.on.has("saved"), true);
  });
  it("keeps legacy order and on/off choices, and drops invalid sizes and unknown modules", () => {
    const layout = load(
      JSON.stringify({
        order: ["saved", "trip", "saved", "missing"],
        on: ["saved", "trip"],
        sizes: { saved: "large", trip: "small", weather: "huge", missing: "wide" },
      }),
    );
    assert.deepEqual(layout.order.slice(0, 2), ["saved", "trip"]);
    assert.equal(layout.sizes?.saved, "large");
    assert.equal(layout.sizes?.trip, "large");
    assert.equal(layout.sizes?.weather, "small");
    assert.equal(layout.order.includes("missing" as HomeSectionKey), false);
  });
  it("round-trips order, switches and sizes through the existing synced homeLayout", () => {
    const layout = load(null);
    layout.sizes = { ...layout.sizes, weather: "large", waiting: "large" };
    const changed = moveModule(toggleModule(layout, "saved"), "weather", -1);
    const raw = writeModules(changed);
    const account = cleanAccountSettings({ homeLayout: raw });
    const sync = planSync(account, {});
    const key = settingStorageKey("homeLayout", "widget-test-other-device");
    assert.equal(key, "bea-home-layout-widget-test-other-device");
    assert.deepEqual(load(sync.toDevice.homeLayout ?? null), changed);
    assert.notEqual(homeLayoutKey("one"), homeLayoutKey("two"));
  });
  it("starts a default grid in reading order, using square cells and no overlapping spans", () => {
    const layout = normalizeHomeWidgets(defaultModules(keys, defaults));
    const cells = homeWidgetCells(shownModules(layout), layout.sizes);
    assert.deepEqual(
      cells.map(({ key, row, column }) => [key, row, column]),
      [
        ["trip", 1, 1],
        ["stops", 3, 1],
        ["suggested", 4, 1],
        ["weather", 5, 1],
        ["waiting", 6, 1],
        ["future", 7, 1],
      ],
    );
    const occupied = new Set<string>();
    for (const cell of cells)
      for (let y = cell.row; y < cell.row + cell.rows; y++)
        for (let x = cell.column; x < cell.column + cell.columns; x++) {
          assert.ok(x <= 2);
          assert.ok(!occupied.has(`${x},${y}`));
          occupied.add(`${x},${y}`);
        }
  });
  it("packs small widgets side by side and starts wide and large widgets on a new row", () => {
    assert.deepEqual(
      homeWidgetCells(["saved", "group", "weather", "waiting", "trip"], {
        saved: "small",
        group: "small",
        weather: "small",
        waiting: "wide",
        trip: "large",
      }).map(({ column, row, columns, rows }) => [column, row, columns, rows]),
      [
        [1, 1, 1, 1],
        [2, 1, 1, 1],
        [1, 2, 1, 1],
        [1, 3, 2, 1],
        [1, 4, 2, 2],
      ],
    );
  });
  it("falls back safely for malformed storage and resets to default sizes", () => {
    assert.deepEqual(load("bad JSON"), load(null));
    assert.deepEqual(load("null"), load(null));
    assert.equal(load(null).sizes?.weather, "small");
  });
});
