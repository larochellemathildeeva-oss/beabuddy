import { test } from "node:test";
import assert from "node:assert/strict";
import { areaOf, groupByArea, NO_AREA } from "./neighbourhood.ts";

test("the area is the last named part of the address", () => {
  assert.equal(areaOf("1-2 Nakajimacho, Naka Ward"), "Naka Ward");
  assert.equal(areaOf("Miyajima Omotesando"), "Miyajima Omotesando");
  assert.equal(areaOf("1-2 Nakajimacho"), "Nakajimacho");
  assert.equal(areaOf("310 Rue de la Commune E, Vieux-Montréal, H2Y 1J3"), "Vieux-Montréal");
  assert.equal(areaOf(null), NO_AREA);
  assert.equal(areaOf("  "), NO_AREA);
});

test("stops group by area in the order the areas appear, unplaced last", () => {
  const groups = groupByArea([
    { id: "a", address: null },
    { id: "b", address: "1-2 Nakajimacho, Naka Ward" },
    { id: "c", address: "Miyajima Omotesando" },
    { id: "d", address: "1-10 Otemachi, Naka Ward" },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.area, g.items.map((i) => i.id)]),
    [
      ["Naka Ward", ["b", "d"]],
      ["Miyajima Omotesando", ["c"]],
      [NO_AREA, ["a"]],
    ],
  );
});
