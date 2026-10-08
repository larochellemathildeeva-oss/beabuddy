import assert from "node:assert/strict";
import { it } from "node:test";
import { tripsView } from "./trips-view.ts";
import { safeRedirectPath } from "./auth-redirect.ts";
it("opens the populated Following destination and refuses unknown views", () => {
  assert.equal(tripsView("following"), "following");
  for (const invalid of [undefined, null, [], "Following", "unknown"]) {
    assert.equal(tripsView(invalid), undefined);
  }
});
it("retains the shared-trip destination through safe auth redirects", () => {
  assert.equal(safeRedirectPath("/shared/abc-123"), "/shared/abc-123");
});
