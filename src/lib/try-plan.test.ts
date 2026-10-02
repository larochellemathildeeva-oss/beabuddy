import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  clearPendingTryPlan,
  peekPendingTryPlan,
  readTryPlan,
  savePendingTryPlan,
  TRY_PLAN_MAX,
  TRY_PLAN_SAMPLE,
  tryKindLabel,
} from "./try-plan.ts";

function store() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}

test("the sample reads as two days, in order", () => {
  const read = readTryPlan(TRY_PLAN_SAMPLE);
  assert.ok(read);
  assert.deepEqual(
    read.days.map((d) => d.day),
    [1, 2],
  );
  assert.equal(read.days[0]?.items[0]?.title, "Pastéis de Belém");
  assert.equal(read.days[0]?.items[0]?.time_label, "09:30");
});

test("prose is not read here", () => {
  assert.equal(readTryPlan("We want to see Lisbon, eat well and maybe go to Sintra."), null);
  assert.equal(readTryPlan("   "), null);
});

test("kinds get the timeline's words", () => {
  assert.equal(tryKindLabel("flight"), "Flight");
  assert.equal(typeof tryKindLabel("meal"), "string");
  assert.notEqual(tryKindLabel("meal"), tryKindLabel("sight"));
});

test("a saved plan is kept until cleared", () => {
  const s = store();
  assert.equal(savePendingTryPlan(s, "  09:00 A\n10:00 B\n11:00 C  ", 1000), true);
  assert.equal(peekPendingTryPlan(s, 2000), "09:00 A\n10:00 B\n11:00 C");
  assert.equal(peekPendingTryPlan(s, 2000), "09:00 A\n10:00 B\n11:00 C");
  clearPendingTryPlan(s);
  assert.equal(peekPendingTryPlan(s, 2000), null);
});

test("saving says so when the browser keeps nothing", () => {
  const noop = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  assert.equal(savePendingTryPlan(noop, "09:00 A"), false);
  const throwing = {
    ...noop,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.equal(savePendingTryPlan(throwing, "09:00 A"), false);
  assert.equal(savePendingTryPlan(store(), "   "), false);
});

test("a plan older than a week, or broken, is dropped", () => {
  const s = store();
  savePendingTryPlan(s, "09:00 A", 0);
  assert.equal(peekPendingTryPlan(s, 8 * 24 * 60 * 60 * 1000), null);
  s.setItem("bea.tryPlan", "{not json");
  assert.equal(peekPendingTryPlan(s), null);
  assert.equal(s.getItem("bea.tryPlan"), null);
});

test("a long plan is cut to what the planner takes", () => {
  const s = store();
  savePendingTryPlan(s, "x".repeat(TRY_PLAN_MAX + 50), 0);
  assert.equal(peekPendingTryPlan(s, 1)?.length, TRY_PLAN_MAX);
  clearPendingTryPlan(s);
  assert.equal(peekPendingTryPlan(s, 1), null);
});
