import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  escapeHtml,
  itineraryPrintHtml,
  timeRange,
  tidyPrintRow,
  toBookRows,
} from "./itinerary-print.ts";

const row = (over: Partial<Parameters<typeof itineraryPrintHtml>[1][number]> = {}) => ({
  day_date: "2026-10-12",
  time_label: "09:00",
  kind: "sight",
  title: "Musée d'Orsay",
  detail: null,
  address: null,
  ...over,
});

test("each day is a section, in order, with its stops", () => {
  const html = itineraryPrintHtml({ title: "Paris & Lyon", subtitle: "France" }, [
    row(),
    row({ day_date: "2026-10-13", title: "Train from Paris to Lyon", kind: "transport" }),
  ]);
  assert.ok(html.includes("<title>Paris &amp; Lyon</title>"));
  assert.ok(html.indexOf("Day 1") < html.indexOf("Day 2"));
  assert.ok(html.includes("Musée d&#39;Orsay"));
});

test("says what is booked and what is still to book", () => {
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ kind: "lodging", title: "Hotel A", booked: true, booking_ref: "AB12" }),
    row({ kind: "flight", title: "Flight AC 870" }),
    row({ kind: "meal", title: "Lunch" }),
  ]);
  assert.ok(html.includes("Booked · AB12"));
  assert.equal(html.split("To book").length - 1, 1);
});

test("the traveller's text cannot become markup", () => {
  assert.equal(escapeHtml(`<script>"x"</script>`), "&lt;script&gt;&quot;x&quot;&lt;/script&gt;");
  const html = itineraryPrintHtml({ title: "T" }, [row({ detail: "<img src=x onerror=1>" })]);
  assert.ok(!html.includes("<img"));
});

test("each stop says exactly where Béa has it", () => {
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ address: "1 Rue de la Légion d'Honneur", lat: 48.860611, lon: 2.326561 }),
    row({ title: "Somewhere", lat: null, lon: null }),
    row({ kind: "note", title: "Pack snacks" }),
  ]);
  assert.ok(html.includes("1 Rue de la Légion d&#39;Honneur"));
  assert.ok(html.includes('Map pin: <a href="https://www.google.com/maps/search/'));
  assert.ok(html.includes(">48.86061, 2.32656</a>"));
  // A stop without a pin says so; a note is not a place.
  assert.equal(html.split("Not on the map yet").length - 1, 1);
  assert.ok(html.includes("Not on the map yet · no address"));
});

test("a stop with a known length prints when it ends", () => {
  assert.equal(timeRange("09:00", 40), "09:00–09:40");
  assert.equal(timeRange("14:45", 120), "14:45–16:45");
  assert.equal(timeRange("09:00", null), "09:00");
  // Over midnight a range would read backwards.
  assert.equal(timeRange("23:30", 90), "23:30");
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ title: "Brandenburg Gate", planned_stay_minutes: 40 }),
  ]);
  assert.ok(html.includes(">09:00–09:40</td>"));
});

test("an address written into the title is the address, not 'no address'", () => {
  const tidy = tidyPrintRow(
    row({ title: "Neues Museum, Bodestraße 1-3 - Egyptian and prehistoric collections" }),
  );
  assert.equal(tidy.title, "Neues Museum - Egyptian and prehistoric collections");
  assert.equal(tidy.address, "Bodestraße 1-3");
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ title: "MAIN TOWER, Neue Mainzer Straße 52-58" }),
  ]);
  assert.ok(html.includes('<div class="address">Neue Mainzer Straße 52-58</div>'));
  assert.ok(html.includes("Not on the map yet"));
  assert.ok(!html.includes("no address"));
  // A name ending in a number is not an address.
  assert.equal(tidyPrintRow(row({ title: "Lunch at Curry 36" })).address, null);
});

test("a note is printed once, however it was written", () => {
  const städel = tidyPrintRow(
    row({
      title: "Städel Museum, Schaumainkai 63 - 700 years of European art",
      detail: "700 years of European art",
    }),
  );
  assert.equal(städel.title, "Städel Museum");
  assert.equal(städel.detail, "700 years of European art");
  const wall = tidyPrintRow(
    row({
      title: "East Side Gallery - Berlin Wall murals",
      detail: "Berlin Wall murals · getting there: S-Bahn to Ostbahnhof",
    }),
  );
  assert.equal(wall.title, "East Side Gallery");
  assert.equal(wall.detail, "Berlin Wall murals · getting there: S-Bahn to Ostbahnhof");
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ title: "Jewish Museum Berlin - German-Jewish history", detail: "German-Jewish history" }),
  ]);
  assert.equal(html.split("German-Jewish history").length - 1, 1);
});

test("a stay is to book once, never on leaving it, and again on coming back", () => {
  const rows = [
    row({ kind: "lodging", title: "Motel One Berlin-Hauptbahnhof", detail: "overnight" }),
    row({ kind: "lodging", title: "Motel One Berlin-Hauptbahnhof", detail: "check-out" }),
    row({ kind: "lodging", title: "Motel One Frankfurt-Hauptbahnhof", detail: "luggage drop" }),
    row({
      kind: "lodging",
      title: "Motel One Frankfurt-Hauptbahnhof",
      detail: "check-in and overnight",
    }),
    row({ kind: "lodging", title: "Motel One Frankfurt-Hauptbahnhof - check-out" }),
    row({ kind: "flight", title: "Flight AC 870" }),
    row({ kind: "lodging", title: "Motel One Berlin-Hauptbahnhof", detail: "luggage drop" }),
    row({ kind: "lodging", title: "Motel One Berlin-Hauptbahnhof", detail: "check-in" }),
  ];
  const marked = toBookRows(rows);
  assert.deepEqual(
    rows.map((r) => marked.has(r)),
    [true, false, false, true, false, true, false, true],
  );
});
