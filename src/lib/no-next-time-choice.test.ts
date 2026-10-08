import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";

// Next time is part of the Bucket list (place-lists.ts): no picker offers it.
const PICKERS = [
  "components/recs/SaveSheet.tsx",
  "components/RecoListImport.tsx",
  "components/TripPlacesImport.tsx",
  "components/recs/ExploreNearby.tsx",
  "routes/recommendations.tsx",
  "components/AddVisitedCity.tsx",
  "components/NearbyMapPin.tsx",
];

test("no save picker offers Next time", () => {
  for (const file of PICKERS) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
    assert.ok(!/\[[^\]]*"nexttime"[^\]]*\]/.test(source), `${file} lists "nexttime" as a choice`);
    assert.ok(!/type: "nexttime"/.test(source), `${file} has a Next time option`);
    assert.ok(!/"Next time"/.test(source), `${file} still says "Next time"`);
  }
});
