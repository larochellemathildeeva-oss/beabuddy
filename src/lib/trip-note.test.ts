import { strict as assert } from "node:assert";
import { test } from "node:test";
import { beaTripNote, SOON_DAYS } from "./trip-note.ts";

const TODAY = "2026-09-19";
const base = { stopCount: 2, plannedCount: 3 };

test("a finished trip says nothing at all", () => {
  // A card that always carries a sentence teaches people to stop reading it.
  assert.equal(
    beaTripNote({ ...base, startDate: "2026-09-01", endDate: "2026-09-05" }, TODAY),
    null,
  );
});

test("a trip underway says so, and adapts to whether there is a plan", () => {
  const on = { startDate: "2026-09-18", endDate: "2026-09-25" };
  assert.match(beaTripNote({ ...on, ...base }, TODAY) ?? "", /on this one/i);
  assert.match(beaTripNote({ ...on, stopCount: 2, plannedCount: 0 }, TODAY) ?? "", /also a plan/i);
});

test("the first day of a trip counts as underway, not as leaving today", () => {
  assert.match(
    beaTripNote({ ...base, startDate: TODAY, endDate: "2026-09-25" }, TODAY) ?? "",
    /on this one/i,
  );
});

test("no stops is the thing worth saying, even close to departure", () => {
  assert.match(
    beaTripNote({ startDate: "2026-09-22", stopCount: 0, plannedCount: 0 }, TODAY) ?? "",
    /does not know where/i,
  );
});

test("a near trip with nothing planned names how near it is", () => {
  const note = beaTripNote({ startDate: "2026-09-22", stopCount: 2, plannedCount: 0 }, TODAY);
  assert.match(note ?? "", /in 3 days/);
  assert.match(note ?? "", /nothing on the timeline/i);
});

test("tomorrow and today read as words, not as a count", () => {
  assert.match(
    beaTripNote({ startDate: "2026-09-20", stopCount: 2, plannedCount: 0 }, TODAY) ?? "",
    /tomorrow/,
  );
  // One day is never "1 days".
  assert.doesNotMatch(
    beaTripNote({ startDate: "2026-09-20", stopCount: 2, plannedCount: 0 }, TODAY) ?? "",
    /1 days/,
  );
});

test("a distant trip is not nagged about its empty timeline", () => {
  const far = beaTripNote({ startDate: "2026-12-01", stopCount: 2, plannedCount: 0 }, TODAY);
  assert.doesNotMatch(far ?? "", /leaving/i);
  assert.match(far ?? "", /Béa can build the rest/);
});

test("the soon threshold is a boundary, not a cliff either side of it", () => {
  const inside = beaTripNote({ startDate: "2026-10-03", stopCount: 2, plannedCount: 1 }, TODAY);
  const outside = beaTripNote({ startDate: "2026-10-04", stopCount: 2, plannedCount: 1 }, TODAY);
  assert.equal(SOON_DAYS, 14);
  assert.match(inside ?? "", /Leaving in 14 days/);
  assert.doesNotMatch(outside ?? "", /Leaving/);
});

test("an undated trip is held rather than hurried", () => {
  assert.match(
    beaTripNote({ stopCount: 0, plannedCount: 0, startDate: null }, TODAY) ?? "",
    /happy to wait/i,
  );
  assert.match(
    beaTripNote({ stopCount: 3, plannedCount: 0, startDate: null }, TODAY) ?? "",
    /holding the places/i,
  );
});

test("a start date that is not a real day is treated as no date", () => {
  assert.match(
    beaTripNote({ ...base, startDate: "2026-02-30" }, TODAY) ?? "",
    /No dates on this one/,
  );
});

test("Béa never says I on a trip card", () => {
  const cases = [
    { ...base, startDate: "2026-09-22" },
    { ...base, startDate: "2026-12-01" },
    { startDate: null, stopCount: 0, plannedCount: 0 },
    { ...base, startDate: "2026-09-18", endDate: "2026-09-25" },
  ];
  for (const state of cases) {
    const note = beaTripNote(state, TODAY) ?? "";
    assert.doesNotMatch(note, /\b(I|I'm|I've|my)\b/, note);
  }
});

test("an unknown plan is never reported as an empty one", () => {
  // The trips list does not load timelines. Saying "nothing planned" there
  // would be Béa announcing something she never checked.
  const soon = beaTripNote({ startDate: "2026-09-22", stopCount: 2, plannedCount: null }, TODAY);
  assert.equal(soon, "Leaving in 3 days.");
  assert.doesNotMatch(soon ?? "", /nothing/i);

  const far = beaTripNote({ startDate: "2026-12-01", stopCount: 2, plannedCount: null }, TODAY);
  assert.equal(far, null);
});

test("an unknown plan still says where Béa is short of information", () => {
  assert.match(
    beaTripNote({ startDate: "2026-12-01", stopCount: 0, plannedCount: null }, TODAY) ?? "",
    /does not know where/i,
  );
});

test("a trip underway with an unknown plan makes no claim about it", () => {
  const note = beaTripNote(
    { startDate: "2026-09-18", endDate: "2026-09-25", stopCount: 2, plannedCount: null },
    TODAY,
  );
  assert.equal(note, "You are on this one right now.");
});
