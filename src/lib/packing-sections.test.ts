import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  asDraftItems,
  DEFAULT_SECTIONS,
  diffPackEdit,
  guessSection,
  hasPackEdits,
  sectionChoices,
  sectionKind,
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
      message: "Could not find the 'section' column of 'packing_items' in the schema cache",
    }),
    true,
  );
  assert.equal(isMissingSectionColumn({ message: "duplicate key" }), false);
});

test("guessSection picks a default heading or the list's own of the same kind", () => {
  assert.equal(guessSection("Phone charger"), "Electronics");
  assert.equal(guessSection("Toothbrush"), "Toiletries");
  assert.equal(guessSection("Wool socks"), "Clothes");
  assert.equal(guessSection("Passport"), "Documents");
  assert.equal(guessSection("Passport", ["IDs", "Clothes"]), "IDs");
  assert.equal(guessSection("Deodorant", ["Personal care"]), "Personal care");
  assert.equal(guessSection("Sunscreen"), "Beach");
  assert.equal(guessSection("Book"), null);
  assert.equal(guessSection("  "), null);
});

test("sectionKind reads a heading's kind", () => {
  assert.equal(sectionKind("Clothes"), "clothes");
  assert.equal(sectionKind("Personal care"), "toiletries");
  assert.equal(sectionKind("Airplane"), "travel");
  assert.equal(sectionKind("Ideas"), "other");
  assert.equal(sectionKind(null), "other");
});

test("sectionChoices lists the list's own headings first, then missing defaults", () => {
  assert.deepEqual(sectionChoices([]), [...DEFAULT_SECTIONS]);
  const choices = sectionChoices(["IDs", "Clothes", "clothes", null]);
  assert.equal(choices[0], "IDs");
  assert.equal(choices[1], "Clothes");
  assert.ok(!choices.includes("Documents"));
  assert.ok(choices.includes("Electronics"));
  assert.equal(choices.filter((c) => c.toLowerCase() === "clothes").length, 1);
});

test("diffPackEdit finds removed, added and changed items", () => {
  const saved = [
    { id: "a", label: "Socks", section: "Clothes", quantity: 1, packed: false, position: 0 },
    { id: "b", label: "Phone", section: null, quantity: 1, packed: true, position: 1 },
    { id: "c", label: "Book", section: null, quantity: 1, packed: false, position: 2 },
  ];
  const diff = diffPackEdit(saved, [
    { key: "b", id: "b", label: "Phone", section: "Electronics", quantity: 1, packed: true },
    { key: "a", id: "a", label: "Socks", section: "Clothes", quantity: 3, packed: false },
    { key: "n", label: " Hat ", section: "Clothes", quantity: 1, packed: false },
    { key: "e", label: "   ", section: null, quantity: 1, packed: false },
  ]);
  assert.deepEqual(diff.removed, ["c"]);
  assert.deepEqual(diff.added, [
    { label: "Hat", section: "Clothes", quantity: 1, packed: false, position: 2 },
  ]);
  assert.deepEqual(diff.updated, [
    { id: "b", patch: { section: "Electronics", position: 0 } },
    { id: "a", patch: { quantity: 3, position: 1 } },
  ]);
  assert.ok(hasPackEdits(diff));
  const same = saved.map((s) => ({ key: s.id, ...s }));
  assert.ok(!hasPackEdits(diffPackEdit(saved, same)));
});
