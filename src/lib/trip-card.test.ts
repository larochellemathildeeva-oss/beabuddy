import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  countdownLabel,
  fallbackTint,
  isUnderway,
  photoCreditLine,
  pickTripPhoto,
  tripDateLine,
  tripLengthLabel,
  tripMonogram,
  tripPlacesLine,
} from "./trip-card.ts";

const NOW = new Date(2026, 8, 17); // 17 Sep 2026, local

describe("tripDateLine", () => {
  it("does not repeat a month that has not changed", () => {
    assert.equal(tripDateLine("2026-09-17", "2026-09-28", NOW), "Sep 17 – 28");
  });

  it("names the second month when it changes", () => {
    assert.equal(tripDateLine("2026-09-28", "2026-10-03", NOW), "Sep 28 – Oct 3");
  });

  it("adds the year only once it is not this one", () => {
    assert.equal(tripDateLine("2027-04-03", "2027-04-09", NOW), "Apr 3 – 9, 2027");
  });

  it("handles a start with no end", () => {
    assert.equal(tripDateLine("2026-09-17", null, NOW), "From Sep 17");
  });

  it("handles an end with no start", () => {
    assert.equal(tripDateLine(null, "2026-09-28", NOW), "Until Sep 28");
  });

  it("says so when there are no dates at all", () => {
    assert.equal(tripDateLine(null, null, NOW), "Dates not set");
  });

  it("reads a stored date as local, not UTC midnight", () => {
    // Parsed as UTC this lands on the 16th in any negative offset.
    assert.equal(tripDateLine("2026-09-17", "2026-09-17", NOW), "Sep 17 – 17");
  });
});

describe("tripLengthLabel", () => {
  it("counts inclusively, the way people say it", () => {
    assert.equal(tripLengthLabel("2026-09-17", "2026-09-28"), "12 days");
  });

  it("gets a single day right", () => {
    assert.equal(tripLengthLabel("2026-09-17", "2026-09-17"), "1 day");
  });

  it("says nothing without both ends", () => {
    assert.equal(tripLengthLabel("2026-09-17", null), "");
  });
});

describe("countdownLabel", () => {
  it("says today", () => {
    assert.equal(countdownLabel("2026-09-17", NOW), "today");
  });

  it("says tomorrow", () => {
    assert.equal(countdownLabel("2026-09-18", NOW), "tomorrow");
  });

  it("counts days inside a week", () => {
    assert.equal(countdownLabel("2026-09-20", NOW), "in 3 days");
  });

  it("rounds to weeks", () => {
    assert.equal(countdownLabel("2026-10-05", NOW), "in 3 weeks");
  });

  it("rounds to months", () => {
    assert.equal(countdownLabel("2026-11-16", NOW), "in 2 months");
  });

  it("stays quiet about a trip already started", () => {
    assert.equal(countdownLabel("2026-09-10", NOW), "");
  });

  it("stays quiet about something over a year away", () => {
    assert.equal(countdownLabel("2028-01-01", NOW), "");
  });

  it("stays quiet with no date", () => {
    assert.equal(countdownLabel(null, NOW), "");
  });
});

describe("isUnderway", () => {
  it("is true on the first day", () => {
    assert.equal(isUnderway("2026-09-17", "2026-09-28", NOW), true);
  });

  it("is true on the last day", () => {
    assert.equal(isUnderway("2026-09-10", "2026-09-17", NOW), true);
  });

  it("is false the day after", () => {
    assert.equal(isUnderway("2026-09-01", "2026-09-16", NOW), false);
  });

  it("treats a single-day trip with no end as that day", () => {
    assert.equal(isUnderway("2026-09-17", null, NOW), true);
  });
});

describe("tripPlacesLine", () => {
  it("joins two with an ampersand", () => {
    assert.equal(tripPlacesLine(["Kyoto", "Sapporo"]), "Kyoto & Sapporo");
  });

  it("counts the rest beyond two", () => {
    assert.equal(tripPlacesLine(["Kyoto", "Sapporo", "Osaka", "Nara"]), "Kyoto and 3 more");
  });

  it("drops duplicates before counting", () => {
    assert.equal(tripPlacesLine(["Kyoto", "Kyoto"]), "Kyoto");
  });

  it("falls back when there is nothing", () => {
    assert.equal(tripPlacesLine([], "Somewhere"), "Somewhere");
  });
});

describe("tripMonogram", () => {
  it("takes the first letter of the title", () => {
    assert.equal(tripMonogram("Japan, September"), "J");
  });

  it("skips leading punctuation and emoji", () => {
    assert.equal(tripMonogram("✈️ Lisbon"), "L");
  });

  it("falls back to the city", () => {
    assert.equal(tripMonogram("   ", "Reykjavík"), "R");
  });

  it("always returns something", () => {
    assert.equal(tripMonogram("", null), "B");
  });
});

describe("fallbackTint", () => {
  it("is stable for the same trip", () => {
    assert.deepEqual(fallbackTint("Japan"), fallbackTint("Japan"));
  });

  it("stays in the warm band rather than going blue", () => {
    for (const seed of ["Japan", "Iceland", "Peru", "Vietnam", "zzz"]) {
      const hue = Number(/oklch\([\d.]+ [\d.]+ (\d+)\)/.exec(fallbackTint(seed).from)![1]);
      assert.ok(hue >= 25 && hue < 85, `${seed} produced hue ${hue}`);
    }
  });

  it("keeps chroma low enough to sit behind text", () => {
    const chroma = Number(/oklch\([\d.]+ ([\d.]+)/.exec(fallbackTint("Japan").from)![1]);
    assert.ok(chroma <= 0.05, `chroma ${chroma} is too saturated for a backdrop`);
  });
});

const photo = (over: Record<string, unknown> = {}) => ({
  id: "p1",
  storage_path: "u/1.jpg",
  city: "Kyoto",
  country: "Japan",
  taken_at: "2024-05-01T00:00:00Z",
  ...over,
});

describe("pickTripPhoto", () => {
  it("prefers a photo of the trip's own city", () => {
    const hit = pickTripPhoto([photo({ id: "other", city: "Paris", country: "France" }), photo()], {
      city: "Kyoto",
      country: "Japan",
    });
    assert.equal(hit?.id, "p1");
  });

  it("takes the most recent of several", () => {
    const hit = pickTripPhoto(
      [
        photo({ id: "old", taken_at: "2019-01-01T00:00:00Z" }),
        photo({ id: "new", taken_at: "2025-01-01T00:00:00Z" }),
      ],
      { city: "Kyoto" },
    );
    assert.equal(hit?.id, "new");
  });

  it("falls back to the country", () => {
    const hit = pickTripPhoto([photo({ city: "Osaka" })], { city: "Kyoto", country: "Japan" });
    assert.equal(hit?.id, "p1");
  });

  it("matches any of the trip's stops, not just its headline city", () => {
    const hit = pickTripPhoto([photo({ city: "Sapporo", country: null })], {
      city: "Kyoto",
      cities: ["Kyoto", "Sapporo"],
    });
    assert.equal(hit?.id, "p1");
  });

  it("never picks a location-only row, which has no image behind it", () => {
    const hit = pickTripPhoto([photo({ storage_path: "location-only:abc" })], { city: "Kyoto" });
    assert.equal(hit, null);
  });

  it("returns null when nothing matches", () => {
    assert.equal(
      pickTripPhoto([photo({ city: "Paris", country: "France" })], { city: "Kyoto" }),
      null,
    );
  });
});

describe("photoCreditLine", () => {
  it("names the place and the year", () => {
    assert.equal(
      photoCreditLine({ city: "Lisbon", taken_at: "2024-06-02T00:00:00Z" }),
      "Your photo · Lisbon, 2024",
    );
  });

  it("copes with no date", () => {
    assert.equal(photoCreditLine({ city: "Lisbon", taken_at: null }), "Your photo · Lisbon");
  });

  it("copes with nothing at all", () => {
    assert.equal(photoCreditLine({ city: null, taken_at: null }), "Your photo");
  });
});
