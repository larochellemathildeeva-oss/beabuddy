import { strict as assert } from "node:assert";
import { test } from "node:test";
import { dateIn } from "./trip-clock.ts";
import {
  sharedStopMapsUrl,
  pickSharedPhotos,
  SHARED_PHOTOS_MAX,
  isShareToken,
  newShareToken,
  shareClientKey,
  sharedLive,
  sharedTripZone,
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

test("a recent arrival on an earlier day is done, not here", () => {
  const view = sharedTripView(
    LISBON,
    [
      { ...stop("Fado bar", 0, { arrived_at: "2026-10-04T23:30:00Z" }), day_date: "2026-10-04" },
      { ...stop("Belém", 0), day_date: "2026-10-05" },
    ],
    { following: true, now: Date.parse("2026-10-05T07:00:00Z") },
  );
  assert.equal(view.days[0]!.stops[0]!.status, "done");
});

test("the morning cutoff follows the wall clock across daylight saving", () => {
  const zoneAt = () => "America/Los_Angeles";
  const arrived = { arrived_at: "2026-03-07T23:00:00-08:00" };
  const at = (now: string) =>
    sharedTripView(
      LISBON,
      [{ ...stop("Late", 0, arrived), day_date: "2026-03-07", lat: 34, lon: -118 }] as never,
      { following: true, now: Date.parse(now) },
      zoneAt,
    ).days[0]!.stops[0]!.status;
  // Spring forward on 8 March: 05:30 PST-equivalent is still last night, 06:30 PDT is not.
  assert.equal(at("2026-03-08T12:30:00Z"), "here");
  assert.equal(at("2026-03-08T13:30:00Z"), "done");
});

test("an unpinned day is cut off in the trip's zone, not UTC", () => {
  const zoneAt = (lat: number) => (lat > 0 ? "America/Los_Angeles" : null);
  const view = sharedTripView(
    LISBON,
    [
      { ...stop("Pinned", 0), day_date: "2026-10-04", lat: 34, lon: -118 },
      { ...stop("Late", 0, { arrived_at: "2026-10-06T05:00:00Z" }), day_date: "2026-10-05" },
    ] as never,
    // 00:30 PDT on the 6th is 07:30Z: UTC would already call the 5th over.
    { following: true, now: Date.parse("2026-10-06T07:30:00Z") },
    zoneAt,
  );
  assert.equal(view.days[1]!.stops[0]!.status, "here");
});

test("the live card: where they are, the next stop, and the day so far", () => {
  const view = sharedTripView(
    LISBON,
    [
      stop("Belém", 0, { arrived_at: "2026-10-05T09:00:00Z", left_at: "2026-10-05T10:30:00Z" }),
      stop("Alfama", 1, { arrived_at: "2026-10-05T11:15:00Z", left_at: null }),
      stop("Dinner", 2),
    ],
    { following: true, now: NOW },
  );
  const live = sharedLive(view, "2026-10-05");
  assert.equal(live.now?.stop.title, "Alfama");
  assert.equal(live.next?.stop.title, "Dinner");
  assert.deepEqual(live.day, { day: "2026-10-05", done: 1, total: 3 });
});

test("the live card between stops points at the one after the last done", () => {
  const view = sharedTripView(
    LISBON,
    [
      stop("Belém", 0, { arrived_at: "2026-10-05T09:00:00Z", left_at: "2026-10-05T10:30:00Z" }),
      stop("Alfama", 1),
      stop("Dinner", 2),
    ],
    { following: true, now: NOW },
  );
  const live = sharedLive(view, "2026-10-05");
  assert.equal(live.now, null);
  assert.equal(live.next?.stop.title, "Alfama");
});

test("the live card skips days that are over, and says nothing after the trip", () => {
  const days = [
    { ...stop("Belém", 0), day_date: "2026-10-04" },
    { ...stop("Sintra", 0), day_date: "2026-10-06" },
  ];
  const view = sharedTripView(LISBON, days, { following: true, now: NOW });
  assert.equal(sharedLive(view, "2026-10-05").next?.stop.title, "Sintra");
  assert.equal(sharedLive(view, "2026-10-04").next?.stop.title, "Belém");
  assert.equal(sharedLive(view, "2026-10-07").next, null);
  assert.equal(sharedLive(view, "2026-10-07").day, null);
});

test("the live card past midnight: still here from last night, next is today's", () => {
  const view = sharedTripView(
    LISBON,
    [
      { ...stop("Fado bar", 0, { arrived_at: "2026-10-05T22:30:00Z" }), day_date: "2026-10-05" },
      { ...stop("Late dinner", 1), day_date: "2026-10-05" },
      { ...stop("Sintra", 0), day_date: "2026-10-06" },
    ],
    { following: true, now: Date.parse("2026-10-06T00:30:00Z") },
  );
  const live = sharedLive(view, "2026-10-06");
  assert.equal(live.now?.stop.title, "Fado bar");
  assert.equal(live.next?.stop.title, "Sintra");
});

test("each day carries its time zone from its first pin, never the pins", () => {
  const zoneAt = (lat: number) => (lat > 30 ? "Asia/Tokyo" : "Asia/Bangkok");
  const view = sharedTripView(
    LISBON,
    [
      { ...stop("No pin", 0), day_date: "2026-10-05" },
      { ...stop("Kyoto", 1), day_date: "2026-10-05", lat: 35.01, lon: 135.76 },
      { ...stop("Bangkok", 0), day_date: "2026-10-06", lat: 13.75, lon: 100.5 },
      { ...stop("Nowhere", 0), day_date: "2026-10-07" },
    ] as never,
    { following: true, now: NOW },
    zoneAt,
  );
  assert.deepEqual(
    view.days.map((d) => d.zone),
    ["Asia/Tokyo", "Asia/Bangkok", undefined],
  );
  assert.doesNotMatch(JSON.stringify(view), /135\.76|35\.01|100\.5/);
  assert.equal(sharedTripZone(view, "2026-10-06"), "Asia/Bangkok");
  assert.equal(sharedTripZone(view, "2026-10-07"), "Asia/Bangkok");
  assert.equal(sharedTripZone(view), "Asia/Tokyo");
});

test("each day is over on its own calendar, across time zones", () => {
  // Tokyo then Los Angeles. At 06:00 UTC on 3 October it is the 3rd in
  // Tokyo but still the 2nd in Los Angeles, where stops are left.
  const at = Date.parse("2026-10-03T06:00:00Z");
  const view = sharedTripView(
    LISBON,
    [
      { ...stop("Senso-ji", 0), day_date: "2026-10-01", lat: 35.7, lon: 139.8 },
      { ...stop("Griffith", 0), day_date: "2026-10-02", lat: 34.1, lon: -118.3 },
      { ...stop("Santa Monica", 1), day_date: "2026-10-02", lat: 34.0, lon: -118.5 },
    ] as never,
    { following: true, now: at },
    (_lat, lon) => (lon > 0 ? "Asia/Tokyo" : "America/Los_Angeles"),
  );
  const todayIn = (zone: string | undefined) => dateIn(zone ?? "UTC", at);
  assert.equal(sharedLive(view, todayIn).next?.stop.title, "Griffith");
  // One date for the whole trip, Tokyo's, would have skipped them.
  assert.equal(sharedLive(view, "2026-10-03").next, null);
});

const owner = "11111111-1111-1111-1111-111111111111";
const photoRow = (over: Partial<Parameters<typeof pickSharedPhotos>[0][number]> = {}) => ({
  user_id: owner,
  storage_path: `${owner}/a.jpg`,
  itinerary_item_id: null,
  taken_at: "2026-10-05T10:00:00Z",
  hidden_from_links: false,
  ...over,
});

test("a link shows only photos their owner has not kept off links", () => {
  const picked = pickSharedPhotos([
    photoRow({ storage_path: `${owner}/shown.jpg` }),
    photoRow({ storage_path: `${owner}/hidden.jpg`, hidden_from_links: true }),
    // Not read with the flag (older database): never shown.
    photoRow({ storage_path: `${owner}/unknown.jpg`, hidden_from_links: null }),
  ]);
  assert.deepEqual(
    picked.map((p) => p.storage_path),
    [`${owner}/shown.jpg`],
  );
});

test("a link never shows location-only rows or a file outside the owner's folder", () => {
  const picked = pickSharedPhotos([
    photoRow({ storage_path: "location-only:abc" }),
    photoRow({ storage_path: "22222222-2222-2222-2222-222222222222/theirs.jpg" }),
    photoRow({ storage_path: `${owner}/../22222222-2222-2222-2222-222222222222/x.jpg` }),
    photoRow({ storage_path: `${owner}/ok.jpg` }),
  ]);
  assert.deepEqual(
    picked.map((p) => p.storage_path),
    [`${owner}/ok.jpg`],
  );
});

test("photos come in the order taken and are capped", () => {
  const rows = Array.from({ length: SHARED_PHOTOS_MAX + 10 }, (_, i) =>
    photoRow({
      storage_path: `${owner}/${String(i).padStart(3, "0")}.jpg`,
      taken_at: `2026-10-05T10:${String(59 - (i % 60)).padStart(2, "0")}:00Z`,
    }),
  );
  const picked = pickSharedPhotos(rows);
  assert.equal(picked.length, SHARED_PHOTOS_MAX);
  const times = picked.map((p) => p.taken_at!);
  assert.deepEqual(times, [...times].sort());
});

test("photos sit under their stop, and the rest under the trip, with nothing private", () => {
  const trip = { title: "Lisbon", city: null, country: null, start_date: null, end_date: null };
  const items = [
    {
      id: "s1",
      day_date: "2026-10-05",
      time_label: "10:00",
      kind: "sight",
      title: "Alfama",
      address: null,
      position: 0,
    },
    {
      id: "n1",
      day_date: "2026-10-05",
      time_label: null,
      kind: "note",
      title: "Note",
      address: null,
      position: 1,
    },
  ];
  const a = { url: "https://x/a", takenAt: null };
  const b = { url: "https://x/b", takenAt: null };
  const c = { url: "https://x/c", takenAt: null };
  const view = sharedTripView(trip, items, undefined, undefined, [
    { itemId: "s1", photo: a },
    { itemId: null, photo: b },
    // A stop the plan does not show (a note) still shows, under the trip.
    { itemId: "n1", photo: c },
  ]);
  assert.deepEqual(view.days[0]!.stops[0]!.photos, [a]);
  assert.deepEqual(view.photos, [b, c]);
  assert.ok(!JSON.stringify(view).includes("n1"));
  // A link without photos carries no photo keys at all.
  const plain = sharedTripView(trip, items);
  assert.equal(plain.photos, undefined);
  assert.equal(plain.days[0]!.stops[0]!.photos, undefined);
});
