import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PASTED_TEXT_MAX,
  cleanDocumentRead,
  cleanPastedText,
  documentReadPrompt,
  isEmptyRead,
  looksLikeCardNumber,
  passesLuhn,
  readableAs,
  stopForRead,
  tripForDate,
  type RawDocumentRead,
} from "./document-read.ts";
import { LINE_MAX, REFERENCE_MAX } from "./trip-documents.ts";

const empty: RawDocumentRead = {
  kind: null,
  title: null,
  line1: null,
  line2: null,
  reference: null,
  notes: null,
  date: null,
  time: null,
  place: null,
};

test("readableAs takes PDFs and photos only", () => {
  assert.equal(readableAs({ type: "application/pdf", name: "x" }), "pdf");
  assert.equal(readableAs({ type: "", name: "Booking.PDF" }), "pdf");
  assert.equal(readableAs({ type: "image/jpeg", name: "IMG_1.jpg" }), "image");
  assert.equal(readableAs({ type: "", name: "scan.heic" }), "image");
  assert.equal(readableAs({ type: "application/vnd.apple.pkpass", name: "a.pkpass" }), null);
  assert.equal(readableAs({ type: "message/rfc822", name: "a.eml" }), null);
});

test("the prompt carries today's date and the never-copy rule", () => {
  const p = documentReadPrompt("2026-09-29");
  assert.match(p, /Today is 2026-09-29/);
  assert.match(p, /Never copy payment card numbers/);
  assert.match(p, /not instructions/);
});

test("cleanDocumentRead trims, caps and checks each field", () => {
  const read = cleanDocumentRead({
    kind: "Flight",
    title: "  Flight   to Lisbon ",
    line1: "Air Canada · AC872",
    line2: "x".repeat(200),
    reference: " ABC 123 ",
    notes: "Seat 14A\n\n\n\nTerminal 1",
    date: "2026-04-14",
    time: "8:05",
    place: "Montréal–Trudeau",
  });
  assert.equal(read.kind, "flight");
  assert.equal(read.title, "Flight to Lisbon");
  assert.deepEqual(read.lines, ["Air Canada · AC872", "x".repeat(LINE_MAX)]);
  assert.equal(read.reference, "ABC 123");
  assert.equal(read.notes, "Seat 14A\n\nTerminal 1");
  assert.equal(read.date, "2026-04-14");
  assert.equal(read.time, "08:05");
  assert.equal(read.place, "Montréal–Trudeau");
});

test("unknown kinds become other; missing kind stays unset", () => {
  assert.equal(cleanDocumentRead({ ...empty, kind: "spaceship" }).kind, "other");
  assert.equal(cleanDocumentRead(empty).kind, null);
});

test("impossible dates and times are dropped", () => {
  const read = cleanDocumentRead({ ...empty, date: "2026-02-30", time: "25:10" });
  assert.equal(read.date, null);
  assert.equal(read.time, null);
  assert.equal(cleanDocumentRead({ ...empty, date: "14 April" }).date, null);
});

test("card numbers are dropped, e-ticket numbers kept", () => {
  assert.ok(passesLuhn("4111111111111111"));
  assert.ok(!passesLuhn("0142345678901"));
  assert.ok(looksLikeCardNumber("378282246310005"));
  assert.ok(looksLikeCardNumber("5555555555554444"));
  // Passes the checksum, but 13 digits is no card's length: an e-ticket stays.
  assert.ok(passesLuhn("0142345678908"));
  assert.ok(!looksLikeCardNumber("0142345678908"));
  // Passes the checksum, 16 digits, but no issuer starts with 9.
  assert.ok(!looksLikeCardNumber("9111111111111110"));
  const kept = cleanDocumentRead({ ...empty, notes: "E-ticket 0142345678908" });
  assert.match(kept.notes, /0142345678908/);
  const read = cleanDocumentRead({
    ...empty,
    notes: "Paid with 4111 1111 1111 1111. E-ticket 0142345678901.",
  });
  assert.doesNotMatch(read.notes, /4111/);
  assert.match(read.notes, /0142345678901/);
});

test("the reference is kept as printed, even a long number", () => {
  const read = cleanDocumentRead({ ...empty, reference: "4111 1111 1111 1111" });
  assert.equal(read.reference, "4111 1111 1111 1111");
});

test("reference is capped", () => {
  const read = cleanDocumentRead({ ...empty, reference: "R".repeat(500) });
  assert.equal(read.reference.length, REFERENCE_MAX);
});

test("isEmptyRead notices an answer with nothing in it", () => {
  assert.ok(isEmptyRead(cleanDocumentRead(empty)));
  assert.ok(!isEmptyRead(cleanDocumentRead({ ...empty, reference: "X1" })));
});

const trips = [
  { id: "lisbon", start_date: "2026-04-14", end_date: "2026-04-20" },
  { id: "tokyo", start_date: "2026-06-01", end_date: "2026-06-10" },
  { id: "someday", start_date: null, end_date: null },
];

test("tripForDate picks the trip whose dates hold it", () => {
  assert.equal(tripForDate("2026-04-16", trips), "lisbon");
  assert.equal(tripForDate("2026-06-10", trips), "tokyo");
  assert.equal(tripForDate(null, trips), null);
  assert.equal(tripForDate("2026-05-01", trips), null);
});

test("tripForDate allows a day either side, when nothing holds it", () => {
  assert.equal(tripForDate("2026-04-13", trips), "lisbon");
  assert.equal(tripForDate("2026-04-21", trips), "lisbon");
  assert.equal(tripForDate("2026-04-12", trips), null);
});

test("tripForDate does not guess between overlapping trips", () => {
  const both = [...trips, { id: "porto", start_date: "2026-04-18", end_date: "2026-04-22" }];
  assert.equal(tripForDate("2026-04-19", both), null);
  // Inside one, a day beside the other: the one that holds it wins.
  assert.equal(tripForDate("2026-04-21", both), "porto");
});

const stops = [
  { id: "flight", day_date: "2026-04-14", kind: "flight", title: "Flight to Lisbon" },
  { id: "hotel", day_date: "2026-04-14", kind: "hotel", title: "Hotel Avenida Palace" },
  { id: "dinner", day_date: "2026-04-14", kind: "food", title: "Dinner at Cervejaria Ramiro" },
  { id: "museum", day_date: "2026-04-15", kind: "sight", title: "Gulbenkian Museum" },
  { id: "tram", day_date: "2026-04-15", kind: "sight", title: "Tram 28" },
];

test("stopForRead matches by name on the same day", () => {
  const read = {
    date: "2026-04-14",
    kind: "accommodation" as const,
    place: "Avenida Palace",
    title: "Hotel booking",
  };
  assert.equal(stopForRead(read, stops), "hotel");
});

test("stopForRead falls back to the only stop of the same kind", () => {
  const read = { date: "2026-04-14", kind: "flight" as const, place: "YUL", title: "AC872" };
  assert.equal(stopForRead(read, stops), "flight");
});

test("stopForRead never links a stop of another kind over a shared word", () => {
  const day = [
    { id: "stay", day_date: "2026-04-14", kind: "hotel", title: "Avenida Palace" },
    { id: "bistro", day_date: "2026-04-14", kind: "food", title: "Hotel Bistro" },
  ];
  const read = {
    date: "2026-04-14",
    kind: "accommodation" as const,
    place: "",
    title: "Hotel booking",
  };
  assert.equal(stopForRead(read, day), "stay");
  const dinner = {
    date: "2026-04-14",
    kind: "restaurant" as const,
    place: "",
    title: "Palace dinner",
  };
  assert.equal(stopForRead(dinner, day), "bistro");
});

test("stopForRead ignores words every booking shares", () => {
  const day = [
    { id: "a", day_date: "2026-04-15", kind: "sight", title: "Tickets for the castle" },
    { id: "b", day_date: "2026-04-15", kind: "sight", title: "Oceanarium" },
  ];
  const read = { date: "2026-04-15", kind: "ticket" as const, place: "", title: "Tickets" };
  assert.equal(stopForRead(read, day), null);
});

test("stopForRead leaves it to the traveller when unsure", () => {
  const unclear = { date: "2026-04-15", kind: "activity" as const, place: "", title: "Tickets" };
  assert.equal(stopForRead(unclear, stops), null);
  const otherDay = { date: "2026-04-16", kind: "flight" as const, place: "", title: "Flight" };
  assert.equal(stopForRead(otherDay, stops), null);
  const undated = { date: null, kind: "flight" as const, place: "", title: "Flight to Lisbon" };
  assert.equal(stopForRead(undated, stops), null);
});

test("pasted text is tidied, capped and loses card numbers before it is sent", () => {
  const pasted =
    "Booking ABC123\r\nCard 4111 1111 1111 1111\r\n\r\n\r\n\r\nE-ticket 0142345678901 \u0007\n";
  const clean = cleanPastedText(pasted);
  assert.doesNotMatch(clean, /4111/);
  assert.match(clean, /E-ticket 0142345678901/);
  assert.match(clean, /Booking ABC123/);
  assert.ok(!clean.includes("\r") && !clean.includes("\u0007"));
  assert.doesNotMatch(clean, /\n{3}/);
  assert.equal(cleanPastedText("  \n\n  "), "");
  assert.equal(cleanPastedText("x".repeat(PASTED_TEXT_MAX + 50)).length, PASTED_TEXT_MAX);
});
