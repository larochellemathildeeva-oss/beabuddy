import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  defaultModules,
  moduleRows,
  moveModule,
  readModules,
  shownModules,
  toggleModule,
  writeModules,
} from "./module-layout.ts";

const KEYS = ["a", "b", "c", "d"] as const;
const DEFAULTS = ["c", "a"] as const;

describe("module layouts", () => {
  it("starts with the defaults on, in their order, then the rest off", () => {
    const layout = defaultModules(KEYS, DEFAULTS);
    assert.deepEqual(layout.order, ["c", "a", "b", "d"]);
    assert.deepEqual(shownModules(layout), ["c", "a"]);
    assert.deepEqual(readModules(null, KEYS, DEFAULTS), layout);
    assert.deepEqual(readModules("not json", KEYS, DEFAULTS), layout);
  });

  it("round-trips, dropping unknown modules and adding new ones off", () => {
    const raw = JSON.stringify({ order: ["d", "zz", "a", "d"], on: ["d", "zz"] });
    const layout = readModules(raw, KEYS, DEFAULTS);
    assert.deepEqual(layout.order, ["d", "a", "c", "b"]);
    assert.deepEqual(shownModules(layout), ["d"]);
    assert.deepEqual(readModules(writeModules(layout), KEYS, DEFAULTS), layout);
  });

  it("reads the first layouts, one switch per section", () => {
    const layout = readModules(JSON.stringify({ a: false, b: true }), KEYS, DEFAULTS);
    // c is on by default and was never switched; a was switched off.
    assert.deepEqual(shownModules(layout), ["c", "b"]);
  });

  it("switches a module on and off", () => {
    let layout = defaultModules(KEYS, DEFAULTS);
    layout = toggleModule(layout, "d");
    assert.deepEqual(shownModules(layout), ["c", "a", "d"]);
    layout = toggleModule(layout, "c");
    assert.deepEqual(shownModules(layout), ["a", "d"]);
  });

  it("moves past the next module that is on, and stops at the ends", () => {
    let layout = toggleModule(defaultModules(KEYS, DEFAULTS), "d");
    // Shown: c, a, d (b is off, between a and d in the full order).
    layout = moveModule(layout, "d", -1);
    assert.deepEqual(shownModules(layout), ["c", "d", "a"]);
    layout = moveModule(layout, "c", -1);
    assert.deepEqual(shownModules(layout), ["c", "d", "a"]);
    layout = moveModule(layout, "a", 1);
    assert.deepEqual(shownModules(layout), ["c", "d", "a"]);
    layout = moveModule(layout, "c", 1);
    assert.deepEqual(shownModules(layout), ["d", "c", "a"]);
    // An off module does not move.
    assert.equal(moveModule(layout, "b", 1), layout);
  });
});

describe("module rows", () => {
  it("puts small modules two to a row and wide ones alone", () => {
    const small = (k: string) => k.startsWith("s");
    assert.deepEqual(moduleRows(["s1", "s2", "w1", "s3", "w2", "s4", "s5", "s6"], small), [
      { pair: ["s1", "s2"] },
      { full: "w1" },
      { pair: ["s3"] },
      { full: "w2" },
      { pair: ["s4", "s5"] },
      { pair: ["s6"] },
    ]);
    assert.deepEqual(moduleRows([], small), []);
  });
});
