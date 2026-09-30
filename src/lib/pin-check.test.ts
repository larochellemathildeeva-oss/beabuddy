import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  PIN_CHECK_MAX,
  STRAY_PIN_CHECK,
  pinCheckFor,
  pinCheckNote,
  pinsToCheck,
} from "./pin-check.ts";

test("a sure pin, no match, or a pin the traveller removed leaves nothing to check", () => {
  assert.equal(pinCheckNote({ confidence: "high", reason: "Name and town match" }, true), null);
  assert.equal(pinCheckNote(undefined, false), null);
  assert.equal(pinCheckNote({ confidence: "medium", reason: "Area only" }, false), null);
});

test("a guess says it is one, and why", () => {
  assert.equal(
    pinCheckNote({ confidence: "medium", reason: "Matched the area, not the place" }, true),
    "Béa's best guess: Matched the area, not the place",
  );
  assert.equal(
    pinCheckNote({ confidence: "low", reason: "Found under another name" }, true),
    "Kept though Béa was unsure: Found under another name",
  );
});

test("an unsure match left off the map says what Béa found", () => {
  assert.equal(
    pinCheckNote(
      {
        confidence: "low",
        reason: "3 km from the town",
        label: "MooKEN, 今里筋, Tajima 1-chome, Ikuno Ward, Osaka",
      },
      false,
    ),
    "Not pinned: 3 km from the town. Béa found MooKEN, 今里筋",
  );
});

test("a note never outgrows its column", () => {
  const note = pinCheckNote({ confidence: "medium", reason: "x".repeat(500) }, true)!;
  assert.equal(note.length, PIN_CHECK_MAX);
  assert.ok(note.endsWith("…"));
});

test("a stop's own note first, then a stray pin's", () => {
  assert.equal(
    pinCheckFor({ pin_check: "Béa's best guess: area" }, true),
    "Béa's best guess: area",
  );
  assert.equal(pinCheckFor({ pin_check: null }, true), STRAY_PIN_CHECK);
  assert.equal(pinCheckFor({ pin_check: "  " }, false), null);
});

test("the list to review is the stops with a note, in order; approved ones are gone", () => {
  const items = [
    { title: "Nishiki Market", pin_check: null },
    { title: "Lunch in Gion", pin_check: "Béa's best guess: the area" },
    { title: "mookEN", pin_check: "Not pinned: 3 km from the town" },
    { title: "Kinkaku-ji", pin_check: " " },
  ];
  assert.deepEqual(
    pinsToCheck(items).map((i) => i.title),
    ["Lunch in Gion", "mookEN"],
  );
  const approved = items.map((i) => (i.title === "mookEN" ? { ...i, pin_check: null } : i));
  assert.deepEqual(
    pinsToCheck(approved).map((i) => i.title),
    ["Lunch in Gion"],
  );
});
