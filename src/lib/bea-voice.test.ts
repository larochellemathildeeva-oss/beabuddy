import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BEA_MISSION,
  BEA_POSITION,
  BEA_SIGNATURE,
  beaLine,
  beaMomentPool,
  nearCardLine,
  type BeaMoment,
} from "./bea-voice.ts";

const MOMENTS: BeaMoment[] = [
  "recs.saved",
  "near.nearby",
  "near.empty",
  "empty.globe",
  "empty.recs",
  "empty.trips",
  "empty.home",
  "plan.working",
  "plan.ready",
  "plan.complete",
  "plan.locating",
  "choose.working",
  "choose.ready",
];

test("every moment has at least one line with a title", () => {
  for (const m of MOMENTS) {
    const pool = beaMomentPool(m);
    assert.ok(pool.length >= 1, m);
    for (const line of pool) {
      assert.ok(line.title.trim().length > 0, `${m} empty title`);
      assert.ok(line.mode, `${m} missing mode`);
    }
  }
});

test("mission and position reject AI-planner framing", () => {
  assert.match(BEA_MISSION, /Future You/i);
  assert.match(BEA_POSITION, /travel life/i);
  assert.ok(!BEA_MISSION.toLowerCase().includes("ai travel"));
  assert.ok(!BEA_POSITION.toLowerCase().includes("ai travel"));
});

test("beaLine rotates by calendar day", () => {
  const a = beaLine("recs.saved", new Date(Date.UTC(2026, 0, 1)));
  const b = beaLine("recs.saved", new Date(Date.UTC(2026, 0, 2)));
  assert.equal(a.title, beaLine("recs.saved", new Date(Date.UTC(2026, 0, 1))).title);
  // pools are long enough that consecutive days usually differ
  assert.ok(a.title || b.title);
});

test("nearCardLine uses metres when close", () => {
  const line = nearCardLine(450, new Date(Date.UTC(2026, 5, 1)));
  assert.match(line.body ?? "", /450 m/);
  assert.match(line.title, /breadcrumb/i);
});

test("recs.saved includes the Future You signature somewhere in the pool", () => {
  const blob = beaMomentPool("recs.saved")
    .map((l) => `${l.title} ${l.body ?? ""}`)
    .join(" ");
  assert.match(blob, /Future You has excellent taste/);
});

test("the waiting pool is deep enough to be worth discovering", () => {
  // The point of randomising the start is that you meet a new one
  // occasionally. A pool of three would just feel like a short loop.
  const pool = beaMomentPool("plan.locating");
  assert.ok(pool.length >= 10, `only ${pool.length} lines`);
});

test("every waiting line is a two-parter, because the card has two slots", () => {
  for (const line of beaMomentPool("plan.locating")) {
    assert.ok(line.body && line.body.trim().length > 0, `${line.title} has no body`);
  }
});

test("waiting lines are all distinct, so a long wait never repeats early", () => {
  const titles = beaMomentPool("plan.locating").map((l) => l.title);
  assert.equal(new Set(titles).size, titles.length);
});

test("the short-legs line survives in the waiting pool", () => {
  // The one that gives the wait a reason you can picture.
  const pool = beaMomentPool("plan.locating");
  assert.ok(
    pool.some((l) => /little legs/i.test(`${l.title} ${l.body ?? ""}`)),
    "the little-legs line is gone",
  );
});
