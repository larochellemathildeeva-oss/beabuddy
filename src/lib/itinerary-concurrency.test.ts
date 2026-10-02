import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  baseVersionsFor,
  reconcileItinerarySnapshot,
  undoSafety,
} from "./itinerary-concurrency.ts";

type Row = { id: string; updated_at: string; title: string };

const row = (id: string, version: string, title = id): Row => ({ id, updated_at: version, title });

test("remote edits to untouched rows merge immediately", () => {
  const local = [row("a", "1", "A local"), row("b", "1", "B old")];
  const incoming = [row("a", "1", "A server"), row("b", "2", "B new")];
  const result = reconcileItinerarySnapshot(local, incoming, new Set(["a"]), { a: "1" });
  assert.equal(result.rows.find((item) => item.id === "a")?.title, "A local");
  assert.equal(result.rows.find((item) => item.id === "b")?.title, "B new");
  assert.deepEqual(result.staleTouchedIds, []);
});

test("remote edit to a touched row never overwrites the optimistic row and marks Review stale", () => {
  const local = [row("a", "1", "A optimistic")];
  const incoming = [row("a", "2", "A by someone else")];
  const result = reconcileItinerarySnapshot(local, incoming, new Set(["a"]), { a: "1" });
  assert.equal(result.rows[0]?.title, "A optimistic");
  assert.deepEqual(result.staleTouchedIds, ["a"]);
});

test("local inserted rows survive a server snapshot until their save lands", () => {
  const local = [row("existing", "1"), row("temp", "local", "New stop")];
  const incoming = [row("existing", "1")];
  const result = reconcileItinerarySnapshot(local, incoming, new Set(["temp"]), {});
  assert.equal(result.rows.find((item) => item.id === "temp")?.title, "New stop");
});

test("Undo is safe only for rows nobody touched after the ChangeSet committed", () => {
  const current = [row("a", "after-a"), row("b", "someone-else")];
  assert.deepEqual(undoSafety(current, { a: "after-a", b: "after-b", c: "after-c" }), {
    safeIds: ["a"],
    changedIds: ["b"],
    missingIds: ["c"],
  });
});

test("baseVersionsFor captures only touched rows", () => {
  const versions = baseVersionsFor([row("a", "1"), row("b", "2")], new Set(["b"]));
  assert.deepEqual(versions, { b: "2" });
});

test("a pending local delete does not reappear from a server snapshot", () => {
  const local = [row("a", "1")];
  const incoming = [row("a", "1"), row("gone", "1")];
  const result = reconcileItinerarySnapshot(local, incoming, new Set(["gone"]), { gone: "1" });
  assert.deepEqual(
    result.rows.map((item) => item.id),
    ["a"],
  );
  assert.deepEqual(result.staleTouchedIds, []);
});

test("a touched row someone else deleted is stale, not put back", () => {
  const local = [row("a", "1", "A optimistic")];
  const result = reconcileItinerarySnapshot(local, [], new Set(["a"]), { a: "1" });
  assert.deepEqual(result.rows, []);
  assert.deepEqual(result.staleTouchedIds, ["a"]);
});
