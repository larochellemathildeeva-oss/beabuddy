import { strict as assert } from "node:assert";
import { test } from "node:test";
import { existsSync } from "node:fs";
import { markWelcomeDone, shouldShowWelcome, WELCOME_GOALS, WELCOME_WINDOW_MS } from "./welcome.ts";
import { WALKS } from "./tour.ts";

function store() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

const now = Date.parse("2026-10-01T12:00:00Z");
const fresh = { userId: "u1", createdAt: "2026-10-01T11:00:00Z", path: "/", now };

test("a brand-new account sees the welcome once", () => {
  const s = store();
  assert.equal(shouldShowWelcome(s, fresh), true);
  markWelcomeDone(s, "u1");
  assert.equal(shouldShowWelcome(s, fresh), false);
  // Another account on the same phone still gets its own.
  assert.equal(shouldShowWelcome(s, { ...fresh, userId: "u2" }), true);
});

test("an account that saw it on another device does not see it again", () => {
  assert.equal(shouldShowWelcome(store(), { ...fresh, doneOnAccount: true }), false);
});

test("older accounts, signed-out visitors and quiet pages never see it", () => {
  const s = store();
  const old = new Date(now - WELCOME_WINDOW_MS - 1).toISOString();
  assert.equal(shouldShowWelcome(s, { ...fresh, createdAt: old }), false);
  assert.equal(shouldShowWelcome(s, { ...fresh, userId: null }), false);
  assert.equal(shouldShowWelcome(s, { ...fresh, createdAt: "not a date" }), false);
  for (const path of ["/auth", "/reset-password", "/shared/abc", "/privacy"]) {
    assert.equal(shouldShowWelcome(s, { ...fresh, path }), false, path);
  }
});

test("every goal leads to a walk that exists, planning first", () => {
  assert.equal(WELCOME_GOALS[0]?.id, "plan");
  const walks = new Set(WALKS.map((w) => w.id));
  for (const goal of WELCOME_GOALS) {
    assert.ok(walks.has(goal.id), goal.id);
    assert.ok(goal.to.startsWith("/") && goal.go.trim(), goal.id);
    assert.ok(existsSync(`public${goal.picture}`), goal.picture);
  }
});
