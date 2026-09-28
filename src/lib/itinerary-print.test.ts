import { strict as assert } from "node:assert";
import { test } from "node:test";
import { escapeHtml, itineraryPrintHtml } from "./itinerary-print.ts";

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
