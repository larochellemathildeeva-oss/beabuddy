import { strict as assert } from "node:assert";
import { test } from "node:test";
import { groupCountLabel, groupRecosByType, RECO_GROUP_ORDER } from "./reco-groups.ts";

const row = (id: string, type: "reco" | "wishlist" | "nexttime" | "visited") => ({ id, type });

test("groupRecosByType keeps the fixed order regardless of input order", () => {
  const rows = [row("a", "visited"), row("b", "reco"), row("c", "nexttime"), row("d", "wishlist")];
  assert.deepEqual(
    groupRecosByType(rows).map((g) => g.type),
    ["reco", "wishlist", "nexttime", "visited"],
  );
});

test("groupRecosByType skips types with nothing in them", () => {
  const groups = groupRecosByType([row("a", "reco"), row("b", "reco")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.type, "reco");
  assert.equal(groups[0]?.rows.length, 2);
});

test("an empty vault has no groups at all, not four empty ones", () => {
  assert.deepEqual(groupRecosByType([]), []);
});

test("rows keep the order they arrived in, so the outer sort still decides", () => {
  // The vault ranks by opportunity score before grouping; grouping must not
  // quietly reshuffle within a heading.
  const rows = [row("first", "reco"), row("second", "reco"), row("third", "reco")];
  assert.deepEqual(
    groupRecosByType(rows)[0]?.rows.map((r) => r.id),
    ["first", "second", "third"],
  );
});

test("every row lands in exactly one group", () => {
  const rows = [
    row("a", "reco"),
    row("b", "visited"),
    row("c", "wishlist"),
    row("d", "visited"),
    row("e", "nexttime"),
  ];
  const groups = groupRecosByType(rows);
  assert.equal(
    groups.reduce((n, g) => n + g.rows.length, 0),
    rows.length,
  );
  const ids = groups.flatMap((g) => g.rows.map((r) => r.id)).sort();
  assert.deepEqual(ids, ["a", "b", "c", "d", "e"]);
});

test("the order covers every pin type, so nothing can be silently dropped", () => {
  const all = ["visited", "nexttime", "wishlist", "reco"] as const;
  for (const type of all) assert.ok(RECO_GROUP_ORDER.includes(type), `${type} missing`);
  assert.equal(RECO_GROUP_ORDER.length, all.length);
});

test("groupCountLabel says the count once", () => {
  assert.equal(groupCountLabel(1), "1 saved");
  assert.equal(groupCountLabel(12), "12 saved");
  assert.equal(groupCountLabel(0), "0 saved");
});
