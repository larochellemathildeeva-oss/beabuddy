import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  AI_COST,
  AI_DAILY_UNITS_DEFAULT,
  MemoryQuota,
  aiDailyUnits,
  readQuotaReply,
} from "./ai-quota.ts";

const noon = Date.UTC(2026, 9, 1, 12);

test("every cost is a whole number of units within the default day", () => {
  for (const [op, units] of Object.entries(AI_COST)) {
    assert.ok(Number.isInteger(units) && units >= 1, op);
    assert.ok(units <= AI_DAILY_UNITS_DEFAULT, op);
  }
});

test("the daily ceiling comes from the environment, or the default", () => {
  assert.equal(aiDailyUnits(undefined), AI_DAILY_UNITS_DEFAULT);
  assert.equal(aiDailyUnits("250"), 250);
  assert.equal(aiDailyUnits("12.9"), 12);
  for (const nonsense of ["", "0", "-5", "abc", "NaN"]) {
    assert.equal(aiDailyUnits(nonsense), AI_DAILY_UNITS_DEFAULT, nonsense);
  }
});

test("the database's answer is read as allowed, refused, missing or error", () => {
  assert.equal(readQuotaReply(true, null), "allowed");
  assert.equal(readQuotaReply(false, null), "refused");
  assert.equal(readQuotaReply(null, null), "error", "no answer is not permission");
  for (const code of ["PGRST202", "42883", "42P01"]) {
    assert.equal(readQuotaReply(null, { code, message: "" }), "missing", code);
  }
  assert.equal(readQuotaReply(null, { message: "fetch failed" }), "error");
  assert.equal(readQuotaReply(null, { code: "57014", message: "timeout" }), "error");
});

test("the in-process count holds each traveller to the ceiling, separately", () => {
  const q = new MemoryQuota();
  for (let i = 0; i < 10; i++) assert.equal(q.reserve("alice", 1, 10, noon), true);
  assert.equal(q.reserve("alice", 1, 10, noon), false, "the eleventh unit is refused");
  assert.equal(q.reserve("bob", 4, 10, noon), true, "another traveller is unaffected");
  assert.equal(
    q.reserve("bob", 7, 10, noon),
    false,
    "a reservation that would overrun adds nothing",
  );
  assert.equal(q.reserve("bob", 6, 10, noon), true);
});

test("the in-process count starts again at midnight UTC", () => {
  const q = new MemoryQuota();
  assert.equal(q.reserve("alice", 10, 10, noon), true);
  assert.equal(q.reserve("alice", 1, 10, noon), false);
  assert.equal(q.reserve("alice", 1, 10, Date.UTC(2026, 9, 2, 0, 0, 1)), true);
});

test("the in-process count stays bounded", () => {
  const q = new MemoryQuota(2);
  q.reserve("a", 1, 10, noon);
  q.reserve("b", 1, 10, noon);
  q.reserve("c", 1, 10, noon);
  // "a" was dropped to make room; it starts again rather than growing memory.
  assert.equal(q.reserve("a", 10, 10, noon), true);
});

test("with no database, reserveAi counts per process and refuses past the ceiling", async () => {
  const before = process.env["AI_DAILY_UNITS"];
  process.env["AI_DAILY_UNITS"] = "4";
  try {
    const { reserveAi } = await import("./ai-quota.server.ts");
    const { AI_LIMIT_MESSAGE } = await import("./ai-quota.ts");
    await reserveAi("quota-test-user", "receipt");
    await reserveAi("quota-test-user", "receipt");
    await assert.rejects(reserveAi("quota-test-user", "receipt"), { message: AI_LIMIT_MESSAGE });
    // Another traveller has a day of their own.
    await reserveAi("quota-test-other", "receipt");
    // No verified user, no AI.
    await assert.rejects(reserveAi("", "receipt"));
  } finally {
    if (before === undefined) delete process.env["AI_DAILY_UNITS"];
    else process.env["AI_DAILY_UNITS"] = before;
  }
});
