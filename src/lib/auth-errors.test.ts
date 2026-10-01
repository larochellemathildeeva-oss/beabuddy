import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { friendlyAuthError } from "./auth-errors.ts";

describe("friendlyAuthError", () => {
  it("answers Supabase's codes in plain words", () => {
    assert.match(friendlyAuthError({ code: "invalid_credentials", message: "x" }), /don't match/);
    assert.match(friendlyAuthError({ code: "email_not_confirmed" }), /Confirm your email/);
  });

  it("falls back to the message when there is no code", () => {
    assert.match(friendlyAuthError(new Error("Invalid login credentials")), /don't match/);
    assert.match(friendlyAuthError(new TypeError("Failed to fetch")), /No connection/);
  });

  it("keeps Béa's own plain messages", () => {
    const own = "Please accept the terms and disclaimer to create your account.";
    assert.equal(friendlyAuthError(new Error(own)), own);
  });

  it("never shows nothing", () => {
    assert.equal(friendlyAuthError(null), "Something went wrong. Try again.");
    assert.equal(friendlyAuthError({}), "Something went wrong. Try again.");
  });
});
