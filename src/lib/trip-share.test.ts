import { strict as assert } from "node:assert";
import { test } from "node:test";
import { isShareToken, newShareToken, sharedTripView, shareUrl } from "./trip-share.ts";

test("tokens are 256 random bits, url-safe, and never repeat", () => {
  const a = newShareToken();
  const b = newShareToken();
  assert.equal(a.length, 43);
  assert.ok(isShareToken(a));
  assert.notEqual(a, b);
  assert.equal(isShareToken("short"), false);
  assert.equal(isShareToken(`${a}/../x`), false);
});

test("the view shows the plan and nothing private", () => {
  const view = sharedTripView(
    {
      title: "Lisbon",
      city: "Lisbon, Portugal",
      country: "Portugal",
      start_date: "2026-10-05",
      end_date: "2026-10-06",
    },
    [
      {
        day_date: "2026-10-06",
        time_label: "19:30",
        kind: "meal",
        title: "Dinner",
        address: "Rua 1",
        position: 1,
        booking_ref: "SECRET",
        detail: "door code 1234",
      } as never,
      {
        day_date: "2026-10-05",
        time_label: "9am",
        kind: "sight",
        title: "Belém",
        address: null,
        position: 0,
      },
      {
        day_date: "2026-10-05",
        time_label: null,
        kind: "note",
        title: "Call bank",
        address: null,
        position: 1,
      },
      {
        day_date: "2026-10-05",
        time_label: null,
        kind: "walk",
        title: "Walk to Alfama",
        address: null,
        position: 2,
      },
      {
        day_date: "2026-10-05",
        time_label: null,
        kind: "sight",
        title: "Inside",
        address: null,
        position: 3,
        parent_id: "x",
      },
    ],
  );
  assert.equal(view.place, "Lisbon, Portugal");
  assert.deepEqual(view.days, [
    { day: "2026-10-05", stops: [{ time: "09:00", title: "Belém", kind: "sight", address: "" }] },
    {
      day: "2026-10-06",
      stops: [{ time: "19:30", title: "Dinner", kind: "meal", address: "Rua 1" }],
    },
  ]);
  const text = JSON.stringify(view);
  assert.doesNotMatch(text, /SECRET|door code|Call bank/);
});

test("the link", () => {
  assert.equal(shareUrl("https://bea.app/", "abc"), "https://bea.app/shared/abc");
});
