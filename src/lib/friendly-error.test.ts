import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendlyError } from "./friendly-error.ts";

const FALLBACK = "Couldn't save that.";

describe("friendlyError", () => {
  it("lets Béa's own plain messages through", () => {
    assert.equal(
      friendlyError(new Error("That trip is full — ask the owner to make room."), FALLBACK),
      "That trip is full — ask the owner to make room.",
    );
  });

  it("replaces messages written for developers", () => {
    for (const raw of [
      "JWT expired",
      'new row violates row-level security policy for table "trips"',
      "TypeError: Cannot read properties of undefined",
      "Failed to fetch",
      'duplicate key value violates unique constraint "x"',
      "Request failed with status code 500",
      'PGRST116: {"details":"0 rows"}',
    ]) {
      assert.equal(friendlyError(new Error(raw), FALLBACK), FALLBACK, raw);
    }
  });

  it("falls back for empty, very long and non-error values", () => {
    assert.equal(friendlyError(new Error(""), FALLBACK), FALLBACK);
    assert.equal(friendlyError(new Error("a".repeat(300)), FALLBACK), FALLBACK);
    assert.equal(friendlyError(undefined, FALLBACK), FALLBACK);
    assert.equal(friendlyError({ message: "x" }, FALLBACK), FALLBACK);
  });
});
