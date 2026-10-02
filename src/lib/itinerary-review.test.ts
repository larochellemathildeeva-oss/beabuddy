import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  changeSetForMoves,
  changeSetForSchedulePatch,
  checkReviewProposal,
  inverseScheduleUpdates,
  updatesForConsequence,
} from "./itinerary-review.ts";

const day = "2026-10-02";

function stop(
  id: string,
  position: number,
  time_label: string | null,
  extra: Record<string, unknown> = {},
) {
  return {
    id,
    day_date: day,
    time_label,
    position,
    planned_stay_minutes: 60,
    time_locked: false,
    ...extra,
  };
}

test("a reorder keeps displaced rows in the proposal without counting them as direct edits", () => {
  const stops = [stop("a", 0, null), stop("b", 1, null), stop("c", 2, null)];
  const proposal = changeSetForMoves(stops, [{ id: "a", day_date: day, at: "end" }]);
  assert.ok(proposal);
  assert.deepEqual([...proposal.directIds], ["a"]);

  const result = checkReviewProposal(stops, proposal);
  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(
    result.proposedSchedule.map((row) => [row.id, row.position]),
    [
      ["b", 0],
      ["c", 1],
      ["a", 2],
    ],
  );
});

test("a duration change may ripple two flexible stops by 30 minutes without Review", () => {
  const stops = [
    stop("a", 0, "10:00", { planned_stay_minutes: 60 }),
    stop("b", 1, "11:30", { planned_stay_minutes: 60 }),
    stop("c", 2, "13:00", { planned_stay_minutes: 60 }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 90 });
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal, {
    travelLegs: [
      { fromId: "a", toId: "b", seconds: 30 * 60 },
      { fromId: "b", toId: "c", seconds: 30 * 60 },
    ],
  });

  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(
    result.shifts.map((shift) => [shift.stopId, shift.deltaMinutes, shift.downstream]),
    [
      ["b", 30, true],
      ["c", 30, true],
    ],
  );
  assert.deepEqual(updatesForConsequence(stops, result), [
    { id: "a", planned_stay_minutes: 90 },
    { id: "b", time_label: "12:00" },
    { id: "c", time_label: "13:30" },
  ]);
});

test("a downstream shift over 30 minutes requires Review", () => {
  const stops = [
    stop("a", 0, "10:00", { planned_stay_minutes: 60 }),
    stop("b", 1, "11:30", { planned_stay_minutes: 60 }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 120 });
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal, {
    travelLegs: [{ fromId: "a", toId: "b", seconds: 30 * 60 }],
  });

  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("large-shift"));
  assert.equal(result.shifts[0]?.deltaMinutes, 60);
});

test("moving a stop to another day always requires Review", () => {
  const stops = [stop("a", 0, "10:00"), stop("b", 1, "12:00")];
  const proposal = changeSetForMoves(stops, [{ id: "a", day_date: "2026-10-03", at: "start" }]);
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal);
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("crosses-day"));
});

test("inverse updates restore exactly the fields an applied consequence changed", () => {
  const before = [stop("a", 0, "10:00", { planned_stay_minutes: 60 })];
  const inverse = inverseScheduleUpdates(before, [
    { id: "a", time_label: "11:00", position: 2, planned_stay_minutes: 90 },
  ]);
  assert.deepEqual(inverse, [
    { id: "a", time_label: "10:00", position: 0, planned_stay_minutes: 60 },
  ]);
});

// ---- Regression tests for the PR 223 review ----------------------------------

import { checkChange, type ChangeSet, type ScheduleStop } from "./itinerary-change.ts";
import { haversine } from "./geo.ts";
import { estimatedLegSeconds } from "./route-estimate.ts";
import { legModeFor, type TravelChoice } from "./travel-mode.ts";
import { scheduleUpdatesForPatch, scheduleWritePlan } from "./itinerary-schedule-write.ts";
import { blockedReason, formatShiftMinutes, reviewLines } from "./review-lines.ts";

const DAY1 = "2026-10-02";
const DAY2 = "2026-10-03";

type Row = ScheduleStop & { title: string; updated_at: string };

function row(
  id: string,
  day_date: string | null,
  position: number,
  time_label: string | null,
  extra: Partial<Row> = {},
): Row {
  return {
    id,
    title: id.toUpperCase(),
    updated_at: "2026-10-01T00:00:00Z",
    day_date,
    position,
    time_label,
    planned_stay_minutes: 60,
    time_locked: null,
    ...extra,
  };
}

/** The persisted fields of a schedule, for comparing a write with a proposal. */
function persisted(rows: readonly ScheduleStop[]) {
  return [...rows]
    .map((r) => ({
      id: r.id,
      day_date: r.day_date,
      time_label: r.time_label,
      position: r.position,
      planned_stay_minutes: r.planned_stay_minutes ?? null,
      time_locked: r.time_locked ?? null,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

test("editing day 1 cannot move or flag day 2, even when positions renumber across the trip", () => {
  // Day 2 has a pair that is already tight and a leg nothing can estimate.
  const stops = [
    row("a", DAY1, 0, "10:00"),
    row("b", DAY1, 1, "12:00"),
    row("c", DAY2, 2, "10:00"),
    row("d", DAY2, 3, "10:30"),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { time_label: "11:00" });
  assert.ok(proposal);
  // The renumbering reaches day 2 (positions are one sequence) …
  assert.ok(proposal.changeSet.changes.some((change) => change.stopId === "c"));
  const result = checkReviewProposal(stops, proposal, {
    travelLegs: [{ fromId: "a", toId: "b", seconds: 0 }],
  });
  // … but day 2 is not this edit's consequence.
  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(result.reasons, []);
  assert.deepEqual(
    result.shifts.map((shift) => shift.stopId),
    ["a"],
  );
  const day2 = result.proposedSchedule.filter((stop) => stop.day_date === DAY2);
  assert.deepEqual(
    day2.map((stop) => [stop.id, stop.time_label]),
    [
      ["c", "10:00"],
      ["d", "10:30"],
    ],
  );
});

test("a move that explicitly crosses into day 2 does check day 2", () => {
  const stops = [
    row("a", DAY1, 0, "10:00"),
    row("c", DAY2, 1, "10:00"),
    row("d", DAY2, 2, "10:30"),
  ];
  const proposal = changeSetForMoves(stops, [{ id: "a", day_date: DAY2, at: "end" }]);
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal);
  assert.ok(result.reasons.includes("crosses-day"));
  // c → d has no coordinates or leg: day 2 was checked, so that is reported.
  assert.ok(result.reasons.includes("travel-unknown"));
});

test("moving A past B and C lists only A as the traveller's change", () => {
  const stops = [row("a", DAY1, 0, null), row("b", DAY1, 1, null), row("c", DAY1, 2, null)];
  const proposal = changeSetForMoves(stops, [{ id: "a", day_date: DAY1, at: "end" }]);
  assert.ok(proposal);
  // b and c are in the ChangeSet (their positions change) …
  assert.deepEqual(proposal.changeSet.changes.map((change) => change.stopId).sort(), [
    "a",
    "b",
    "c",
  ]);
  // … but only a is "Your change".
  const lines = reviewLines(proposal.changeSet, proposal.directIds, stops);
  assert.deepEqual(
    lines.map((line) => line.stopId),
    ["a"],
  );
  const result = checkReviewProposal(stops, proposal);
  assert.equal(result.shifts.filter((shift) => !shift.downstream).length, 0);
  assert.equal(result.decision, "auto-apply");
});

test("the selected travel mode reaches the estimator, and the ripple is marked as an estimate", () => {
  // About 2 km apart: a walk, a drive and transit all take different times.
  const here = { lat: 45.5, lon: -73.57 };
  const there = { lat: 45.518, lon: -73.57 };
  const metres = haversine(here, there);
  const stops = [
    row("a", DAY1, 0, "10:00", { planned_stay_minutes: 0, ...here }),
    row("b", DAY1, 1, "10:01", { planned_stay_minutes: 0, ...there }),
  ];
  const times = new Map<TravelChoice, string | null>();
  for (const choice of ["walk", "drive", "transit"] as const) {
    const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 5 });
    assert.ok(proposal);
    const result = checkReviewProposal(stops, proposal, { travelChoice: choice });
    const leg = Math.ceil(estimatedLegSeconds(metres, legModeFor(choice, metres)) / 60);
    const expected = 10 * 60 + 5 + leg;
    const b = result.shifts.find((shift) => shift.stopId === "b");
    assert.ok(b, `b ripples when travelling by ${choice}`);
    assert.equal(
      b.toTime,
      `${String(Math.floor(expected / 60)).padStart(2, "0")}:${String(expected % 60).padStart(2, "0")}`,
    );
    assert.equal(b.estimated, true);
    times.set(choice, b.toTime);
  }
  assert.equal(new Set(times.values()).size, 3);
});

test("equivalent clock labels do not create a false move", () => {
  const stops = [
    row("x", DAY1, 0, "09:00"),
    row("a", DAY1, 1, "9:00 AM"),
    row("y", DAY1, 2, "09:00"),
    row("z", DAY2, 3, "08:00"),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { time_label: "09:00" });
  assert.ok(proposal);
  assert.deepEqual(
    proposal.changeSet.changes.map((change) => change.type),
    ["retime"],
  );
  const result = checkReviewProposal(stops, proposal);
  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(result.shifts, []);
  assert.deepEqual(updatesForConsequence(stops, result), [{ id: "a", time_label: "09:00" }]);
});

test("2pm, 14h30, 9:00 AM and 09:00 read the same way the Timeline reads them", () => {
  const stops = [
    row("m", DAY1, 0, "9:00 AM"),
    row("x", DAY1, 1, "12:30"),
    row("y", DAY1, 2, "16:00"),
    row("s", DAY1, 3, "Evening"),
  ];
  for (const label of ["2pm", "14h30", "2:00 PM", "14.30"]) {
    const proposal = changeSetForSchedulePatch(stops, "m", { time_label: label });
    assert.ok(proposal, label);
    const result = checkReviewProposal(stops, proposal, {
      travelLegs: [
        { fromId: "x", toId: "m", seconds: 0 },
        { fromId: "m", toId: "y", seconds: 0 },
      ],
    });
    const order = result.proposedSchedule.map((stop) => stop.id);
    assert.deepEqual(order, ["x", "m", "y", "s"], label);
    const shift = result.shifts.find((s) => s.stopId === "m");
    assert.ok(shift && shift.deltaMinutes != null && shift.deltaMinutes >= 5 * 60, label);
  }
});

test("a card edit proposes exactly the rows updateItem writes", () => {
  const stops = [
    row("a", DAY1, 0, "10:00"),
    row("b", DAY1, 1, "12:30"),
    row("c", DAY1, 2, "16:00"),
    row("d", DAY2, 3, "09:00"),
  ];
  for (const patch of [
    { time_label: "2pm" },
    { day_date: DAY2, time_label: "08:00" },
    { planned_stay_minutes: 30, time_locked: true },
  ]) {
    const written = scheduleUpdatesForPatch(stops, "a", patch);
    assert.ok(written);
    const plan = scheduleWritePlan(stops, written);
    assert.ok(plan);
    const proposal = changeSetForSchedulePatch(stops, "a", patch);
    assert.ok(proposal);
    const result = checkReviewProposal(stops, proposal, {
      travelLegs: [
        { fromId: "b", toId: "a", seconds: 0 },
        { fromId: "a", toId: "c", seconds: 0 },
        { fromId: "a", toId: "b", seconds: 0 },
        { fromId: "b", toId: "c", seconds: 0 },
        { fromId: "a", toId: "d", seconds: 0 },
      ],
    });
    // No ripple here, so the proposal is the write.
    assert.deepEqual(persisted(result.proposedSchedule), persisted(plan.optimistic));
  }
});

test("a time lock in the same card edit is checked and persisted", () => {
  const stops = [
    row("a", DAY1, 0, "10:00", { planned_stay_minutes: 60 }),
    row("b", DAY1, 1, "11:00", { planned_stay_minutes: 60, time_locked: false }),
  ];
  const legs = { travelLegs: [{ fromId: "a", toId: "b", seconds: 30 * 60 }] };
  // Flexible: b slides to fit.
  const flexible = changeSetForSchedulePatch(stops, "b", { planned_stay_minutes: 90 });
  assert.ok(flexible);
  assert.equal(
    checkReviewProposal(stops, flexible, legs).proposedSchedule.find((s) => s.id === "b")
      ?.time_label,
    "11:30",
  );
  // Fixed in the same edit: b stays at 11:00 and the clash is reported.
  const fixed = changeSetForSchedulePatch(stops, "b", {
    planned_stay_minutes: 90,
    time_locked: true,
  });
  assert.ok(fixed);
  const result = checkReviewProposal(stops, fixed, legs);
  assert.equal(result.proposedSchedule.find((s) => s.id === "b")?.time_label, "11:00");
  assert.ok(result.reasons.includes("fixed-constraint"));
  assert.deepEqual(updatesForConsequence(stops, result), [
    { id: "b", planned_stay_minutes: 90, time_locked: true },
  ]);
  assert.deepEqual(
    reviewLines(fixed.changeSet, fixed.directIds, stops).map((line) => [line.before, line.after]),
    [
      ["1 h", "1 h 30 min"],
      ["Flexible", "Fixed"],
    ],
  );
});

test("every change type Review accepts has a matching persistence path", () => {
  const stops = [
    row("a", DAY1, 0, "10:00", { planned_stay_minutes: 30 }),
    row("b", DAY1, 1, "12:00", { planned_stay_minutes: 30 }),
    row("c", DAY2, 2, "09:00", { planned_stay_minutes: 30 }),
  ];
  const changeSets: ChangeSet["changes"][] = [
    [
      {
        id: "1",
        type: "move",
        stopId: "a",
        from: { dayDate: DAY1, position: 0 },
        to: { dayDate: DAY2, position: 3, preferredTime: "11:00" },
      },
    ],
    [{ id: "2", type: "retime", stopId: "b", fromTime: "12:00", toTime: "13:00" }],
    [{ id: "3", type: "duration", stopId: "a", fromMinutes: 30, toMinutes: 45 }],
    [{ id: "4", type: "lock", stopId: "b", fromLocked: null, toLocked: true }],
  ];
  for (const changes of changeSets) {
    const proposal = {
      changeSet: {
        id: "t",
        source: "manual" as const,
        changes: changes as never,
        createdAt: 0,
      },
      directIds: new Set(changes.map((change) => ("stopId" in change ? change.stopId : ""))),
    };
    const result = checkReviewProposal(stops, proposal, {
      travelLegs: [
        { fromId: "a", toId: "b", seconds: 0 },
        { fromId: "c", toId: "a", seconds: 0 },
      ],
    });
    assert.notEqual(result.decision, "blocked", changes[0]!.type);
    const plan = scheduleWritePlan(stops, updatesForConsequence(stops, result));
    assert.ok(plan, changes[0]!.type);
    assert.deepEqual(
      persisted(plan.optimistic),
      persisted(result.proposedSchedule),
      changes[0]!.type,
    );
  }
});

test("insert, delete and place are refused rather than approved and dropped", () => {
  const stops = [row("a", DAY1, 0, "10:00"), row("b", DAY1, 1, "12:00")];
  const unsupported: ChangeSet["changes"] = [
    {
      id: "i",
      type: "insert",
      tempStopId: "new",
      afterStopId: "a",
      beforeStopId: null,
      stop: row("new", DAY1, 9, "11:00"),
    },
    { id: "d", type: "delete", stopId: "b" },
    { id: "p", type: "place", stopId: "a", from: null, to: { lat: 1, lon: 2 } },
  ];
  for (const change of unsupported) {
    const proposal = {
      changeSet: { id: "t", source: "manual" as const, changes: [change] as never, createdAt: 0 },
      directIds: new Set(["a", "b", "new"]),
    };
    const result = checkReviewProposal(stops, proposal);
    assert.equal(result.decision, "blocked", change.type);
    assert.ok(result.reasons.includes("invalid-change"), change.type);
    assert.match(blockedReason(result), /can’t be saved from here/);
    // And the writer will not quietly turn it into a partial save.
    const raw = checkChange(stops, { id: "t", source: "manual", changes: [change], createdAt: 0 });
    assert.throws(() => updatesForConsequence(stops, raw), /day, time, order or length/);
  }
});

test("a stale proposal is blocked with a reason the sheet shows", () => {
  const stops = [row("a", DAY1, 0, "10:00"), row("b", DAY1, 1, "12:00")];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 90 });
  assert.ok(proposal);
  const result = checkReviewProposal(
    stops.filter((stop) => stop.id !== "a"),
    proposal,
  );
  assert.equal(result.decision, "blocked");
  assert.match(blockedReason(result), /moved or removed/);
});

test("a move to another day with a new time shows both", () => {
  const stops = [row("a", DAY1, 0, "10:00"), row("b", DAY2, 1, "09:00")];
  const proposal = changeSetForMoves(stops, [
    { id: "a", day_date: DAY2, at: "end", time_label: "15:00" },
  ]);
  assert.ok(proposal);
  const [line] = reviewLines(proposal.changeSet, proposal.directIds, stops);
  assert.ok(line);
  assert.match(line.before ?? "", /10:00/);
  assert.match(line.after ?? "", /15:00/);
  assert.notEqual(line.before, line.after);
});

test("Review's thresholds are the engine's: no second copy to drift", () => {
  const stops = [
    row("a", DAY1, 0, "10:00", { planned_stay_minutes: 60 }),
    row("b", DAY1, 1, "11:00", { planned_stay_minutes: 30 }),
    row("c", DAY1, 2, "11:30", { planned_stay_minutes: 30 }),
    row("d", DAY1, 3, "12:00", { planned_stay_minutes: 30 }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 75 });
  assert.ok(proposal);
  const options = {
    travelLegs: [
      { fromId: "a", toId: "b", seconds: 0 },
      { fromId: "b", toId: "c", seconds: 0 },
      { fromId: "c", toId: "d", seconds: 0 },
    ],
  };
  const review = checkReviewProposal(stops, proposal, options);
  const engine = checkChange(stops, proposal.changeSet, {
    ...options,
    directIds: proposal.directIds,
  });
  assert.deepEqual(review, engine);
  assert.ok(review.reasons.includes("too-many-shifts"));
});

test("shift minutes are formatted with a sign", () => {
  assert.match(formatShiftMinutes(30), /^\+30 min$/);
  assert.match(formatShiftMinutes(-15), /15 min$/);
  assert.equal(formatShiftMinutes(0), "0 min");
});

test("saved Walk rows are renumbered with the rest but the ripple steps over them", () => {
  const stops = [
    row("a", DAY1, 0, "10:00", { planned_stay_minutes: 60 }),
    row("walk", DAY1, 1, "11:00", { title: "Walk to B", planned_stay_minutes: null }),
    row("b", DAY1, 2, "11:15", { planned_stay_minutes: 60 }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 80 });
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal, {
    travelLegs: [{ fromId: "a", toId: "b", seconds: 10 * 60 }],
    travelRowIds: new Set(["walk"]),
  });
  assert.equal(result.proposedSchedule.find((s) => s.id === "b")?.time_label, "11:30");
  assert.equal(result.proposedSchedule.find((s) => s.id === "walk")?.time_label, "11:00");
});
