import { strict as assert } from "node:assert";
import { test } from "node:test";
import { pastYouFor, placeKey, visitLine, type PastTrip } from "./past-you.ts";

const trip: PastTrip = {
  id: "new",
  title: "Lisbon again",
  city: "Lisbon, Portugal",
  country: "Portugal",
  start_date: "2026-10-05",
  end_date: "2026-10-09",
};
const empty = { notes: [], photos: [], trips: [], recs: [] };

test("town names match without case, accents or the country after a comma", () => {
  assert.equal(placeKey("Lisboa, Portugal"), "lisboa");
  assert.equal(placeKey(" Montréal "), "montreal");
});

test("nothing from Past You is nothing to show", () => {
  assert.equal(pastYouFor(trip, [], empty), null);
});

test("notes, earlier photos, earlier trips and unvisited recs for the town", () => {
  const found = pastYouFor(trip, [{ city: "Sintra", country: "Portugal" }], {
    notes: [
      {
        id: "n1",
        city: "lisbon",
        country: null,
        note: "Tram 28 at dawn",
        created_at: "2024-05-01",
      },
      { id: "n2", city: "Porto", country: null, note: "Other town", created_at: "2024-05-01" },
    ],
    photos: [
      {
        id: "p1",
        storage_path: "a.jpg",
        city: "Sintra",
        country: "Portugal",
        taken_at: "2024-05-03T10:00:00Z",
      },
      {
        id: "p2",
        storage_path: "location-only:x",
        city: "Lisbon",
        country: null,
        taken_at: "2024-05-03",
      },
      { id: "p3", storage_path: "b.jpg", city: "Lisbon", country: null, taken_at: "2026-10-06" },
    ],
    trips: [
      {
        ...trip,
        id: "old",
        title: "Lisbon 2024",
        start_date: "2024-05-01",
        end_date: "2024-05-06",
      },
      trip,
    ],
    recs: [
      { id: "r1", name: "Taberna", city: "Lisbon", country: null },
      { id: "r2", name: "Been", city: "Lisbon", country: null, visited: true },
    ],
  });
  assert.equal(found?.place, "Lisbon");
  assert.deepEqual(
    found?.notes.map((n) => n.id),
    ["n1"],
  );
  assert.deepEqual(
    found?.photos.map((p) => p.id),
    ["p1"],
    "only real photos from before this trip",
  );
  assert.deepEqual(found?.visits, [{ id: "old", title: "Lisbon 2024", year: 2024 }]);
  assert.deepEqual(
    found?.recs.map((r) => r.id),
    ["r1"],
  );
  assert.equal(visitLine(found!.visits, found!.photos), "You were here in 2024.");
});

test("a trip naming only a country matches on the country", () => {
  const found = pastYouFor({ ...trip, city: null }, [], {
    ...empty,
    notes: [
      { id: "n1", city: "Porto", country: "portugal", note: "Francesinha", created_at: "2024" },
    ],
  });
  assert.deepEqual(
    found?.notes.map((n) => n.note),
    ["Francesinha"],
  );
});

test("several visits are counted", () => {
  const visits = [
    { id: "a", title: "A", year: 2025 },
    { id: "b", title: "B", year: 2022 },
  ];
  assert.equal(visitLine(visits, []), "You've been here twice, last in 2025.");
  assert.equal(visitLine([], []), null);
});
