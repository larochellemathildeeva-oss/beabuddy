import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasPendingOAuthResult, safeRedirectPath } from "./auth-redirect.ts";

describe("hasPendingOAuthResult", () => {
  it("holds the redirect while a PKCE code is still in the URL", () => {
    // The bug: AppShell redirected here, rewriting the URL and destroying a
    // single-use code, so a completed Google sign-in landed on /auth.
    assert.equal(hasPendingOAuthResult("?code=abc123", ""), true);
    assert.equal(hasPendingOAuthResult("?code=abc123&state=xyz", ""), true);
  });

  it("holds for the implicit flow, which returns tokens in the hash", () => {
    assert.equal(hasPendingOAuthResult("", "#access_token=tok&token_type=bearer"), true);
    assert.equal(hasPendingOAuthResult("", "#refresh_token=r1"), true);
  });

  it("holds when the provider reported a failure", () => {
    // Bouncing to a sign-in page that cannot explain the failure is worse than
    // letting Supabase surface it.
    assert.equal(hasPendingOAuthResult("?error=access_denied", ""), true);
    assert.equal(hasPendingOAuthResult("", "#error_description=User%20cancelled"), true);
  });

  it("does not hold for ordinary navigation", () => {
    // A signed-out visitor on a gated page must still be sent to /auth.
    assert.equal(hasPendingOAuthResult("", ""), false);
    assert.equal(hasPendingOAuthResult("?", "#"), false);
    assert.equal(hasPendingOAuthResult("?tab=trips", "#packing"), false);
    assert.equal(hasPendingOAuthResult("?city=Lisbon&sort=recent", ""), false);
  });

  it("ignores empty values, so a bare ?code= does not wedge the app", () => {
    assert.equal(hasPendingOAuthResult("?code=", ""), false);
    assert.equal(hasPendingOAuthResult("", "#access_token="), false);
  });
});

describe("safeRedirectPath", () => {
  it("keeps a path on this site, with its search and hash", () => {
    assert.equal(safeRedirectPath("/trips/abc"), "/trips/abc");
    assert.equal(
      safeRedirectPath("/trips/abc?view=bookings#day-2"),
      "/trips/abc?view=bookings#day-2",
    );
  });

  it("refuses anything that leaves the site", () => {
    assert.equal(safeRedirectPath("https://evil.example/"), null);
    assert.equal(safeRedirectPath("//evil.example/x"), null);
    assert.equal(safeRedirectPath("/\\evil.example"), null);
    assert.equal(safeRedirectPath("javascript:alert(1)"), null);
    assert.equal(safeRedirectPath("/trips\n//x"), null);
  });

  it("never returns to a sign-in page", () => {
    assert.equal(safeRedirectPath("/auth"), null);
    assert.equal(safeRedirectPath("/auth?redirect=/trips"), null);
    assert.equal(safeRedirectPath("/reset-password"), null);
  });

  it("ignores missing and odd values", () => {
    assert.equal(safeRedirectPath(undefined), null);
    assert.equal(safeRedirectPath(42), null);
    assert.equal(safeRedirectPath(""), null);
  });
});
