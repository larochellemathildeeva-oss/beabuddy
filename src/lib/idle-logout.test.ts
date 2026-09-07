import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { IDLE_LOGOUT_MS, idleDeadline, isIdleExpired } from "./idle-logout.ts";

describe("idle-logout", () => {
  it("uses a 45-minute window", () => {
    assert.equal(IDLE_LOGOUT_MS, 45 * 60 * 1000);
  });

  it("is not expired before the deadline", () => {
    const start = 1_000_000;
    assert.equal(isIdleExpired(start, start + IDLE_LOGOUT_MS - 1), false);
  });

  it("expires at the deadline", () => {
    const start = 1_000_000;
    assert.equal(idleDeadline(start), start + IDLE_LOGOUT_MS);
    assert.equal(isIdleExpired(start, start + IDLE_LOGOUT_MS), true);
  });
});
