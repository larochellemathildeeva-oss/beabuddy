import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupTimelineByDay } from "./timeline-groups.ts";
import {
  ALL_DAYS,
  dayChips,
  defaultDayChoice,
  shouldOfferDays,
  visibleGroups,
} from "./trip-days.ts";

type Row = { day_date: string | null; title: string };

const row = (day_date: string | null, title: string): Row => ({ day_date, title });

const threeDays = groupTimelineByDay([
  row("2026-09-12", "Museum"),
  row("2026-09-12", "Lunch"),
  row("2026-09-13", "Ferry"),
  row("2026-09-14", "Market"),
]);

describe("dayChips", () => {
  it("numbers the dated days in order", () => {
    const chips = dayChips(threeDays, "2026-09-13");
    assert.deepEqual(
      chips.map((c) => c.ordinal),
      ["Day 1", "Day 2", "Day 3"],
    );
    assert.deepEqual(
      chips.map((c) => c.count),
      [2, 1, 1],
    );
  });

  it("marks only today", () => {
    const chips = dayChips(threeDays, "2026-09-13");
    assert.deepEqual(
      chips.map((c) => c.isToday),
      [false, true, false],
    );
  });

  it("marks nothing when today falls outside the trip", () => {
    const chips = dayChips(threeDays, "2026-10-01");
    assert.ok(chips.every((c) => !c.isToday));
  });

  it("gives the undated pile no day number", () => {
    const groups = groupTimelineByDay([row("2026-09-12", "Museum"), row(null, "Somewhere")]);
    const chips = dayChips(groups, "");
    assert.equal(chips[0]!.ordinal, "Day 1");
    assert.equal(chips[1]!.ordinal, "");
    assert.equal(chips[1]!.label, "No date");
    // An undated group is never "today", whatever the clock says.
    assert.equal(chips[1]!.isToday, false);
  });

  it("keeps numbering the dated days when an undated pile is present", () => {
    const groups = groupTimelineByDay([
      row("2026-09-12", "Museum"),
      row(null, "Somewhere"),
      row("2026-09-13", "Ferry"),
    ]);
    assert.deepEqual(
      dayChips(groups, "").map((c) => c.ordinal),
      ["Day 1", "Day 2", ""],
    );
  });
});

describe("defaultDayChoice", () => {
  it("opens on today while the trip is running", () => {
    assert.equal(defaultDayChoice(threeDays, "2026-09-13"), "2026-09-13");
  });

  it("opens on the whole trip before it starts", () => {
    assert.equal(defaultDayChoice(threeDays, "2026-08-01"), ALL_DAYS);
  });

  it("opens on the whole trip after it ends", () => {
    assert.equal(defaultDayChoice(threeDays, "2026-12-25"), ALL_DAYS);
  });

  it("does not treat an undated pile as today", () => {
    const groups = groupTimelineByDay([row(null, "Somewhere")]);
    assert.equal(defaultDayChoice(groups, ""), ALL_DAYS);
  });
});

describe("visibleGroups", () => {
  it("returns every group for ALL_DAYS", () => {
    assert.equal(visibleGroups(threeDays, ALL_DAYS).length, 3);
  });

  it("returns just the chosen day", () => {
    const shown = visibleGroups(threeDays, "2026-09-12");
    assert.equal(shown.length, 1);
    assert.deepEqual(
      shown[0]!.items.map((i) => i.title),
      ["Museum", "Lunch"],
    );
  });

  it("selects the undated pile by its empty key", () => {
    const groups = groupTimelineByDay([row("2026-09-12", "Museum"), row(null, "Somewhere")]);
    const shown = visibleGroups(groups, "");
    assert.equal(shown.length, 1);
    assert.equal(shown[0]!.items[0]!.title, "Somewhere");
  });

  it("falls back to the whole trip when the day has gone", () => {
    // The last row on a day is removed, or a collaborator moves it: the
    // choice still points at a day nothing answers to. Showing the trip is
    // recoverable; showing nothing looks like the timeline was wiped.
    assert.equal(visibleGroups(threeDays, "2026-09-30").length, 3);
  });

  it("does not hand back the caller's array", () => {
    const shown = visibleGroups(threeDays, ALL_DAYS);
    shown.pop();
    assert.equal(threeDays.length, 3);
  });
});

describe("shouldOfferDays", () => {
  it("stays quiet for an empty trip", () => {
    assert.equal(shouldOfferDays(groupTimelineByDay([] as Row[])), false);
  });

  it("stays quiet when there is only one day to choose", () => {
    assert.equal(shouldOfferDays(groupTimelineByDay([row("2026-09-12", "Museum")])), false);
  });

  it("offers the strip once there are two", () => {
    assert.equal(shouldOfferDays(threeDays), true);
  });

  it("counts an undated pile as a second choice", () => {
    const groups = groupTimelineByDay([row("2026-09-12", "Museum"), row(null, "Somewhere")]);
    assert.equal(shouldOfferDays(groups), true);
  });
});
