import assert from "node:assert/strict";
import { test } from "node:test";
import { recoverableInsert } from "./recoverable-insert.ts";

test("a lost response reconciles a committed write, including after a reload", async () => {
  const database = new Map<string, { id: string; title: string }>();
  let inserts = 0;
  const rows = [{ id: "trip", title: "Original" }];
  const read = async () => [...database.values()];
  const insert = async (missing: typeof rows) => {
    inserts++;
    missing.forEach((row) => database.set(row.id, row));
    throw new Error("response lost");
  };
  await recoverableInsert(rows, read, insert);
  await recoverableInsert([{ id: "trip", title: "Changed elsewhere" }], read, insert);
  assert.equal(inserts, 1);
  assert.equal(database.get("trip")?.title, "Original");
});

test("partial commits retain original IDs and positions and insert only missing rows", async () => {
  const rows = [
    { id: "a", position: 0 },
    { id: "b", position: 1 },
  ];
  const database = [rows[0]!];
  let requested: typeof rows = [];
  await recoverableInsert(
    rows,
    async () => database,
    async (missing) => {
      requested = missing;
      database.push(...missing);
    },
  );
  assert.deepEqual(requested, [rows[1]]);
  assert.deepEqual(database, rows);
});

test("read failure fails closed without writing", async () => {
  let writes = 0;
  await assert.rejects(
    recoverableInsert(
      [{ id: "a" }],
      async () => {
        throw new Error("unauthorized");
      },
      async () => {
        writes++;
      },
    ),
    /unauthorized/,
  );
  assert.equal(writes, 0);
});

test("an unsuccessful write is not mistaken for success", async () => {
  await assert.rejects(
    recoverableInsert(
      [{ id: "a" }],
      async () => [],
      async () => {
        throw new Error("write failed");
      },
    ),
    /write failed/,
  );
});

test("two concurrent retries converge on the same primary key", async () => {
  const rows = new Map<string, { id: string }>();
  await Promise.all(
    [1, 2].map(() =>
      recoverableInsert(
        [{ id: "stable" }],
        async () => [...rows.values()],
        async (missing) => {
          for (const row of missing) {
            if (rows.has(row.id)) throw new Error("duplicate key");
            rows.set(row.id, row);
          }
        },
      ),
    ),
  );
  assert.equal(rows.size, 1);
});
