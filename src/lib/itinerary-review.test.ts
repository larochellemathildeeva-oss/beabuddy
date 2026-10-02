import { strict as assert } from "node:assert";
import { test } from "node:test";
import { checkChange, itineraryClockMinutes, type ChangeSet } from "./itinerary-change.ts";
import {
  changeSetForMoves,
  changeSetForSchedulePatch,
  checkReviewProposal,
  inverseScheduleUpdates,
  updatesForConsequence,
} from "./itinerary-review.ts";

const day = "2026-10-02";
const nextDay = "2026-10-03";

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
  assert.deepEqual(
    proposal.changeSet.changes.filter((change) => change.type === "move" && !change.indirect).map((c) => c.stopId),
    ["a"],
  );

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

test("a time edit only renumbers its own day, never every later day", () => {
  const stops = [
    stop("a", 0, "09:00"),
    stop("b", 1, "11:00"),
    stop("x", 2, "09:00", { day_date: nextDay }),
    stop("y", 3, "11:00", { day_date: nextDay }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { time_label: "12:00" });
  assert.ok(proposal);
  assert.deepEqual(
    [...new Set(proposal.changeSet.changes.map((change) => change.stopId))].sort(),
    ["a", "b"],
  );
  const result = checkReviewProposal(stops, proposal);
  assert.deepEqual(
    result.proposedSchedule
      .filter((row) => row.day_date === nextDay)
      .map((row) => [row.id, row.position, row.time_label]),
    [
      ["x", 2, "09:00"],
      ["y", 3, "11:00"],
    ],
  );
});

test("equivalent clock labels do not create a schedule change", () => {
  const stops = [stop("a", 0, "9:00 AM")];
  assert.equal(changeSetForSchedulePatch(stops, "a", { time_label: "09:00" }), null);
  assert.equal(itineraryClockMinutes("2pm"), 14 * 60);
  assert.equal(itineraryClockMinutes("14h30"), 14 * 60 + 30);
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

test("moving a stop to another day always requires Review and keeps a chosen time", () => {
  const stops = [stop("a", 0, "10:00"), stop("b", 1, "12:00")];
  const proposal = changeSetForMoves(stops, [
    { id: "a", day_date: nextDay, at: "start", time_label: "15:30" },
  ]);
  assert.ok(proposal);
  const direct = proposal.changeSet.changes.find(
    (change) => change.type === "move" && change.stopId === "a" && !change.indirect,
  );
  assert.equal(direct?.type === "move" ? direct.to.preferredTime : undefined, "15:30");
  const result = checkReviewProposal(stops, proposal);
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("crosses-day"));
});

test("the traveller's travel choice is used for unseen route estimates", () => {
  const stops = [
    stop("a", 0, "10:00", {
      planned_stay_minutes: 0,
      lat: 45,
      lon: -73,
    }),
    stop("b", 1, "10:45", {
      planned_stay_minutes: 0,
      lat: 45.045,
      lon: -73,
      booked: true,
      time_locked: null,
    }),
  ];
  const proposal = changeSetForSchedulePatch(stops, "a", { planned_stay_minutes: 5 });
  assert.ok(proposal);
  const auto = checkReviewProposal(stops, proposal, { travelChoice: "auto" });
  const walk = checkReviewProposal(stops, proposal, { travelChoice: "walk" });
  assert.equal(auto.reachabilityConflicts.length, 0);
  assert.equal(walk.reachabilityConflicts.length, 1);
  assert.equal(walk.reachabilityConflicts[0]?.estimated, true);
});

test("time-lock changes survive consequence persistence", () => {
  const stops = [stop("a", 0, "10:00", { time_locked: null })];
  const proposal = changeSetForSchedulePatch(stops, "a", { time_locked: true });
  assert.ok(proposal);
  const result = checkReviewProposal(stops, proposal);
  assert.deepEqual(updatesForConsequence(stops, result), [{ id: "a", time_locked: true }]);
});

test("review persistence refuses insert/delete results rather than dropping them", () => {
  const stops = [stop("a", 0, null)];
  const changeSet: ChangeSet = {
    id: "insert",
    source: "manual",
    createdAt: 0,
    changes: [
      {
        id: "insert-b",
        type: "insert",
        tempStopId: "b",
        afterStopId: "a",
        beforeStopId: null,
        stop: stop("b", 1, null),
      },
    ],
  };
  const result = checkChange(stops, changeSet);
  assert.throws(
    () => updatesForConsequence(stops, result),
    (error: unknown) =>
      (error as { code?: string } | null)?.code === "ITINERARY_REVIEW_UNSUPPORTED_CHANGE",
  );
});

test("inverse updates restore exactly the fields an applied consequence changed", () => {
  const before = [
    stop("a", 0, "10:00", { planned_stay_minutes: 60, time_locked: false }),
  ];
  const inverse = inverseScheduleUpdates(before, [
    {
      id: "a",
      time_label: "11:00",
      position: 2,
      planned_stay_minutes: 90,
      time_locked: true,
    },
  ]);
  assert.deepEqual(inverse, [
    {
      id: "a",
      time_label: "10:00",
      position: 0,
      planned_stay_minutes: 60,
      time_locked: false,
    },
  ]);
});
