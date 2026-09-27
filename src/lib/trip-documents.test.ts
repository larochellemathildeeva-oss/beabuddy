import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addedFull,
  addedLabel,
  cleanLines,
  defaultTripId,
  eventWhenLabel,
  fileLook,
  fileSizeLabel,
  filterDocuments,
  freshSignIn,
  guessKind,
  inGroup,
  isMissingDocumentsTable,
  lockIsOn,
  matchesQuery,
  storagePathFor,
  titleFromFileName,
  tripDatesLabel,
  tripLine,
  eventKind,
  type TripDocument,
} from "./trip-documents.ts";

test("trip line and stop kinds", () => {
  const trip = { start_date: null, end_date: null, city: "Lisbon", country: "Portugal" };
  assert.equal(tripLine(trip), "Lisbon, Portugal");
  assert.equal(
    tripLine({ ...trip, start_date: "2026-04-12", end_date: "2026-04-19" }),
    "12 – 19 Apr 2026",
  );
  assert.equal(eventKind("flight"), "flight");
  assert.equal(eventKind("hotel"), "accommodation");
  assert.equal(eventKind("meal"), "restaurant");
  assert.equal(eventKind("sight"), "activity");
});

function doc(over: Partial<TripDocument>): TripDocument {
  return {
    id: "d1",
    owner_id: "u1",
    trip_id: null,
    itinerary_item_id: null,
    kind: "other",
    title: "Doc",
    lines: [],
    reference: null,
    notes: null,
    storage_path: null,
    file_name: null,
    mime_type: null,
    size_bytes: null,
    created_at: "2026-04-01T10:24:00Z",
    updated_at: "2026-04-01T10:24:00Z",
    ...over,
  };
}

test("groups: transport, accommodation, activities, bookings", () => {
  assert.ok(inGroup("flight", "transport"));
  assert.ok(inGroup("car", "transport"));
  assert.ok(!inGroup("accommodation", "transport"));
  assert.ok(inGroup("restaurant", "activities"));
  assert.ok(inGroup("accommodation", "bookings"));
  assert.ok(!inGroup("other", "bookings"));
  assert.ok(inGroup("nonsense", "other"));
  assert.ok(inGroup("anything", "all"));
});

test("missing table is recognised, other errors are not", () => {
  assert.ok(isMissingDocumentsTable({ code: "42P01", message: "x" }));
  assert.ok(
    isMissingDocumentsTable({
      message: "Could not find the table 'public.trip_documents' in the schema cache",
    }),
  );
  assert.ok(!isMissingDocumentsTable({ message: "JWT expired" }));
  assert.ok(!isMissingDocumentsTable(null));
});

test("file look: pdf, image, doc, none", () => {
  assert.equal(
    fileLook({ storage_path: "u/doc-1.pdf", mime_type: null, file_name: "a.PDF" }),
    "pdf",
  );
  assert.equal(
    fileLook({ storage_path: "u/doc-1", mime_type: "image/jpeg", file_name: null }),
    "image",
  );
  assert.equal(
    fileLook({ storage_path: "u/doc-1.docx", mime_type: null, file_name: "a.docx" }),
    "doc",
  );
  assert.equal(
    fileLook({ storage_path: null, mime_type: "application/pdf", file_name: "a.pdf" }),
    "none",
  );
});

test("storage path stays in the owner's folder with a plain extension", () => {
  assert.equal(storagePathFor("u1", "abc", "My Ticket.PDF"), "u1/doc-abc.pdf");
  assert.equal(storagePathFor("u1", "abc", "../../evil"), "u1/doc-abc");
  assert.equal(storagePathFor("u1", "abc", "x.tar.gz"), "u1/doc-abc.gz");
});

test("title from file name: tidy, and nothing for camera names", () => {
  assert.equal(titleFromFileName("flight_confirmation-AC872.pdf"), "Flight confirmation AC872");
  assert.equal(titleFromFileName("IMG_2034.JPG"), "");
  assert.equal(titleFromFileName("PXL_20260401.jpg"), "");
});

test("guess kind from a name", () => {
  assert.equal(guessKind("Boarding pass AC872"), "flight");
  assert.equal(guessKind("Hotel booking Lisbon"), "accommodation");
  assert.equal(guessKind("Hertz rental"), "car");
  assert.equal(guessKind("Dinner reservation"), "restaurant");
  assert.equal(guessKind("Receipt"), "other");
});

test("lines: trimmed, empties dropped, two at most", () => {
  assert.deepEqual(cleanLines(["  Air Canada ·  AC872 ", "", "Montreal → Lisbon", "extra"]), [
    "Air Canada · AC872",
    "Montreal → Lisbon",
  ]);
});

test("search: every word, accents ignored, across lines and reference", () => {
  const d = doc({ title: "Hôtel booking", lines: ["Dear Breakfast"], reference: "BEA-48321" });
  assert.ok(matchesQuery(d, "hotel breakfast"));
  assert.ok(matchesQuery(d, "48321"));
  assert.ok(!matchesQuery(d, "flight"));
  assert.ok(matchesQuery(d, "  "));
});

test("filter by view, trip and group, newest first", () => {
  const docs = [
    doc({ id: "a", trip_id: "t1", kind: "flight", created_at: "2026-04-01T00:00:00Z" }),
    doc({ id: "b", trip_id: null, kind: "accommodation", created_at: "2026-04-03T00:00:00Z" }),
    doc({ id: "c", trip_id: "t1", kind: "restaurant", created_at: "2026-04-02T00:00:00Z" }),
  ];
  const ids = (xs: TripDocument[]) => xs.map((x) => x.id);
  assert.deepEqual(ids(filterDocuments(docs, { view: "all", group: "all", query: "" })), [
    "b",
    "c",
    "a",
  ]);
  assert.deepEqual(ids(filterDocuments(docs, { view: "unassigned", group: "all", query: "" })), [
    "b",
  ]);
  assert.deepEqual(
    ids(filterDocuments(docs, { view: "trip", tripId: "t1", group: "transport", query: "" })),
    ["a"],
  );
  assert.deepEqual(
    ids(filterDocuments(docs, { view: "all", group: "all", query: "", sort: "oldest" })),
    ["a", "c", "b"],
  );
});

test("added labels", () => {
  const now = new Date(2026, 3, 10, 12, 0);
  assert.equal(addedLabel(new Date(2026, 3, 10, 8, 0).toISOString(), now), "Added today");
  assert.equal(addedLabel(new Date(2026, 3, 9, 23, 0).toISOString(), now), "Added yesterday");
  assert.equal(addedLabel(new Date(2026, 3, 7, 9, 0).toISOString(), now), "Added 3 days ago");
  assert.equal(addedLabel(new Date(2026, 2, 14, 9, 0).toISOString(), now), "Added 14 Mar");
  assert.equal(addedLabel(new Date(2025, 2, 14, 9, 0).toISOString(), now), "Added 14 Mar 2025");
  assert.equal(addedFull(new Date(2026, 3, 1, 10, 24).toISOString()), "Added 1 Apr 2026, 10:24");
});

test("trip dates and event labels", () => {
  assert.equal(tripDatesLabel("2026-04-12", "2026-04-19"), "12 – 19 Apr 2026");
  assert.equal(tripDatesLabel("2026-04-30", "2026-05-03"), "30 Apr – 3 May 2026");
  assert.equal(tripDatesLabel(null, null), "");
  assert.equal(eventWhenLabel("2026-04-14", "09:00"), "Tue, 14 Apr · 09:00");
  assert.equal(eventWhenLabel(null, "09:00"), "09:00");
});

test("default trip: current, then next, then latest; trips with documents first", () => {
  const trips = [
    { id: "past", start_date: "2026-01-01", end_date: "2026-01-05" },
    { id: "now", start_date: "2026-04-08", end_date: "2026-04-12" },
    { id: "next", start_date: "2026-05-01", end_date: "2026-05-05" },
  ];
  assert.equal(defaultTripId(trips, [], "2026-04-10"), "now");
  assert.equal(defaultTripId(trips, [], "2026-04-20"), "next");
  assert.equal(defaultTripId(trips, [{ trip_id: "past" }], "2026-04-10"), "past");
  assert.equal(defaultTripId([], [], "2026-04-10"), null);
});

test("lock: on unless turned off; fresh sign-in window", () => {
  assert.ok(lockIsOn(null));
  assert.ok(lockIsOn("on"));
  assert.ok(!lockIsOn("off"));
  const now = Date.parse("2026-04-10T12:00:00Z");
  assert.ok(freshSignIn("2026-04-10T11:58:00Z", now));
  assert.ok(!freshSignIn("2026-04-10T11:00:00Z", now));
  assert.ok(!freshSignIn(null, now));
  assert.ok(!freshSignIn("2026-04-10T12:30:00Z", now));
});

test("file sizes", () => {
  assert.equal(fileSizeLabel(240 * 1024), "240 KB");
  assert.equal(fileSizeLabel(3.2 * 1024 * 1024), "3.2 MB");
  assert.equal(fileSizeLabel(null), "");
});
