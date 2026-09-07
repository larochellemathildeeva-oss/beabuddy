import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertNewPasswordAllowed,
  isPasswordPwned,
  MIN_NEW_PASSWORD_LENGTH,
  PasswordRejectedError,
  sha1HexUpper,
} from "./pwned-password.ts";

describe("pwned-password", () => {
  it("hashes with SHA-1 uppercase hex", async () => {
    // "password" → known SHA-1
    assert.equal(await sha1HexUpper("password"), "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8");
  });

  it("detects a pwned suffix in a padded range response", async () => {
    const hash = await sha1HexUpper("password");
    const suffix = hash.slice(5);
    const fakeFetch: typeof fetch = async () =>
      new Response(`00AABBCCDDEE:2\n${suffix}:3733915\nFFFEEEDDDCCC:1\n`, {
        status: 200,
      });
    assert.equal(await isPasswordPwned("password", fakeFetch), true);
  });

  it("returns false when suffix is absent", async () => {
    const fakeFetch: typeof fetch = async () =>
      new Response("00AABBCCDDEE:2\nFFFEEEDDDCCC:1\n", { status: 200 });
    assert.equal(await isPasswordPwned("password", fakeFetch), false);
  });

  it("returns null when the range API fails", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("offline");
    };
    assert.equal(await isPasswordPwned("password", fakeFetch), null);
  });

  it("rejects short passwords", async () => {
    await assert.rejects(
      () => assertNewPasswordAllowed("short"),
      (err: unknown) =>
        err instanceof PasswordRejectedError &&
        err.message.includes(String(MIN_NEW_PASSWORD_LENGTH)),
    );
  });

  it("rejects pwned passwords", async () => {
    const pw = "password12345"; // length >= MIN
    const hash = await sha1HexUpper(pw);
    const fakeFetch: typeof fetch = async () =>
      new Response(`${hash.slice(5)}:99\n`, { status: 200 });
    await assert.rejects(() => assertNewPasswordAllowed(pw, fakeFetch), PasswordRejectedError);
  });

  it("allows a long unique password when HIBP misses", async () => {
    const pw = "unique-bea-passphrase-zz";
    const fakeFetch: typeof fetch = async () => new Response("DEADBEEF00:1\n", { status: 200 });
    await assertNewPasswordAllowed(pw, fakeFetch);
  });

  it("fail-opens when HIBP is down after length passes", async () => {
    const fakeFetch: typeof fetch = async () => {
      throw new Error("offline");
    };
    await assertNewPasswordAllowed("long-enough-unique-pass", fakeFetch);
  });
});
