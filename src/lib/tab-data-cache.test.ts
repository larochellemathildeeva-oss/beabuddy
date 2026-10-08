import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// A tab you come back to opens on what it last loaded and refreshes in the
// background (screen-cache.ts); without it Home, World and Recs drew empty and
// waited on the database at every switch.
const HOOKS = ["hooks/useTrips.ts", "hooks/useRecommendations.ts", "hooks/usePhotoMemories.ts"];

test("the hooks behind the tabs open on what they last loaded", () => {
  for (const file of HOOKS) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.match(source, /lastLoaded</, `${file} does not start from its last load`);
    assert.match(source, /rememberLoaded[<(]/, `${file} does not keep what it loaded`);
  }
});

test("saved places are not fetched a second time by the sign-in event a subscription fires at once", () => {
  const source = readFileSync(new URL("../hooks/useRecommendations.ts", import.meta.url), "utf8");
  assert.match(source, /INITIAL_SESSION/, "useRecommendations reloads on INITIAL_SESSION too");
});
