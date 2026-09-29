import { strict as assert } from "node:assert";
import { test } from "node:test";
import { allowCall } from "./call-limit.ts";

test("a person gets max calls in the window, then waits", () => {
  const log = new Map<string, number[]>();
  assert.equal(allowCall(log, "u", 0, 2, 1000), true);
  assert.equal(allowCall(log, "u", 10, 2, 1000), true);
  assert.equal(allowCall(log, "u", 20, 2, 1000), false);
  // Someone else is counted on their own.
  assert.equal(allowCall(log, "v", 20, 2, 1000), true);
  // Once the first call leaves the window, one more is allowed.
  assert.equal(allowCall(log, "u", 1001, 2, 1000), true);
  assert.equal(allowCall(log, "u", 1002, 2, 1000), false);
});
