import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  ERROR_PAUSE_MS,
  GeoLedger,
  MISSING_RETRY_MS,
  type GeoReserveResult,
} from "./geo-ledger.ts";

const noon = Date.UTC(2026, 8, 30, 12);
const beforeMidnight = Date.UTC(2026, 8, 30, 23, 59, 59);
const afterMidnight = Date.UTC(2026, 9, 1, 0, 0, 1);

/** A clock the test moves by hand. */
function clockAt(start: number) {
  const clock = { now: start, read: () => clock.now };
  return clock;
}

test("a reserved block covers several small spends", async () => {
  let calls = 0;
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "ok";
  }, clock.read);

  assert.equal(await ledger.spend(1), "ok");
  assert.equal(await ledger.spend(2), "ok");
  assert.equal(await ledger.spend(3), "ok");
  assert.equal(calls, 1);
});

test("20 concurrent spends share reservations and never overspend", async () => {
  const limit = 50;
  let calls = 0;
  let reserved = 0;
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async (credits) => {
    calls += 1;
    await Promise.resolve();
    if (reserved + credits > limit) return "denied";
    reserved += credits;
    return "ok";
  }, clock.read);

  const results = await Promise.all(Array.from({ length: 20 }, () => ledger.spend(3)));
  assert.equal(calls, 3, "two successful blocks and one denied reservation");
  assert.equal(reserved, 50);
  assert.equal(results.filter((result) => result === "ok").length, 16);
  assert.equal(results.filter((result) => result === "denied").length, 4);
});

test("denial marks the UTC day spent, and only that day", async () => {
  let calls = 0;
  const answers: GeoReserveResult[] = ["denied", "ok"];
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return answers.shift() ?? "ok";
  }, clock.read);

  assert.equal(await ledger.spend(1), "denied");
  clock.now = noon + 1;
  assert.equal(await ledger.spend(1), "denied");
  assert.equal(calls, 1);
  clock.now = afterMidnight;
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(calls, 2);
});

test("a denial for yesterday that lands after midnight does not block today", async () => {
  const clock = clockAt(beforeMidnight);
  const days: GeoReserveResult[] = [];
  let release: (r: GeoReserveResult) => void = () => {};
  const ledger = new GeoLedger((): Promise<GeoReserveResult> => {
    if (days.length === 0) {
      days.push("denied");
      // Yesterday's reservation is still in flight when midnight passes.
      return new Promise((resolve) => (release = resolve));
    }
    return Promise.resolve("ok");
  }, clock.read);

  const waiting = ledger.spend(1);
  clock.now = afterMidnight;
  release("denied");
  assert.equal(await waiting, "ok", "the caller asked again for the new day");
  assert.equal(await ledger.spend(1), "ok");
});

test("a reservation started before midnight never rolls the ledger back", async () => {
  const clock = clockAt(beforeMidnight);
  let calls = 0;
  let release: (r: GeoReserveResult) => void = () => {};
  const ledger = new GeoLedger((): Promise<GeoReserveResult> => {
    calls += 1;
    if (calls === 1) return new Promise((resolve) => (release = resolve));
    return Promise.resolve("ok");
  }, clock.read);

  const yesterday = ledger.spend(1);
  clock.now = afterMidnight;
  // A new-day caller reserves a block of its own meanwhile.
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(calls, 2);
  release("ok");
  assert.equal(await yesterday, "ok");
  // Today's balance is intact: these come from the block already reserved.
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(calls, 2, "yesterday's block was dropped, today's kept");
});

test("a missing reservation function is unmetered for an hour, then asked again", async () => {
  let calls = 0;
  const answers: GeoReserveResult[] = ["missing", "ok"];
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return answers.shift() ?? "ok";
  }, clock.read);

  assert.equal(await ledger.spend(1), "unmetered");
  clock.now = noon + 1;
  assert.equal(await ledger.spend(100), "unmetered");
  assert.equal(calls, 1);
  clock.now = noon + MISSING_RETRY_MS;
  assert.equal(await ledger.spend(1), "ok", "the migration was applied meanwhile");
  assert.equal(calls, 2);
});

test("reservation errors pause for 60 seconds from the failure, then retry", async () => {
  let calls = 0;
  const answers: GeoReserveResult[] = ["error", "ok"];
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    calls += 1;
    // A slow failure: the database took 90 seconds to answer.
    clock.now += 90_000;
    return answers.shift() ?? "ok";
  }, clock.read);

  assert.equal(await ledger.spend(1), "error");
  const failedAt = clock.now;
  clock.now = failedAt + ERROR_PAUSE_MS - 1;
  assert.equal(await ledger.spend(1), "error");
  assert.equal(calls, 1);
  clock.now = failedAt + ERROR_PAUSE_MS;
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(calls, 2);
});

test("a thrown reservation counts as an error", async () => {
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    throw new Error("socket hang up");
  }, clock.read);
  assert.equal(await ledger.spend(1), "error");
});

test("UTC midnight drops the local reserved balance", async () => {
  let calls = 0;
  const clock = clockAt(noon);
  const ledger = new GeoLedger(async () => {
    calls += 1;
    return "ok";
  }, clock.read);

  assert.equal(await ledger.spend(1), "ok");
  clock.now = afterMidnight;
  assert.equal(await ledger.spend(1), "ok");
  assert.equal(calls, 2);
});
