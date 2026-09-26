import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addInside,
  insideNote,
  nestPillLabel,
  readInside,
  removeInside,
  splitInsideNote,
  toggleInside,
} from "./inside-list.ts";

test("the stored list is read forgivingly", () => {
  assert.deepEqual(readInside([{ title: " Flame  of Peace ", done: true }, "Peace Bell", 3, {}]), [
    { title: "Flame of Peace", done: true },
    { title: "Peace Bell", done: false },
  ]);
  assert.deepEqual(readInside(null), []);
  assert.deepEqual(readInside("Inside: x"), []);
});

test("the import's Inside note becomes the list, the rest of the note stays", () => {
  assert.deepEqual(splitInsideNote("Booked · Inside: East building, Main building"), {
    detail: "Booked",
    inside: [
      { title: "East building", done: false },
      { title: "Main building", done: false },
    ],
  });
  assert.deepEqual(splitInsideNote("Inside: Flame of Peace"), {
    detail: null,
    inside: [{ title: "Flame of Peace", done: false }],
  });
  assert.deepEqual(splitInsideNote("Getting there: Tram 2"), {
    detail: "Getting there: Tram 2",
    inside: [],
  });
  assert.deepEqual(splitInsideNote(null), { detail: null, inside: [] });
});

test("the list back as a note, for a database without the column", () => {
  assert.equal(
    insideNote([
      { title: "A", done: true },
      { title: "B", done: false },
    ]),
    "Inside: A, B",
  );
  assert.equal(insideNote([]), null);
});

test("ticking, adding and removing", () => {
  const list = [{ title: "Flame of Peace", done: false }];
  assert.deepEqual(toggleInside(list, 0), [{ title: "Flame of Peace", done: true }]);
  assert.equal(addInside(list, "  Peace Bell ").at(-1)!.title, "Peace Bell");
  assert.equal(addInside(list, "flame of peace").length, 1, "no repeats");
  assert.equal(addInside(list, "   ").length, 1);
  assert.deepEqual(removeInside(list, 0), []);
});

test("the pill says what is nested", () => {
  assert.equal(nestPillLabel(2, 0), "2 inside");
  assert.equal(nestPillLabel(0, 1), "1 stop");
  assert.equal(nestPillLabel(2, 2), "2 inside · 2 stops");
  assert.equal(nestPillLabel(0, 0), null);
});
