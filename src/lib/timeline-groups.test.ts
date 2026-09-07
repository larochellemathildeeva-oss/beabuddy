import assert from "node:assert/strict";
import test from "node:test";
import { formatTimelineDayLabel, groupTimelineByDay } from "./timeline-groups.ts";

test("formatTimelineDayLabel uses weekday and month day", () => {
  assert.equal(formatTimelineDayLabel("2026-09-12"), "Sat · Sep 12");
});

test("formatTimelineDayLabel returns the raw string when unparseable", () => {
  assert.equal(formatTimelineDayLabel("soon"), "soon");
});

test("groupTimelineByDay clusters consecutive same-day rows", () => {
  const groups = groupTimelineByDay([
    { id: "1", day_date: "2026-09-12", title: "Museum" },
    { id: "2", day_date: "2026-09-12", title: "Lunch" },
    { id: "3", day_date: "2026-09-13", title: "Park" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.key, "2026-09-12");
  assert.equal(groups[0]?.label, "Sat · Sep 12");
  assert.deepEqual(
    groups[0]?.items.map((i) => i.id),
    ["1", "2"],
  );
  assert.equal(groups[1]?.key, "2026-09-13");
  assert.deepEqual(
    groups[1]?.items.map((i) => i.id),
    ["3"],
  );
});

test("groupTimelineByDay puts undated rows last", () => {
  const groups = groupTimelineByDay([
    { id: "a", day_date: null, title: "Idea" },
    { id: "b", day_date: "2026-09-12", title: "Museum" },
    { id: "c", day_date: null, title: "Note" },
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups[0]?.key, "2026-09-12");
  assert.equal(groups[1]?.key, "");
  assert.equal(groups[1]?.label, "No date");
  assert.deepEqual(
    groups[1]?.items.map((i) => i.id),
    ["a", "c"],
  );
});

test("groupTimelineByDay preserves first-seen day order across gaps", () => {
  const groups = groupTimelineByDay([
    { id: "1", day_date: "2026-09-14", title: "Later" },
    { id: "2", day_date: "2026-09-12", title: "Earlier" },
    { id: "3", day_date: "2026-09-14", title: "Later again" },
  ]);
  assert.deepEqual(
    groups.map((g) => g.key),
    ["2026-09-14", "2026-09-12"],
  );
  assert.deepEqual(
    groups[0]?.items.map((i) => i.id),
    ["1", "3"],
  );
});
