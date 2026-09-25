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

test("movement between stops is a travel leg; arrivals and bookings are not", async () => {
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
  assert.ok(!t("Arrive Hiroshima Station"));
  assert.ok(!t("Motoyasubashi Pier ferry"));
  assert.ok(!t("Flight JL123 to Tokyo", "flight"));
  assert.ok(!t("Walk to the torii", "sight"), "only transport rows");
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
    [
      "Arrive Hiroshima Station",
      "Peace Memorial Museum",
      "Itsukushima Shrine",
      "Shinkansen to Kyoto",
    ],
  );
  assert.equal(
    out[1]!.detail,
    "Booked · Getting there: Travel to Peace Memorial Park, 09:00, Tram 2, 15 min",
  );
  assert.equal(
    out[2]!.detail,
    "Getting there: Take the ferry to Miyajima, 10:30 · Afterwards: Walk back to the hotel",
  );
  assert.equal(out[3]!.detail, null, "a leg alone on its day stays");
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
