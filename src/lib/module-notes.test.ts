import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { tripNote, worldNote } from "./module-notes.ts";

const noFirstPerson = (line: string) => assert.ok(!/\b(I|I'm|I've|me|my)\b/.test(line), line);

describe("notes from Béa", () => {
  it("describes the world from its own numbers", () => {
    const line = worldNote({ cities: 12, countries: 5, continents: 3, bucket: 4 });
    assert.equal(
      line,
      "12 cities across 5 countries on 3 of 7 continents so far. 4 places are still waiting on the bucket list.",
    );
    assert.equal(
      worldNote({ cities: 1, countries: 1, continents: 1, bucket: 0 }),
      "1 city across 1 country so far. Béa keeps count.",
    );
    noFirstPerson(worldNote({ cities: 0, countries: 0, continents: 0, bucket: 0 }));
    noFirstPerson(worldNote({ cities: 0, countries: 0, continents: 0, bucket: 1 }));
  });

  it("describes a trip ahead and a trip under way", () => {
    assert.equal(
      tripNote({ daysUntil: 2, day: null, days: 7, todosOpen: 2, packedPct: 60, next: null }),
      "2 days to go. 2 to-dos are still open, and Béa is keeping track.",
    );
    assert.equal(
      tripNote({ daysUntil: 1, day: null, days: 7, todosOpen: 0, packedPct: 60, next: null }),
      "The trip starts tomorrow. Packing is 60% done.",
    );
    assert.equal(
      tripNote({
        daysUntil: 0,
        day: 3,
        days: 7,
        todosOpen: 0,
        packedPct: null,
        next: { title: "Hakone", when: "in 2h 15m" },
      }),
      "Day 3 of 7. Next up: Hakone, in 2h 15m.",
    );
    assert.equal(
      tripNote({ daysUntil: 0, day: null, days: 3, todosOpen: 0, packedPct: null, next: null }),
      "The trip starts today. Everything Béa knows about is ready.",
    );
    assert.equal(
      tripNote({
        daysUntil: null,
        day: null,
        days: null,
        todosOpen: 0,
        packedPct: null,
        next: null,
      }),
      "The trip is ahead. Everything Béa knows about is ready.",
    );
    assert.equal(
      tripNote({ daysUntil: -2, day: null, days: null, todosOpen: 1, packedPct: null, next: null }),
      "The trip is ahead. 1 to-do is still open, and Béa is keeping track.",
    );
    for (const line of [
      tripNote({ daysUntil: 5, day: null, days: null, todosOpen: 0, packedPct: null, next: null }),
      tripNote({ daysUntil: 0, day: 1, days: null, todosOpen: 0, packedPct: null, next: null }),
    ])
      noFirstPerson(line);
  });
});
