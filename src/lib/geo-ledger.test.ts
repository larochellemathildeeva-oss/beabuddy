import { strict as assert } from "node:assert";
import { test } from "node:test";
import { GeoLedger, type GeoReserveResult } from "./geo-ledger.ts";

const noon = Date.UTC(2026, 8, 30, 12);

test("a reserved block covers several small spends", async () => {
  let calls = 0;
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "ok";
  });

  assert.equal(await ledger.spend(1, noon), "ok");
  assert.equal(await ledger.spend(2, noon), "ok");
  assert.equal(await ledger.spend(3, noon), "ok");
  assert.equal(calls, 1);
});

test("20 concurrent spends share reservations and never overspend", async () => {
  const limit = 50;
  let calls = 0;
  let reserved = 0;
  const ledger = new GeoLedger(async (credits) => {
    calls += 1;
    await Promise.resolve();
    if (reserved + credits > limit) return "denied";
    reserved += credits;
    return "ok";
  });

  const results = await Promise.all(Array.from({ length: 20 }, () => ledger.spend(3, noon)));
  assert.equal(calls, 3, "two successful blocks and one denied reservation");
  assert.equal(reserved, 50);
  assert.equal(results.filter((result) => result === "ok").length, 16);
  assert.equal(results.filter((result) => result === "denied").length, 4);
  assert.ok(reserved <= limit);
});

test("denial marks the UTC day spent", async () => {
  let calls = 0;
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "denied";
  });

  assert.equal(await ledger.spend(1, noon), "denied");
  assert.equal(await ledger.spend(1, noon + 1), "denied");
  assert.equal(calls, 1);
});

test("missing reservation function switches the process to unmetered", async () => {
  let calls = 0;
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "missing";
  });

  assert.equal(await ledger.spend(1, noon), "unmetered");
  assert.equal(await ledger.spend(100, noon + 1), "unmetered");
  assert.equal(calls, 1);
});

test("reservation errors pause for 60 seconds then retry", async () => {
  let calls = 0;
  const answers: GeoReserveResult[] = ["error", "ok"];
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return answers.shift() ?? "ok";
  });

  assert.equal(await ledger.spend(1, noon), "error");
  assert.equal(await ledger.spend(1, noon + 59_999), "error");
  assert.equal(calls, 1);
  assert.equal(await ledger.spend(1, noon + 60_000), "ok");
  assert.equal(calls, 2);
});

test("UTC midnight drops the local reserved balance", async () => {
  let calls = 0;
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "ok";
  });

  assert.equal(await ledger.spend(1, noon), "ok");
  assert.equal(await ledger.spend(1, Date.UTC(2026, 9, 1, 0, 1)), "ok");
  assert.equal(calls, 2);
});
