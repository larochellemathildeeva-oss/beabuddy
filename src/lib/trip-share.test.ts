import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  sharedStopMapsUrl,
  isShareToken,
  newShareToken,
  shareClientKey,
  sharedNow,
  sharedStopStatus,
  sharedTripView,
  shareUrl,
} from "./trip-share.ts";

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

test("readers are limited by address, and IPv6 ones by their /64", () => {
  assert.equal(shareClientKey("203.0.113.7"), "203.0.113.7");
  assert.equal(shareClientKey("::ffff:203.0.113.7"), "203.0.113.7");
  // Every address in one /64 shares a key, however it is written.
  const a = shareClientKey("2001:db8:abcd:12:1111:2222:3333:4444");
  assert.equal(a, "2001:db8:abcd:12::/64");
  assert.equal(shareClientKey("2001:0db8:abcd:0012::9"), a);
  assert.equal(shareClientKey("[2001:db8:abcd:12:ffff::1]"), a);
  assert.notEqual(shareClientKey("2001:db8:abcd:13::1"), a);
  assert.equal(shareClientKey("::1"), "0:0:0:0::/64");
  assert.equal(shareClientKey(""), "unknown");
});

test("a shared stop with an address opens a maps search for it", () => {
  assert.equal(
    sharedStopMapsUrl({ title: "Café Lomi", address: "3 ter Rue Marcadet, Paris" }),
    "https://www.google.com/maps/search/?api=1&query=Caf%C3%A9%20Lomi%2C%203%20ter%20Rue%20Marcadet%2C%20Paris",
  );
});

test("a shared stop with no address gets no maps link", () => {
  assert.equal(sharedStopMapsUrl({ title: "Free afternoon", address: "  " }), null);
});

const LISBON = {
  title: "Lisbon",
  city: "Lisbon",
  country: "Portugal",
  start_date: "2026-10-05",
  end_date: "2026-10-05",
};
const NOW = Date.parse("2026-10-05T12:00:00Z");
const stop = (title: string, position: number, extra: Record<string, string | null> = {}) => ({
  day_date: "2026-10-05",
  time_label: null,
  kind: "sight",
  title,
  address: null,
  position,
  ...extra,
});

test("a link that follows along shows the stop they are at and the ones done", () => {
  const view = sharedTripView(
    LISBON,
    [
      stop("Belém", 0, { arrived_at: "2026-10-05T09:00:00Z", left_at: "2026-10-05T10:30:00Z" }),
      stop("Alfama", 1, { arrived_at: "2026-10-05T11:15:00Z", left_at: null }),
      stop("Dinner", 2),
    ],
    { following: true, now: NOW },
  );
  assert.equal(view.following, true);
  assert.deepEqual(
    view.days[0]!.stops.map((s) => s.status),
    ["done", "here", undefined],
  );
  assert.equal(sharedNow(view)?.stop.title, "Alfama");
  // The times of the taps never leave.
  assert.doesNotMatch(JSON.stringify(view), /T09:00|T11:15|T10:30/);
});

test("a link that does not follow along shows no progress", () => {
  const view = sharedTripView(
    LISBON,
    [stop("Alfama", 1, { arrived_at: "2026-10-05T11:15:00Z", left_at: null })],
    { following: false, now: NOW },
  );
  assert.equal(view.following, false);
  assert.equal(view.days[0]!.stops[0]!.status, undefined);
  assert.equal(sharedNow(view), null);
});

test("an old arrival with no leaving is done, not here", () => {
  assert.equal(
    sharedStopStatus({ arrived_at: "2026-10-04T08:00:00Z", left_at: null }, NOW),
    "done",
  );
  assert.equal(
    sharedStopStatus({ arrived_at: "2026-10-05T08:00:00Z", left_at: null }, NOW),
    "here",
  );
  assert.equal(sharedStopStatus({ arrived_at: null, left_at: null }, NOW), undefined);
  assert.equal(sharedStopStatus({ arrived_at: "nonsense" }, NOW), undefined);
});

test("two stops marked here at once: the later one is where they are", () => {
  const view = sharedTripView(
    LISBON,
    [
      stop("Belém", 0, { arrived_at: "2026-10-05T09:00:00Z" }),
      stop("Alfama", 1, { arrived_at: "2026-10-05T11:15:00Z" }),
    ],
    { following: true, now: NOW },
  );
  assert.deepEqual(
    view.days[0]!.stops.map((s) => s.status),
    ["done", "here"],
  );
});

test("several stops here at once: the latest arrival wins, whatever the plan order", () => {
  const view = sharedTripView(
    LISBON,
    [
      stop("Belém", 0, { arrived_at: "2026-10-05T11:30:00Z" }),
      stop("Alfama", 1, { arrived_at: "2026-10-05T09:00:00Z" }),
    ],
    { following: true, now: NOW },
  );
  assert.deepEqual(
    view.days[0]!.stops.map((s) => s.status),
    ["here", "done"],
  );
});
