import { strict as assert } from "node:assert";
import { test } from "node:test";
import { runLabelsByIndex, walkableRunLabel, walkableRuns } from "./stop-grouping.ts";

/**
 * A block of Kyoto and a point across town. At this latitude 0.001° of
 * longitude is about 91 m, so the near cluster spans a couple of hundred
 * metres and the far point is a good two kilometres out.
 */
const near = (n: number) => ({ lat: 35.0116, lon: 135.768 + n * 0.001 });
const far = { lat: 35.0116, lon: 135.791 };
const unplaced = { lat: null, lon: null };

test("walkableRuns finds a cluster inside a day", () => {
  const day = [far, near(0), near(1), near(2), far];
  const runs = walkableRuns(day);
  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.startIndex, 1);
  assert.equal(runs[0]?.length, 3);
  assert.ok((runs[0]?.spanMetres ?? 0) < 300, "the run's own span, not the day's");
});

test("walkableRuns says nothing about a pair", () => {
  assert.deepEqual(walkableRuns([far, near(0), near(1), far]), []);
});

test("walkableRuns says nothing when the whole day is one cluster", () => {
  // True, and useless: that is a description of the city, not a grouping.
  assert.deepEqual(walkableRuns([near(0), near(1), near(2), near(3)]), []);
});

test("walkableRuns breaks a run at a stop it cannot place", () => {
  // Béa does not know where the middle one is, so she cannot say it is near
  // the others — and a label that reads like a fact must not contain a guess.
  assert.deepEqual(walkableRuns([far, near(0), unplaced, near(1), near(2)]), []);
});

test("walkableRuns measures the whole run, not neighbour to neighbour", () => {
  // Each step is small, but the ends are far apart: a chain across a city is
  // not a group of stops you do in one go.
  const chain = [far, near(0), near(4), near(8), near(12), far];
  assert.deepEqual(walkableRuns(chain, { withinMetres: 500 }), []);
});

test("walkableRuns finds more than one run in a day", () => {
  const day = [near(0), near(1), near(2), far, near(60), near(61), near(62)];
  const runs = walkableRuns(day);
  assert.equal(runs.length, 2);
  assert.deepEqual(
    runs.map((r) => r.startIndex),
    [0, 4],
  );
});

test("walkableRuns handles days too short to group", () => {
  assert.deepEqual(walkableRuns([]), []);
  assert.deepEqual(walkableRuns([near(0)]), []);
});

test("walkableRunLabel states the fact and invents no name", () => {
  const label = walkableRunLabel({ startIndex: 1, length: 3, spanMetres: 240 });
  assert.equal(label, "3 stops within 240 m of each other");
});

test("runLabelsByIndex keys the label to the row it sits above", () => {
  const byIndex = runLabelsByIndex(walkableRuns([far, near(0), near(1), near(2), far]));
  assert.ok(byIndex.has(1));
  assert.equal(byIndex.has(0), false);
});
