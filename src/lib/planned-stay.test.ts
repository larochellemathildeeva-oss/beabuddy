import { strict as assert } from "node:assert";
import { test } from "node:test";
import { parseStayChoice, stayChoices, stayLabel, STAY_CHOICES } from "./planned-stay.ts";

test("stays read the way people say them", () => {
  assert.equal(stayLabel(45), "45 min");
  assert.equal(stayLabel(60), "1 h");
  assert.equal(stayLabel(90), "1 h 30 min");
  assert.equal(stayLabel(360), "6 h");
});

test("a value set some other way is kept among the choices", () => {
  assert.deepEqual(stayChoices(null), [...STAY_CHOICES]);
  assert.deepEqual(stayChoices(60), [...STAY_CHOICES]);
  const withOdd = stayChoices(50);
  assert.ok(withOdd.includes(50));
  assert.deepEqual(
    withOdd,
    [...withOdd].sort((a, b) => a - b),
    "still in order",
  );
});

test("nothing the database would refuse is offered or parsed", () => {
  assert.ok(!stayChoices(0).includes(0));
  assert.ok(!stayChoices(99_999).includes(99_999));
  assert.equal(parseStayChoice(""), null, "none");
  assert.equal(parseStayChoice("90"), 90);
  assert.equal(parseStayChoice("0"), null);
  assert.equal(parseStayChoice("44641"), null);
  assert.equal(parseStayChoice("1.5"), null);
  assert.equal(parseStayChoice("abc"), null);
});
