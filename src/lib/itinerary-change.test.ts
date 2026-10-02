import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  checkChange,
  checkSchedule,
  itineraryDateMinutes,
  timeModeFor,
  type ChangeSet,
  type ScheduleStop,
} from "./itinerary-change.ts";

const DAY = "2026-10-02";
const NEXT = "2026-10-03";

const stop = (
  id: string,
  time: string | null,
  position: number,
  extra: Partial<ScheduleStop> = {},
): ScheduleStop => ({
  id,
  day_date: DAY,
  time_label: time,
  position,
  planned_stay_minutes: 0,
  lat: 45.5,
  lon: -73.57,
  ...extra,
});

const changeSet = (changes: ChangeSet["changes"]): ChangeSet => ({
  id: "change-1",
  source: "manual",
  changes,
  createdAt: 0,
});

test("date-qualified times make an overnight gap positive", () => {
  const late = itineraryDateMinutes(DAY, "23:00");
  const early = itineraryDateMinutes(NEXT, "00:30");
  assert.ok(late != null && early != null);
  assert.equal(early - late, 90);
});

test("booked + clock starts fixed, but an explicit unlock wins", () => {
  assert.equal(timeModeFor(stop("a", "10:00", 0, { booked: true })), "fixed");
  assert.equal(
    timeModeFor(stop("a", "10:00", 0, { booked: true, time_locked: false })),
    "flexible",
  );
  assert.equal(timeModeFor(stop("a", null, 0, { booked: true, time_locked: true })), "sequence");
});

test("existing schedule warning includes stay plus travel", () => {
  const plan = [
    stop("a", "10:00", 0, { planned_stay_minutes: 60 }),
    stop("b", "11:00", 1, { booked: true }),
  ];
  const checked = checkSchedule(plan, {
    travelLegs: [{ fromId: "a", toId: "b", seconds: 30 * 60 }],
  });
  assert.equal(checked.reachabilityConflicts.length, 1);
  assert.equal(checked.reachabilityConflicts[0]?.requiredMinutes, 90);
  assert.equal(checked.reachabilityConflicts[0]?.availableMinutes, 60);
});

test("a previously unseen pair uses the straight-line estimate", () => {
  const plan = [
    stop("a", "10:00", 0, { lat: 45.5, lon: -73.57, planned_stay_minutes: 60 }),
    stop("b", "10:30", 1, { lat: 45.52, lon: -73.57, booked: true }),
  ];
  const checked = checkSchedule(plan);
  assert.equal(checked.uncertainTravel, false);
  assert.equal(checked.reachabilityConflicts.length, 1);
  assert.equal(checked.reachabilityConflicts[0]?.estimated, true);
});

test("small ripple auto-applies: at most two flexible stops, at most 30 minutes", () => {
  const plan = [
    stop("a", "10:00", 0, { planned_stay_minutes: 30 }),
    stop("b", "10:45", 1, { planned_stay_minutes: 30 }),
    stop("c", "11:30", 2),
  ];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "retime-a",
        type: "retime",
        stopId: "a",
        fromTime: "10:00",
        toTime: "10:15",
      },
    ]),
    {
      travelLegs: [
        { fromId: "a", toId: "b", seconds: 15 * 60 },
        { fromId: "b", toId: "c", seconds: 15 * 60 },
      ],
    },
  );
  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(
    result.shifts
      .filter((shift) => shift.downstream)
      .map((shift) => [shift.stopId, shift.deltaMinutes]),
    [
      ["b", 15],
      ["c", 15],
    ],
  );
});

test("more than two downstream shifts requires Review", () => {
  const plan = [
    stop("a", "10:00", 0, { planned_stay_minutes: 30 }),
    stop("b", "10:45", 1, { planned_stay_minutes: 30 }),
    stop("c", "11:30", 2, { planned_stay_minutes: 30 }),
    stop("d", "12:15", 3),
  ];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "retime-a",
        type: "retime",
        stopId: "a",
        fromTime: "10:00",
        toTime: "10:15",
      },
    ]),
    {
      travelLegs: [
        { fromId: "a", toId: "b", seconds: 15 * 60 },
        { fromId: "b", toId: "c", seconds: 15 * 60 },
        { fromId: "c", toId: "d", seconds: 15 * 60 },
      ],
    },
  );
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("too-many-shifts"));
});

test("a ripple over 30 minutes requires Review", () => {
  const plan = [stop("a", "10:00", 0, { planned_stay_minutes: 30 }), stop("b", "10:45", 1)];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "retime-a",
        type: "retime",
        stopId: "a",
        fromTime: "10:00",
        toTime: "11:00",
      },
    ]),
    { travelLegs: [{ fromId: "a", toId: "b", seconds: 15 * 60 }] },
  );
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("large-shift"));
});

test("a fixed downstream stop is not moved and produces a conflict", () => {
  const plan = [
    stop("a", "10:00", 0, { planned_stay_minutes: 60 }),
    stop("b", "11:30", 1, { booked: true }),
  ];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "retime-a",
        type: "retime",
        stopId: "a",
        fromTime: "10:00",
        toTime: "11:00",
      },
    ]),
    { travelLegs: [{ fromId: "a", toId: "b", seconds: 30 * 60 }] },
  );
  assert.equal(result.decision, "review");
  assert.equal(result.proposedSchedule.find((row) => row.id === "b")?.time_label, "11:30");
  assert.equal(result.reachabilityConflicts.length, 1);
  assert.equal(result.fixedConstraints[0]?.stopId, "b");
});

test("moving to another day always requires Review", () => {
  const plan = [stop("a", "10:00", 0)];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "move-a",
        type: "move",
        stopId: "a",
        from: { dayDate: DAY, position: 0 },
        to: { dayDate: NEXT, position: 0 },
      },
    ]),
  );
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("crosses-day"));
});

test("unknown travel without two usable pins requires Review rather than pretending it is safe", () => {
  const plan = [
    stop("a", "10:00", 0, { lat: null, lon: null }),
    stop("b", "11:00", 1, { lat: null, lon: null }),
  ];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "retime-a",
        type: "retime",
        stopId: "a",
        fromTime: "10:00",
        toTime: "10:15",
      },
    ]),
  );
  assert.equal(result.decision, "review");
  assert.ok(result.reasons.includes("travel-unknown"));
});

test("a flexible stop pushed past midnight is not wrapped to the morning", () => {
  const plan = [
    stop("a", "22:00", 0, { planned_stay_minutes: 30 }),
    stop("b", "23:30", 1),
    stop("c", "23:45", 2),
  ];
  const result = checkChange(
    plan,
    changeSet([{ id: "d", type: "duration", stopId: "a", fromMinutes: 30, toMinutes: 150 }]),
  );
  const byId = new Map(result.proposedSchedule.map((row) => [row.id, row]));
  assert.equal(byId.get("b")?.time_label, "23:30");
  assert.deepEqual(
    result.proposedSchedule.map((row) => row.id),
    ["a", "b", "c"],
  );
  assert.ok(result.reasons.includes("unreachable"));
  assert.equal(result.decision, "review");
});

test("a time the traveller just chose is never rewritten by the ripple", () => {
  const plan = [stop("a", "10:00", 0, { planned_stay_minutes: 60 }), stop("b", "12:00", 1)];
  const result = checkChange(
    plan,
    changeSet([{ id: "t", type: "retime", stopId: "b", fromTime: "12:00", toTime: "10:30" }]),
  );
  assert.equal(result.proposedSchedule.find((row) => row.id === "b")?.time_label, "10:30");
  assert.ok(result.reasons.includes("unreachable"));
  assert.equal(result.decision, "review");
});

test("an insert lands after its neighbour, even when its position ties", () => {
  const plan = [stop("a", null, 0), stop("b", null, 1), stop("c", null, 2)];
  const result = checkChange(
    plan,
    changeSet([
      {
        id: "i",
        type: "insert",
        tempStopId: "0-new",
        afterStopId: "b",
        beforeStopId: "c",
        stop: stop("0-new", null, 1),
      },
    ]),
  );
  assert.deepEqual(
    result.proposedSchedule.map((row) => row.id),
    ["a", "b", "0-new", "c"],
  );
  const positions = result.proposedSchedule.map((row) => row.position);
  assert.equal(new Set(positions).size, positions.length, "no two stops share a position");
  assert.ok(positions.every(Number.isInteger));
});

test("a tight pair on another day does not send every edit to Review", () => {
  const plan = [
    stop("a", "10:00", 0, { planned_stay_minutes: 30 }),
    stop("b", "12:00", 1),
    stop("x", "10:00", 0, { day_date: NEXT, planned_stay_minutes: 120 }),
    stop("y", "10:30", 1, { day_date: NEXT, booked: true }),
  ];
  const result = checkChange(
    plan,
    changeSet([{ id: "t", type: "retime", stopId: "b", fromTime: "12:00", toTime: "12:15" }]),
  );
  assert.equal(result.decision, "auto-apply");
  assert.deepEqual(result.reachabilityConflicts, []);
});
