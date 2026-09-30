import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  bookingRows,
  escapeHtml,
  legBetween,
  legText,
  staysOf,
  tripNights,
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
  // Once on the day, once in the cover's bookings list.
  const days = html.slice(html.indexOf('<div class="days">'));
  assert.equal(days.split("To book").length - 1, 1);
  assert.equal(html.split("To book").length - 1, 2);
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

test("a stay that only drops its bags is still to book; its check-out and bags after are not", () => {
  const rows = [
    row({ kind: "lodging", title: "The Silo Hotel", detail: "Drop bags." }),
    row({ kind: "flight", title: "Flight FI 603", booked: true }),
    row({ kind: "lodging", title: "Hotel Casa Fuster", detail: "check out" }),
    row({ kind: "lodging", title: "Hotel Casa Fuster", detail: "collect bags" }),
  ];
  const marked = toBookRows(rows);
  assert.deepEqual(
    rows.map((r) => marked.has(r)),
    [true, false, false, false],
  );
});

test("the cover says how long, who, where they sleep and each day in a line", () => {
  const html = itineraryPrintHtml(
    {
      title: "Porto",
      subtitle: "Porto, Portugal · Sep 14 – 18",
      start_date: "2026-09-14",
      end_date: "2026-09-18",
      travellers: ["Mathilde", "Ana", "Sofia"],
      link: "https://example.test/trips/1",
      printedAt: new Date(2026, 8, 12, 18, 42),
    },
    [
      row({
        day_date: "2026-09-14",
        kind: "hotel",
        title: "Torel Avantgarde",
        address: "Rua da Restauração 336",
      }),
      row({ day_date: "2026-09-15", kind: "hotel", title: "Torel Avantgarde - breakfast" }),
      row({ day_date: "2026-09-15", kind: "meal", title: "Café Progresso" }),
    ],
  );
  assert.ok(html.includes("4 nights · 3 travellers"));
  assert.ok(html.includes("Mathilde · Ana · Sofia"));
  assert.ok(html.includes("Prepared in Béa · Sep 12, 2026 at 18:42"));
  assert.ok(html.includes("Staying at"));
  assert.ok(html.includes("Rua da Restauração 336"));
  assert.ok(html.includes("At a glance"));
  assert.ok(html.indexOf("Day 1 · ") < html.indexOf("Day 2 · "));
  assert.ok(html.includes('href="https://example.test/trips/1"'));
});

test("a trip's nights come from its dates", () => {
  assert.equal(tripNights("2026-09-14", "2026-09-18"), 4);
  assert.equal(tripNights("2026-09-14", null), null);
  assert.equal(tripNights("2026-09-18", "2026-09-14"), null);
});

test("a stay is listed once, and never by its check-out", () => {
  const rows = [
    row({ kind: "hotel", title: "Hotel A", booked: true, booking_ref: "H1" }),
    row({ kind: "hotel", title: "Hotel A - check-out" }),
    row({ kind: "hotel", title: "Check out of Hotel B" }),
    row({ kind: "lodging", title: "Hotel C" }),
  ];
  assert.deepEqual(
    staysOf(rows).map((r) => r.title),
    ["Hotel A", "Hotel C"],
  );
  const listed = bookingRows(rows, toBookRows(rows)).map((line) => line.row.title);
  assert.deepEqual(listed, ["Hotel A", "Hotel C"]);
});

test("coming back to a hotel after another is a stay and a booking of its own", () => {
  const rows = [
    row({
      day_date: "2026-10-12",
      kind: "hotel",
      title: "Hotel A",
      booked: true,
      booking_ref: "A1",
    }),
    row({
      day_date: "2026-10-13",
      kind: "hotel",
      title: "Hotel B",
      booked: true,
      booking_ref: "B1",
    }),
    row({
      day_date: "2026-10-14",
      kind: "hotel",
      title: "Hotel A",
      booked: true,
      booking_ref: "A2",
    }),
  ];
  assert.deepEqual(
    staysOf(rows).map((r) => r.day_date),
    ["2026-10-12", "2026-10-13", "2026-10-14"],
  );
  const lines = bookingRows(rows, toBookRows(rows));
  assert.deepEqual(
    lines.map((line) => line.row.booking_ref),
    ["A1", "B1", "A2"],
  );
});

test("a stay's reference is kept whichever night it was written on", () => {
  const rows = [
    row({ day_date: "2026-10-12", kind: "hotel", title: "Hotel A", booked: true }),
    row({
      day_date: "2026-10-13",
      kind: "hotel",
      title: "Hotel A",
      booked: true,
      booking_ref: "A1",
      booking_details: "Room 204",
      address: "1 Main St",
    }),
  ];
  const [line, ...rest] = bookingRows(rows, toBookRows(rows));
  assert.equal(rest.length, 0);
  assert.equal(line!.row.day_date, "2026-10-12");
  assert.equal(line!.row.booking_ref, "A1");
  assert.equal(line!.row.booking_details, "Room 204");
  assert.equal(staysOf(rows)[0]!.address, "1 Main St");
  const html = itineraryPrintHtml({ title: "T" }, rows);
  assert.ok(html.includes("Confirmation numbers"));
  assert.ok(html.includes(">A1</td>"));
});

test("between two pinned stops, a walk when it is close and a ride when it is not", () => {
  const a = row({ lat: 41.1486, lon: -8.6107 });
  const near = row({ lat: 41.1469, lon: -8.6148 });
  const far = row({ lat: 41.1621, lon: -8.6759 });
  const walk = legBetween(a, near);
  assert.equal(walk?.mode, "walking");
  assert.match(legText(walk!), /^~\d+ min walk · \d+ m$/);
  const ride = legBetween(a, far);
  assert.equal(ride?.mode, "ride");
  assert.match(legText(ride!), /by transit, ~\d+ min by car$/);
  // No pin, a note, a flight that lands elsewhere, or another country: no line.
  assert.equal(legBetween(a, row()), null);
  assert.equal(legBetween(row({ kind: "note", lat: 41.1486, lon: -8.6107 }), near), null);
  assert.equal(legBetween(row({ kind: "flight", lat: 41.1486, lon: -8.6107 }), near), null);
  assert.equal(legBetween(a, row({ lat: 48.8566, lon: 2.3522 })), null);
});

test("the day says how many stops and how far on foot, with the walks between them", () => {
  const html = itineraryPrintHtml({ title: "T" }, [
    row({ time_label: "09:30", title: "Mercado do Bolhão", lat: 41.1486, lon: -8.6061 }),
    row({ time_label: "11:00", title: "Livraria Lello", lat: 41.1469, lon: -8.6148 }),
  ]);
  assert.ok(/2 stops · ~\d+ m walking/.test(html));
  assert.ok(/↓ ~\d+ min walk/.test(html));
});

test("a rest at the hotel is the same stay, however it is named", () => {
  const citadines = "3-5-25 Nipponbashi, Naniwa Ward, Osaka 556-0005, Japan";
  const rows = [
    row({
      day_date: "2026-10-05",
      kind: "lodging",
      title: "Citadines Namba Osaka (Check-in)",
      address: citadines,
    }),
    row({ day_date: "2026-10-06", kind: "lodging", title: "Citadines (Rest)", address: citadines }),
    row({
      day_date: "2026-10-09",
      kind: "lodging",
      title: "Citadines Namba Osaka",
      address: citadines,
    }),
  ];
  assert.deepEqual(
    staysOf(rows).map((r) => r.title),
    ["Citadines Namba Osaka (Check-in)"],
  );
  assert.deepEqual(
    [...toBookRows(rows)].map((r) => r.title),
    ["Citadines Namba Osaka (Check-in)"],
  );
});
