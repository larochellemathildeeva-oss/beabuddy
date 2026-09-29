import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  cleanTripPreferences,
  TRIP_PREFERENCE_CHOICES,
  TRIP_PREFERENCES_MAX,
  tripPreferencePrompt,
} from "./trip-preferences.ts";

test("preferences are trimmed, deduplicated and capped", () => {
  assert.deepEqual(
    cleanTripPreferences([" Late  mornings ", "late mornings", "", null, "No nightlife"]),
    ["Late mornings", "No nightlife"],
  );
  const many = Array.from({ length: 20 }, (_, i) => `Wish ${i}`);
  assert.equal(cleanTripPreferences(many).length, TRIP_PREFERENCES_MAX);
  assert.equal(cleanTripPreferences(["x".repeat(200)])[0]!.length, 80);
});

test("the prompt says these come first, and is empty with none", () => {
  const text = tripPreferencePrompt(["Less walking", "Travelling with Dad"]);
  assert.match(text, /^Just for this trip/);
  assert.match(text, /- Less walking\n- Travelling with Dad$/);
  assert.equal(tripPreferencePrompt([]), "");
  assert.equal(tripPreferencePrompt(null), "");
});

test("the ready-made choices fit", () => {
  assert.ok(TRIP_PREFERENCE_CHOICES.length <= TRIP_PREFERENCES_MAX);
});
