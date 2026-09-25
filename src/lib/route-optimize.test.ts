import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  CLOSED_NOTE,
  UNFITTED_NOTE,
  clockToSec,
  clusterStops,
  distanceM,
  dayRequest,
  isMovable,
  lodgingFor,
  matrixCredits,
  matrixGroups,
  planDays,
  solveDay,
  travelTimeFrom,
  walkSeconds,
  mergeDay,
  modeFor,
  neighbourLines,
  secToClock,
  stayMinutes,
  travelTotal,
  visitWindows,
  type OptStop,
  type TravelTable,
} from "./route-optimize.ts";

const KYOTO = { lat: 35.0116, lon: 135.7681 };
const KYOTO_NEAR = { lat: 35.0039, lon: 135.7786 }; // about 1.3 km away
const OSAKA = { lat: 34.6937, lon: 135.5023 };

const stop = (id: string, over: Partial<OptStop> = {}): OptStop => ({
  id,
  day_date: "2026-10-07",
  time_label: null,
  kind: "activity",
  title: id,
  lat: KYOTO.lat,
  lon: KYOTO.lon,
  ...over,
});

test("stops group by place: two cities are two groups", () => {
  const groups = clusterStops([
    { id: "a", ...KYOTO },
    { id: "b", ...OSAKA },
    { id: "c", ...KYOTO_NEAR },
  ]);
  assert.deepEqual(
    groups.map((g) => g.map((s) => s.id).sort()),
    [["a", "c"], ["b"]],
  );
});

test("walk inside a neighbourhood, drive across a city", () => {
  assert.equal(modeFor([KYOTO, KYOTO_NEAR]), "walk");
  assert.equal(modeFor([KYOTO, { lat: 35.0394, lon: 135.7292 }]), "drive"); // Kinkaku-ji, ~5 km
});

test("matrices: lone stops skipped, big groups trimmed, the budget respected", () => {
  assert.equal(matrixCredits(8), 64);
  assert.equal(matrixCredits(25), 250);
  const many = Array.from({ length: 30 }, (_, i) => ({ id: `k${i}`, ...KYOTO }));
  const groups = matrixGroups([...many, { id: "o", ...OSAKA }]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]!.length, 25);
  // Two groups of 20 cost 200 each: only one fits in 300.
  const two = [
    ...Array.from({ length: 20 }, (_, i) => ({ id: `k${i}`, ...KYOTO })),
    ...Array.from({ length: 20 }, (_, i) => ({ id: `o${i}`, ...OSAKA })),
  ];
  assert.equal(matrixGroups(two, 300).length, 1);
});

const table: TravelTable = {
  ids: ["a", "b", "c"],
  mode: "walk",
  seconds: [
    [0, 300, 1800],
    [300, 0, 600],
    [1800, 600, null],
  ],
};

test("the model sees each stop's nearest neighbours in minutes", () => {
  assert.deepEqual(neighbourLines([table], 2), [
    "- id=a: 5 min to id=b, 30 min to id=c (on foot)",
    "- id=b: 5 min to id=a, 10 min to id=c (on foot)",
    "- id=c: 10 min to id=b, 30 min to id=a (on foot)",
  ]);
});

test("travel is tallied within a day only, and says how much it covered", () => {
  const day = (id: string, d: string | null) => ({ id, day_date: d });
  // a→c on day 1 (30 min); b alone on day 2; an unknown stop breaks nothing.
  assert.deepEqual(
    travelTotal([table], [day("a", "1"), day("x", "1"), day("c", "1"), day("b", "2")]),
    { seconds: 1800, pairs: 1 },
  );
  assert.deepEqual(travelTotal([table], [day("a", "1"), day("b", "1"), day("c", "1")]), {
    seconds: 900,
    pairs: 2,
  });
  assert.deepEqual(travelTotal([table], [day("a", null), day("b", null)]), {
    seconds: 0,
    pairs: 0,
  });
});

test("only pinned places to visit move; bookings, hotels, travel and notes stay", () => {
  assert.equal(isMovable(stop("museum", { kind: "sight" })), true);
  assert.equal(isMovable(stop("dinner", { kind: "reservation" })), false);
  assert.equal(isMovable(stop("hotel", { kind: "hotel" })), false);
  assert.equal(isMovable(stop("train", { kind: "transport" })), false);
  assert.equal(isMovable(stop("note", { kind: "note" })), false);
  assert.equal(isMovable(stop("nowhere", { lat: null, lon: null })), false);
});

test("a visit lasts what the stop says, else a usual length for its kind", () => {
  assert.equal(stayMinutes(stop("x", { planned_stay_minutes: 30 })), 30);
  assert.equal(stayMinutes(stop("x", { kind: "meal" })), 75);
  assert.equal(stayMinutes(stop("x")), 90);
  assert.equal(stayMinutes(stop("x", { planned_stay_minutes: 44_640 })), 480);
});

test("clock times: read strictly, written rounded up to five minutes", () => {
  assert.equal(clockToSec("09:30"), 34_200);
  assert.equal(clockToSec("9.30"), null);
  assert.equal(clockToSec("25:00"), null);
  assert.equal(secToClock(36_120), "10:05"); // 10:02 is never written 10:00
  assert.equal(secToClock(36_000), "10:00");
  assert.equal(secToClock(90_000), "23:55");
});

test("visit windows: the whole visit fits before closing; unknown hours are open", () => {
  assert.deepEqual(visitWindows(null, 3600), []);
  assert.deepEqual(visitWindows([[600, 1080]], 5400), [[36_000, 59_400]]);
  assert.equal(visitWindows([], 3600), "closed");
  assert.equal(visitWindows([[600, 630]], 3600), "closed");
});

test("the day starts from the latest hotel on or before it", () => {
  const all = [
    stop("h1", { kind: "hotel", day_date: "2026-10-05", ...OSAKA }),
    stop("h2", { kind: "lodging", day_date: "2026-10-06", ...KYOTO_NEAR }),
    stop("h3", { kind: "hotel", day_date: "2026-10-09", ...OSAKA }),
  ];
  assert.deepEqual(lodgingFor(all, "2026-10-07"), { id: "h2", ...KYOTO_NEAR });
  assert.equal(lodgingFor(all, "2026-10-01"), null);
});

test("a day becomes a problem: jobs, closed stops set aside, fixed things anchored", () => {
  const items = [
    stop("temple", { kind: "sight", time_label: "10:00" }),
    stop("lunch", { kind: "reservation", time_label: "13:00" }),
    stop("museum", { kind: "sight", ...KYOTO_NEAR }),
    stop("shop", { kind: "activity" }),
    stop("note", { kind: "note", time_label: "11:00" }),
  ];
  const req = dayRequest(items, {
    date: "2026-10-07",
    lodging: KYOTO,
    openById: new Map([
      ["museum", [[600, 1020]] as [number, number][]],
      ["shop", []],
    ]),
  });
  assert.ok(req);
  assert.deepEqual(req.jobIds, ["temple", "museum"]);
  assert.deepEqual(req.closedIds, ["shop"]);
  assert.deepEqual(req.day.start, KYOTO);
  assert.deepEqual(req.day.end, KYOTO);
  assert.deepEqual(req.day.dayWindow, [36_000, 84_600]);
  assert.deepEqual(req.day.anchors, [
    { id: "lunch", at: 46_800, durationSec: 5400, place: { id: "lunch", ...KYOTO } },
  ]);
  assert.deepEqual(req.day.jobs[1]!.windows, [[36_000, 55_800]]);
});

test("fewer than two stops to order is not a plan", () => {
  const req = dayRequest([stop("a", { kind: "sight" }), stop("b", { kind: "hotel" })], {
    date: "2026-10-07",
    lodging: null,
    openById: new Map(),
  });
  assert.equal(req, null);
});

test("the planned day: new times in, fixed stops kept, untimed ones stay with their neighbour", () => {
  const items = [
    stop("temple", { kind: "sight", time_label: "09:00" }),
    stop("walk-note", { kind: "note" }),
    stop("lunch", { kind: "reservation", time_label: "13:00" }),
    stop("museum", { kind: "sight" }),
    stop("garden", { kind: "sight", time_label: "16:00" }),
  ];
  const req = dayRequest(items, { date: "2026-10-07", lodging: null, openById: new Map() });
  assert.ok(req);
  assert.deepEqual(req.jobIds, ["temple", "museum", "garden"]);
  const out = mergeDay(items, req, {
    visits: [
      { jobIndex: 1, startSec: 32_700 }, // museum first, 09:05
      { jobIndex: 0, startSec: 39_720 }, // temple at 11:02 → 11:05
    ],
    unassigned: [2],
  });
  assert.deepEqual(out.order, [
    { id: "museum", time_label: "09:05" },
    { id: "temple", time_label: "11:05" },
    { id: "walk-note", time_label: null },
    { id: "lunch", time_label: "13:00" },
    { id: "garden", time_label: "16:00" },
  ]);
  assert.deepEqual([...out.notes], [["garden", UNFITTED_NOTE]]);
  assert.notEqual(CLOSED_NOTE, UNFITTED_NOTE);
});

// A straight street, west to east: one kilometre is about 17 minutes on foot.
const east = (km: number) => ({ lat: 35, lon: 135 + km / 91.2 });
const walkOnly = travelTimeFrom([]);

test("travel: measured where a table has it, walked for short hops, driven for long ones", () => {
  const a = { id: "a", ...east(0) };
  const b = { id: "b", ...east(1) };
  const c = { id: "c", ...east(8) };
  const drive: TravelTable = {
    ids: ["a", "b", "c"],
    mode: "drive",
    seconds: [
      [0, 240, 900],
      [240, 0, 800],
      [900, 800, 0],
    ],
  };
  const travel = travelTimeFrom([drive]);
  // A kilometre in a place timed by car is still walked.
  assert.equal(travel(a, b), walkSeconds(distanceM(a, b)));
  assert.equal(travel(a, c), 900);
  // Not in the table (the hotel): estimated, by car beyond a walk.
  const hotel = east(8.1);
  assert.ok(travel(a, hotel) > 900 && travel(a, hotel) < 2400);
  assert.equal(travel(a, a), 0);
});

const job = (id: string, km: number, windows: [number, number][] = [], min = 60) => ({
  id,
  ...east(km),
  durationSec: min * 60,
  windows,
});

test("solve: stops along a street are visited in order, not zig-zagged", () => {
  const day = solveDay(
    {
      start: east(0),
      dayWindow: [9 * 3600, 23 * 3600],
      anchors: [],
      jobs: [job("far", 3), job("near", 1), job("mid", 2)],
    },
    walkOnly,
  );
  assert.deepEqual(
    day.visits.map((v) => v.jobIndex),
    [1, 2, 0],
  );
  assert.deepEqual(day.unassigned, []);
});

test("solve: a place that opens late is visited after the others, at its opening", () => {
  const day = solveDay(
    {
      start: east(0),
      dayWindow: [9 * 3600, 23 * 3600],
      anchors: [],
      jobs: [job("museum", 0.1, [[14 * 3600, 16 * 3600]]), job("temple", 0.2), job("garden", 0.3)],
    },
    walkOnly,
  );
  const order = day.visits.map((v) => v.jobIndex);
  assert.equal(order[order.length - 1], 0);
  assert.equal(day.visits.find((v) => v.jobIndex === 0)!.startSec, 14 * 3600);
});

test("solve: what cannot fit its hours is left out, and the rest still planned", () => {
  const day = solveDay(
    {
      start: east(0),
      dayWindow: [9 * 3600, 23 * 3600],
      anchors: [],
      // Both may only start at 10:00 sharp and each takes two hours.
      jobs: [job("a", 0.1, [[36_000, 36_000]], 120), job("b", 0.2, [[36_000, 36_000]], 120)],
    },
    walkOnly,
  );
  assert.equal(day.visits.length, 1);
  assert.equal(day.unassigned.length, 1);
});

test("solve: a booked lunch across town is travelled to, and nothing makes it late", () => {
  const lunch = { id: "lunch", ...east(5) };
  const jobs = [job("home", 0.1, [], 90), job("by-lunch", 5.1), job("long", 0.2, [], 120)];
  const day = solveDay(
    {
      start: east(0),
      dayWindow: [9 * 3600, 23 * 3600],
      anchors: [{ id: "lunch", at: 12 * 3600, durationSec: 3600, place: lunch }],
      jobs,
    },
    walkOnly,
  );
  assert.deepEqual(day.unassigned, []);
  for (const v of day.visits) {
    const j = jobs[v.jobIndex]!;
    const end = v.startSec + j.durationSec;
    if (v.startSec < 12 * 3600) {
      // Before lunch: finished in time to get there.
      assert.ok(end + walkOnly(j, lunch) <= 12 * 3600 + 600, `${j.id} makes lunch late`);
    } else {
      // After lunch: not before it is over and the walk from it is done.
      assert.ok(v.startSec >= 13 * 3600 + walkOnly(lunch, j) - 1, `${j.id} overlaps lunch`);
    }
  }
});

test("solve: ends near the hotel when there is one", () => {
  const day = solveDay(
    {
      start: east(0),
      end: east(0),
      dayWindow: [9 * 3600, 23 * 3600],
      anchors: [],
      jobs: [job("a", 1), job("b", 2)],
    },
    walkOnly,
  );
  // Out and back is the same either way; both stops are visited.
  assert.equal(day.visits.length, 2);
});

test("plan days: each dated day ordered around its hours, undated stops left alone", () => {
  const items: OptStop[] = [
    stop("museum", { kind: "sight", ...east(0.5), time_label: "09:00" }),
    stop("temple", { kind: "sight", ...east(0.2), time_label: "11:00" }),
    stop("loose", { kind: "sight", day_date: null }),
  ];
  const out = planDays(items, items, new Map([["museum", "Mo-Su 13:00-17:00"]]), walkOnly);
  assert.deepEqual([...out.keys()], ["2026-10-07"]);
  const day = out.get("2026-10-07")!;
  assert.deepEqual(
    day.order.map((o) => o.id),
    ["temple", "museum"],
  );
  assert.equal(day.order[1]!.time_label, "13:00");
});
