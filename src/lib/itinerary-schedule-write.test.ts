import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  isItineraryVersionConflict,
  isMissingScheduleRpc,
  mergeCommittedRows,
  scheduleWritePlan,
} from "./itinerary-schedule-write.ts";

type Row = {
  id: string;
  updated_at: string;
  day_date: string | null;
  time_label: string | null;
  position: number;
  planned_stay_minutes: number | null;
  time_locked?: boolean | null;
  title: string;
};

const rows: Row[] = [
  {
    id: "a",
    updated_at: "2026-10-02T10:00:00Z",
    day_date: "2026-10-02",
    time_label: "10:00",
    position: 0,
    planned_stay_minutes: 60,
    time_locked: null,
    title: "Museum",
  },
  {
    id: "b",
    updated_at: "2026-10-02T10:01:00Z",
    day_date: "2026-10-02",
    time_label: "12:00",
    position: 1,
    planned_stay_minutes: 45,
    title: "Lunch",
  },
];

test("scheduleWritePlan captures base versions and an optimistic snapshot", () => {
  const plan = scheduleWritePlan(rows, [
    { id: "a", time_label: "10:30", planned_stay_minutes: 90, time_locked: true },
  ]);
  assert.ok(plan);
  assert.deepEqual(plan.baseVersions, { a: "2026-10-02T10:00:00Z" });
  assert.equal(plan.before[0]?.time_label, "10:00");
  assert.equal(plan.optimistic[0]?.time_label, "10:30");
  assert.equal(plan.optimistic[0]?.planned_stay_minutes, 90);
  assert.equal(plan.optimistic[0]?.time_locked, true);
  assert.equal(plan.optimistic[0]?.title, "Museum");
});

test("omitted schedule fields are not cleared", () => {
  const plan = scheduleWritePlan(rows, [{ id: "a", position: 2 }]);
  assert.ok(plan);
  assert.equal(plan.optimistic[0]?.day_date, "2026-10-02");
  assert.equal(plan.optimistic[0]?.time_label, "10:00");
  assert.equal(plan.optimistic[0]?.planned_stay_minutes, 60);
  assert.equal(plan.optimistic[0]?.time_locked, null);
  assert.equal(plan.optimistic[0]?.position, 2);
});

test("an explicit null clears a duration or lock", () => {
  const lockedRows = [{ ...rows[0]!, time_locked: true }];
  const plan = scheduleWritePlan(lockedRows, [
    { id: "a", planned_stay_minutes: null, time_locked: null },
  ]);
  assert.ok(plan);
  assert.equal(plan.optimistic[0]?.planned_stay_minutes, null);
  assert.equal(plan.optimistic[0]?.time_locked, null);
});

test("unknown rows are ignored instead of becoming accidental inserts", () => {
  assert.equal(scheduleWritePlan(rows, [{ id: "missing", position: 7 }]), null);
});

test("version conflicts recognise the RPC SQLSTATE and message fallback", () => {
  assert.equal(isItineraryVersionConflict({ code: "40001" }), true);
  assert.equal(isItineraryVersionConflict({ message: "itinerary_version_conflict:abc" }), true);
  assert.equal(isItineraryVersionConflict({ code: "23505", message: "duplicate" }), false);
});

test("a missing schedule function is recognised, a conflict is not", () => {
  assert.equal(
    isMissingScheduleRpc({ code: "PGRST202", message: "Could not find the function" }),
    true,
  );
  assert.equal(isMissingScheduleRpc({ code: "42883", message: "function does not exist" }), true);
  assert.equal(
    isMissingScheduleRpc({ code: "40001", message: "itinerary_version_conflict:a" }),
    false,
  );
  assert.equal(isMissingScheduleRpc(null), false);
});

test("committed versions fold into the board so the next save checks against them", () => {
  const merged = mergeCommittedRows(rows, [
    { id: "a", updated_at: "2026-10-02T11:00:00Z", position: 1 },
    { id: "ghost", updated_at: "x" },
  ]);
  assert.equal(merged[0]?.updated_at, "2026-10-02T11:00:00Z");
  assert.equal(merged[0]?.position, 1);
  assert.equal(merged[0]?.title, "Museum", "fields the RPC did not return stay");
  assert.equal(merged[1], rows[1], "untouched rows are the same objects");
  assert.equal(merged.length, rows.length);
  // A queued save's expected version is the one just written.
  const plan = scheduleWritePlan(merged, [{ id: "a", position: 0 }]);
  assert.equal(plan?.baseVersions["a"], "2026-10-02T11:00:00Z");
});

test("a non-array RPC answer leaves the board as it is", () => {
  assert.deepEqual(mergeCommittedRows(rows, null), rows);
});
