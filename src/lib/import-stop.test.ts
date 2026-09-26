import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeClock, pinIsSaved, stayMinutesFrom, stopArea } from "./import-stop.ts";

test("clock times in the ways plans write them", () => {
  const cases: [string, string | null][] = [
    ["09:00", "09:00"],
    ["9:00", "09:00"],
    ["9am", "09:00"],
    ["9.30 pm", "21:30"],
    ["12pm", "12:00"],
    ["12am", "00:00"],
    ["21h30", "21:30"],
    ["19h", "19:00"],
    ["12h", "12:00"],
    ["9 h", "09:00"],
    ["noon", "12:00"],
    ["7:05 a.m.", "07:05"],
  ];
  for (const [input, want] of cases) assert.equal(normalizeClock(input), want, input);
});

test("things that are not a time stay empty", () => {
  for (const input of ["", "9", "25h", "morning", "25:00", "10:75", "Day 2", null, undefined]) {
    assert.equal(normalizeClock(input as string | null | undefined), null, String(input));
  }
});

test("a stay comes from a stated length or an end time, never a guess", () => {
  assert.equal(stayMinutesFrom({ duration_minutes: 90 }), 90);
  assert.equal(stayMinutesFrom({ time_label: "10:00", end_time: "12:15" }), 135);
  assert.equal(stayMinutesFrom({ time_label: "10am", end_time: "noon" }), 120);
  assert.equal(stayMinutesFrom({ time_label: "10:00" }), null);
  assert.equal(
    stayMinutesFrom({ time_label: "22:00", end_time: "01:00" }),
    null,
    "past midnight is not read",
  );
  assert.equal(stayMinutesFrom({ duration_minutes: 0 }), null);
  assert.equal(stayMinutesFrom({ duration_minutes: 2000 }), null, "a misread length");
});

test("a stop is looked up in its own town, with the trip's country", () => {
  assert.equal(stopArea("Miyajima", "Hiroshima, Japan"), "Miyajima, Japan");
  assert.equal(stopArea("Kyoto", "Tokyo, Japan"), "Kyoto, Japan");
  assert.equal(stopArea("Hiroshima", "Hiroshima, Japan"), "Hiroshima, Japan");
  assert.equal(stopArea(null, "Hiroshima, Japan"), "Hiroshima, Japan");
  assert.equal(stopArea("Kyoto", ""), "Kyoto");
  assert.equal(stopArea("Kyoto", "Tokyo"), "Kyoto");
  assert.equal(stopArea("Nara, Japan", "Tokyo, Japan"), "Nara, Japan");
});

test("a doubtful pin is saved only when kept; any pin can be removed", () => {
  assert.equal(pinIsSaved("high", undefined), true);
  assert.equal(pinIsSaved("medium", undefined), true);
  assert.equal(pinIsSaved("low", undefined), false);
  assert.equal(pinIsSaved("low", "keep"), true);
  assert.equal(pinIsSaved("high", "drop"), false);
});

test("movement between stops and arriving are travel legs; bookings are not", async () => {
  const { isTravelLeg } = await import("./import-stop.ts");
  const t = (title: string, kind = "transport") => isTravelLeg({ kind, title });
  assert.ok(t("Travel to Peace Memorial Park"));
  assert.ok(t("Take the ferry to Miyajima"));
  assert.ok(t("Walk back to the hotel"));
  assert.ok(t("Shinkansen to Kyoto"));
  assert.ok(t("Head to Motoyasubashi Pier"));
  assert.ok(t("Start toward Miyajima Pier"));
  assert.ok(t("Leave for the station"));
  assert.ok(t("JR Sanyo line Hiroshima → Miyajimaguchi"));
  assert.ok(t("Train Kyoto -> Nara"));
  assert.ok(!t("World Heritage Sea Route: Peace Park → Miyajima"), "no movement word up front");
  assert.ok(
    !t("World Heritage Sea Route: Peace Park to Miyajima"),
    "a named, booked crossing stays",
  );
  assert.ok(t("Arrive Hiroshima Station"), "arriving is the end of the journey");
  assert.ok(t("Arrive Peace Memorial Park - Hiroshima", "sight"));
  assert.ok(t("Arrive by 09:15 at Peace Park", "activity"));
  assert.ok(t("Arrival at Miyajima pier", "note"));
  assert.ok(!t("Arrive at the ryokan", "lodging"), "a place you sleep stays");
  assert.ok(t("Shin-Osaka Station → Hiroshima Station"), "an arrow on a train, no verb");
  assert.ok(t("Hiroshima Station → Peace Memorial Park", "sight"), "from a station, any kind");
  assert.ok(!t("Trevi Fountain → Spanish Steps", "sight"), "a stroll between sights stays");
  assert.ok(!t("Okonomimura → Hiroshima Station", "meal"), "a meal stays");
  assert.ok(!t("Motoyasubashi Pier ferry"));
  assert.ok(!t("Flight JL123 to Tokyo", "flight"));
  assert.ok(!t("Walk to the torii", "sight"), "only transport rows");
  assert.ok(t("Hibiya Line to Ginza"), "a named line going somewhere");
  assert.ok(t("Ginza line toward Asakusa"));
  assert.ok(!t("Line up at the gate"));
});

test("a travel leg becomes a note on the stop it leads to", async () => {
  const { foldTravelLegs } = await import("./import-stop.ts");
  const row = (title: string, kind: string, extra: Record<string, unknown> = {}) => ({
    title,
    kind,
    detail: null as string | null,
    time_label: null as string | null,
    day_date: null as string | null,
    day_number: 1 as number | null,
    ...extra,
  });
  const out = foldTravelLegs([
    row("Arrive Hiroshima Station", "transport", { time_label: "08:36" }),
    row("Travel to Peace Memorial Park", "transport", {
      time_label: "09:00",
      detail: "Tram 2, 15 min",
    }),
    row("Peace Memorial Museum", "sight", { time_label: "09:30", detail: "Booked" }),
    row("Take the ferry to Miyajima", "transport", { day_number: 2, time_label: "10:30" }),
    row("Itsukushima Shrine", "sight", { day_number: 2 }),
    row("Walk back to the hotel", "transport", { day_number: 2 }),
    row("Shinkansen to Kyoto", "transport", { day_number: 3 }),
  ]);
  assert.deepEqual(
    out.map((r) => r.title),
    ["Peace Memorial Museum", "Itsukushima Shrine", "Shinkansen to Kyoto"],
  );
  assert.equal(
    out[0]!.detail,
    "Booked · Getting there: Arrive Hiroshima Station, 08:36 · Getting there: Travel to Peace Memorial Park, 09:00, Tram 2, 15 min",
  );
  assert.equal(
    out[1]!.detail,
    "Getting there: Take the ferry to Miyajima, 10:30 · Afterwards: Walk back to the hotel",
  );
  assert.equal(out[2]!.detail, null, "a leg alone on its day stays");
});

test("a rough time keeps its time", () => {
  for (const [input, want] of [
    ["~19:30", "19:30"],
    ["~ 20:00", "20:00"],
    ["09:00-ish", "09:00"],
    ["9:00 ish", "09:00"],
    ["around 7pm", "19:00"],
    ["approx. 11:25", "11:25"],
    ["ca. 8:15", "08:15"],
  ] as const) {
    assert.equal(normalizeClock(input), want, input);
  }
  // Still not a time without its minutes or an am/pm.
  assert.equal(normalizeClock("~9"), null);
});

test("a booked journey is its own stop, however it is worded", async () => {
  const { foldTravelLegs, isTravelLeg } = await import("./import-stop.ts");
  const ferry = { kind: "transport", title: "Take the ferry to Miyajima" };
  assert.equal(isTravelLeg(ferry), true);
  assert.equal(isTravelLeg({ ...ferry, booked: true }), false);
  const day = (rows: { kind: string; title: string; booked?: boolean }[]) =>
    rows.map((row) => ({
      ...row,
      detail: null,
      time_label: null,
      day_date: "2026-10-07",
      day_number: 1,
    }));
  const folded = foldTravelLegs(
    day([
      { ...ferry, booked: true },
      { kind: "sight", title: "Itsukushima Shrine" },
    ]),
  );
  assert.deepEqual(
    folded.map((row) => row.title),
    ["Take the ferry to Miyajima", "Itsukushima Shrine"],
  );
});

test("a journey the model wrote into the stop and as its own line is noted once", async () => {
  const { foldTravelLegs } = await import("./import-stop.ts");
  // As the audit caught it on the Miyajima fixture, before folding.
  const row = (title: string, kind: string, time: string | null, detail: string | null) => ({
    title,
    kind,
    detail,
    time_label: time,
    day_date: "2026-10-05",
    day_number: 1,
  });
  const out = foldTravelLegs([
    row("JR Sanyo Line to Miyajimaguchi", "transport", "08:10", null),
    row("Be at the JR ferry pier", "note", "08:45", "Getting there: Take JR Sanyo line at 08:10"),
    row("Ferry to Miyajima", "transport", "09:10", null),
    row("Itsukushima Shrine", "sight", "09:30", null),
  ]);
  assert.deepEqual(
    out.map((r) => r.detail),
    ["Getting there: Take JR Sanyo line at 08:10", "Getting there: Ferry to Miyajima, 09:10"],
  );
  // A different journey to the same stop is still added.
  const two = foldTravelLegs([
    row("Take the ferry to Miyajima", "transport", "10:30", null),
    row("Itsukushima Shrine", "sight", "11:00", "Getting there: Tram 2 to the pier, 10:00"),
  ]);
  assert.equal(
    two[0]!.detail,
    "Getting there: Tram 2 to the pier, 10:00 · Getting there: Take the ferry to Miyajima, 10:30",
  );
});

test("a stop is looked up in the city the trip is in that day", async () => {
  const { routeCityOn, routeCountry } = await import("./import-stop.ts");
  const route = [
    { city: "Tokyo", country: "Japan", arrive_on: "2026-09-30", depart_on: "2026-10-03" },
    { city: "Kyoto", country: "Japan", arrive_on: "2026-10-03", depart_on: "2026-10-06" },
    { city: "Hiroshima", country: "Japan", arrive_on: "2026-10-06", depart_on: "2026-10-08" },
    { city: "Osaka", country: "Japan", arrive_on: "2026-10-08", depart_on: null },
  ];
  assert.equal(routeCityOn(route, "2026-10-01"), "Tokyo, Japan");
  assert.equal(
    routeCityOn(route, "2026-10-03"),
    "Kyoto, Japan",
    "a travel day is where you arrive",
  );
  assert.equal(routeCityOn(route, "2026-10-07"), "Hiroshima, Japan");
  assert.equal(routeCityOn(route, "2026-10-10"), "Osaka, Japan");
  assert.equal(routeCityOn(route, "2026-09-01"), null, "before the trip, nowhere");
  assert.equal(routeCityOn(route, null), null);
  assert.equal(
    routeCityOn([{ city: "Lisbon", country: "Portugal" }], "2026-10-01"),
    "Lisbon, Portugal",
  );
  assert.equal(routeCountry(route), "Japan");
  assert.equal(routeCountry([...route, { city: "Seoul", country: "South Korea" }]), null);
});

test("what is listed inside a place folds into it; a timed stop inside stays", async () => {
  const { nestWithin, parentIndex } = await import("./import-stop.ts");
  const row = (title: string, extra: Record<string, unknown> = {}) => ({
    kind: "sight",
    title,
    detail: null as string | null,
    time_label: null as string | null,
    day_date: "2026-10-07",
    day_number: null as number | null,
    within: null as string | null,
    ...extra,
  });
  const rows = [
    row("Peace Memorial Museum", { time_label: "09:30", detail: "Booked" }),
    row("East building", { within: "Peace Memorial Museum" }),
    row("Main building", { within: "peace memorial museum" }),
    row("Cenotaph for the A-bomb Victims", { time_label: "10:45", within: "Peace Memorial Park" }),
    row("Peace Memorial Park", { time_label: "10:30" }),
    row("Children's Peace Monument", { time_label: "11:00", within: "Peace Memorial Park" }),
    row("Flame of Peace", { within: "Peace Memorial Park" }),
    row("Shukkei-en", { within: "Somewhere never named" }),
  ];
  assert.equal(parentIndex(rows, 1), 0);
  assert.equal(parentIndex(rows, 3), -1, "a parent must come first");
  const out = nestWithin(rows);
  assert.deepEqual(
    out.map((r) => r.title),
    [
      "Peace Memorial Museum",
      "Cenotaph for the A-bomb Victims",
      "Peace Memorial Park",
      "Children's Peace Monument",
      "Shukkei-en",
    ],
  );
  assert.equal(out[0]!.detail, "Booked · Inside: East building, Main building");
  assert.equal(out[2]!.detail, "Inside: Flame of Peace");
  assert.equal(out[3]!.within, "Peace Memorial Park", "timed, so a stop, looked up beside it");
  assert.equal(out[1]!.within, null);
  assert.equal(out[4]!.within, null, "a name that matches nothing is dropped");
});

test("a place inside another on a different day is not folded", async () => {
  const { nestWithin } = await import("./import-stop.ts");
  const out = nestWithin([
    {
      kind: "sight",
      title: "Louvre",
      detail: null,
      time_label: "09:00",
      day_date: "2026-05-01",
      day_number: null,
    },
    {
      kind: "sight",
      title: "Winged Victory",
      detail: null,
      time_label: null,
      day_date: "2026-05-02",
      day_number: null,
      within: "Louvre",
    },
  ]);
  assert.equal(out.length, 2);
});

test("a stop and the ones inside it are looked up together", async () => {
  const { placeBatches } = await import("./import-stop.ts");
  assert.deepEqual(placeBatches([-1, -1, -1, -1, -1], 2), [
    [0, 2],
    [2, 4],
    [4, 5],
  ]);
  // Rows 2 and 3 are inside row 1: the cut waits until after them.
  assert.deepEqual(placeBatches([-1, -1, 1, 1, -1, -1], 2), [
    [0, 4],
    [4, 6],
  ]);
  assert.deepEqual(placeBatches([], 8), []);
});
