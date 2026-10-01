import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasStoredSessionKey } from "./stored-session.ts";

describe("hasStoredSessionKey", () => {
  it("finds Supabase's session key", () => {
    assert.equal(hasStoredSessionKey(["theme", "sb-fjfonywfnskriwlhbriw-auth-token"]), true);
  });

  it("ignores other keys, including the PKCE verifier", () => {
    assert.equal(hasStoredSessionKey([]), false);
    assert.equal(hasStoredSessionKey(["bea-google-signin", "theme"]), false);
    assert.equal(hasStoredSessionKey(["sb-abc-auth-token-code-verifier"]), false);
  });
});
