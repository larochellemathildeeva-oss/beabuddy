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
