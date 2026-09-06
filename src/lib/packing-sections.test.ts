import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  asDraftItems,
  decodeSectionLabel,
  encodeSectionLabel,
  groupPackItems,
  hydratePackItem,
  isMissingSectionColumn,
  normalizeSection,
} from "./packing-sections.ts";

test("normalizeSection trims, empties to null, and caps length", () => {
  assert.equal(normalizeSection("  Clothes  "), "Clothes");
  assert.equal(normalizeSection("   "), null);
  assert.equal(normalizeSection(null), null);
  assert.equal(normalizeSection("x".repeat(50))?.length, 40);
});

test("encodeSectionLabel prefixes only when a heading is present", () => {
  assert.equal(encodeSectionLabel("Clothes", "Passport"), "Clothes: Passport");
  assert.equal(encodeSectionLabel(null, "Socks"), "Socks");
});

test("decodeSectionLabel recovers headings and ignores clock times", () => {
  assert.deepEqual(decodeSectionLabel("IDs: Passport"), { section: "IDs", label: "Passport" });
  assert.deepEqual(decodeSectionLabel("9:00 ferry"), { section: null, label: "9:00 ferry" });
  assert.deepEqual(decodeSectionLabel("Socks"), { section: null, label: "Socks" });
});

test("hydratePackItem prefers the column, then a label prefix", () => {
  assert.deepEqual(hydratePackItem({ label: "Passport", section: "IDs" }), {
    label: "Passport",
    section: "IDs",
  });
  assert.deepEqual(hydratePackItem({ label: "Clothes: 2 tops", section: null }), {
    label: "2 tops",
    section: "Clothes",
  });
});

test("groupPackItems keeps first-seen section order and trails leftovers", () => {
  const groups = groupPackItems([
    { id: "a", section: "Clothes", position: 1 },
    { id: "b", section: null, position: 2 },
    { id: "c", section: "IDs", position: 3 },
    { id: "d", section: "Clothes", position: 4 },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.section, g.items.map((i) => i.id)]),
    [
      ["Clothes", ["a", "d"]],
      ["IDs", ["c"]],
      [null, ["b"]],
    ],
  );
});

test("asDraftItems accepts starter strings or structured rows", () => {
  assert.deepEqual(asDraftItems(["Socks", { label: "Passport", section: "IDs" }]), [
    { label: "Socks" },
    { label: "Passport", section: "IDs" },
  ]);
});

test("isMissingSectionColumn recognises PostgREST wording", () => {
  assert.equal(
    isMissingSectionColumn({
      message: 'Could not find the \'section\' column of \'packing_items\' in the schema cache',
    }),
    true,
  );
  assert.equal(isMissingSectionColumn({ message: "duplicate key" }), false);
});
