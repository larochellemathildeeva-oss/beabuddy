import { test } from "node:test";
import assert from "node:assert/strict";
import {
  bannerPill,
  bannerScene,
  daysShort,
  dueLine,
  firstStop,
  greetingFor,
  heroPill,
  nextOnPlan,
  nextTodo,
  plansConfirmed,
  routeLine,
  walkMinutes,
} from "./trip-glance.ts";

const now = new Date(2026, 8, 26, 10); // Sat 26 Sep 2026

test("the card pill counts down, then says underway", () => {
  assert.equal(bannerPill("2026-09-28", "2026-09-29", false, now), "In 2 days");
  assert.equal(bannerPill("2026-10-05", "2026-10-06", false, now), "Next week");
  assert.equal(bannerPill("2026-09-25", "2026-09-28", false, now), "Underway");
  assert.equal(bannerPill(null, null, true, now), "Tentative");
  assert.equal(bannerPill(null, null, false, now), "");
});

test("the hero pill says how many days, or which day it is", () => {
  assert.equal(heroPill("2026-10-08", "2026-10-18", false, now), "Upcoming · 12 days");
  assert.equal(heroPill("2026-09-27", null, false, now), "Leaving tomorrow");
  assert.equal(heroPill("2026-09-26", null, false, now), "Leaving today");
  assert.equal(heroPill("2026-09-24", "2026-09-30", false, now), "Underway · Day 3 of 7");
  assert.equal(heroPill("2026-09-20", "2026-09-22", false, now), "Just back");
  assert.equal(heroPill(null, null, false, now), "Planning");
});

test("length, route and greeting", () => {
  assert.equal(daysShort("2026-10-07", "2026-10-09"), "3D");
  assert.equal(daysShort(null, "2026-10-09"), "");
  assert.equal(routeLine(["Tokyo, Japan", "Hakone", "Kyoto, Japan"]), "Tokyo to Kyoto");
  assert.equal(routeLine(["Lisbon", "Lisbon"]), "Lisbon");
  assert.equal(routeLine([]), "");
  assert.equal(greetingFor(7), "Good morning");
  assert.equal(greetingFor(14), "Good afternoon");
  assert.equal(greetingFor(23), "Good evening");
  assert.equal(greetingFor(2), "Good evening");
});

test("plans confirmed counts bookings, not sights", () => {
  assert.equal(plansConfirmed([{ kind: "sight" }, { kind: "meal" }]), null);
  assert.deepEqual(
    plansConfirmed([
      { kind: "flight", booked: true },
      { kind: "hotel", booked: false },
      { kind: "sight" },
      { kind: "meal", booked: true },
    ]),
    { confirmed: 2, total: 3 },
  );
});

test("the first stop skips the travel and the bed", () => {
  const items = [
    { kind: "flight", title: "JL 251" },
    { kind: "hotel", title: "Iwaso" },
    { kind: "note", title: "Bring cash" },
    { kind: "sight", title: "Peace Memorial Park" },
  ];
  assert.equal(firstStop(items)?.title, "Peace Memorial Park");
  assert.equal(firstStop([{ kind: "hotel", title: "Iwaso" }]), null);
});

test("next on the plan is the first entry from today", () => {
  const items = [
    { day_date: "2026-09-25", title: "a" },
    { day_date: null, title: "b" },
    { day_date: "2026-09-27", title: "c" },
  ];
  assert.equal(nextOnPlan(items, "2026-09-26")?.title, "c");
  assert.equal(nextOnPlan(items, "2026-10-01"), null);
});

test("the next to-do is the open one due soonest", () => {
  const todo = (title: string, due_on: string | null, position: number, done = false) => ({
    title,
    due_on,
    position,
    done,
  });
  assert.equal(
    nextTodo([
      todo("done", "2026-09-01", 0, true),
      todo("later", "2026-10-03", 1),
      todo("undated", null, 2),
      todo("sooner", "2026-09-30", 3),
    ])?.title,
    "sooner",
  );
  assert.equal(nextTodo([todo("b", null, 2), todo("a", null, 1)])?.title, "a");
  assert.equal(nextTodo([todo("x", null, 0, true)]), null);
});

test("due lines and walking minutes", () => {
  assert.equal(dueLine("2026-10-03", now), "Best done by 3 October");
  assert.equal(dueLine("2026-09-26", now), "Due today");
  assert.equal(dueLine("2026-09-27", now), "Due tomorrow");
  assert.equal(dueLine("2026-09-20", now), "Was due 20 September");
  assert.equal(dueLine(null, now), "");
  assert.equal(walkMinutes(640), 8);
  assert.equal(walkMinutes(10), 1);
});

test("a trip keeps its painted scene, and trips differ", () => {
  const a = bannerScene("Hiroshima");
  assert.deepEqual(a, bannerScene("Hiroshima"));
  assert.notDeepEqual(a, bannerScene("LA Coastal"));
  for (const path of a.paths) {
    assert.match(path, /^M0,160 L0,[\d.]+ C/);
    assert.match(path, /L400,160 Z$/);
  }
  assert.ok(a.sunR >= 34 && a.sunR <= 64);
  assert.ok(bannerScene("").sky.length === 2);
});
