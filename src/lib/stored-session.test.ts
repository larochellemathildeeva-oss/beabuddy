import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasStoredSessionKey, userFromStoredSession } from "./stored-session.ts";

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

describe("userFromStoredSession", () => {
  it("reads the user out of a saved session, expired or not", () => {
    const raw = JSON.stringify({
      access_token: "x",
      expires_at: 1,
      user: { id: "u1", email: "a@b.c" },
    });
    assert.equal(userFromStoredSession(raw)?.id, "u1");
  });

  it("answers null for anything else", () => {
    assert.equal(userFromStoredSession(null), null);
    assert.equal(userFromStoredSession("not json"), null);
    assert.equal(userFromStoredSession(JSON.stringify({ user: { id: 7 } })), null);
    assert.equal(userFromStoredSession("null"), null);
  });
});
