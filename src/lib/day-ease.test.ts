import { strict as assert } from "node:assert";
import { test } from "node:test";
import { deltaLine, EASE_PRESETS, optimizeDelta, rainPreset } from "./day-ease.ts";

test("every preset asks for one goal and keeps bookings", () => {
  for (const preset of EASE_PRESETS) {
    assert.equal(preset.goals.length, 1);
    assert.match(preset.note, /booked stop/);
    assert.ok(preset.note.length <= 400, "fits Optimize's note");
  }
});

test("the rain preset names the spell", () => {
  assert.match(rainPreset("14:00", "17:00").note, /from 14:00 to 17:00/);
  assert.match(rainPreset("14:00", null).note, /from 14:00:/);
  assert.deepEqual(rainPreset("14:00", null).goals, ["rainy"]);
});

test("the delta counts moved, unchanged and left-out stops", () => {
  const original = [
    { id: "a", day_date: "2026-10-06", time_label: "09:00" },
    { id: "b", day_date: "2026-10-06", time_label: "11:00" },
    { id: "c", day_date: "2026-10-06", time_label: null },
  ];
  const proposed = [
    { id: "a", day_date: "2026-10-06", time_label: "10:00" },
    { id: "b", day_date: "2026-10-06", time_label: "11:00" },
    { id: "zz", day_date: "2026-10-06", time_label: "12:00" },
  ];
  const delta = optimizeDelta(original, proposed, { beforeSec: 7200, afterSec: 4920 });
  assert.deepEqual(delta, { moved: 1, stayed: 1, untouched: 1, travelSavedSec: 2280 });
  assert.equal(
    deltaLine(delta),
    "1 stop moved · 1 unchanged · 1 left as it was · about 38 min less getting around",
  );
});

test("the delta line says nothing moved, and more travel when it is more", () => {
  const same = [{ id: "a", day_date: null, time_label: null }];
  assert.equal(
    deltaLine(optimizeDelta(same, same)),
    "Nothing moved · 1 unchanged · nothing removed",
  );
  assert.match(
    deltaLine({ moved: 2, stayed: 0, untouched: 0, travelSavedSec: -3900 }),
    /about 1 h 5 min more getting around$/,
  );
});
