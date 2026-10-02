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
  const proposal = changeSetForMoves(stops, [
    { id: "a", day_date: "2026-10-03", at: "start" },
  ]);
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
