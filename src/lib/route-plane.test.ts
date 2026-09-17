import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PLANE,
  isPlane,
  planeFromMatches,
  planeIsUndeclared,
  travelDirection,
} from "./route-plane.ts";

describe("isPlane", () => {
  it("accepts the three planes and nothing else", () => {
    for (const p of ["tab", "detail", "sheet"]) assert.equal(isPlane(p), true, p);
    for (const junk of ["modal", "", null, undefined, 1, {}]) {
      assert.equal(isPlane(junk), false, String(junk));
    }
  });
});

describe("planeFromMatches", () => {
  it("reads the deepest declared plane", () => {
    const matches = [{ staticData: { plane: "tab" } }, { staticData: { plane: "detail" } }];
    assert.equal(planeFromMatches(matches), "detail");
  });

  it("lets a parent supply the plane when the child declares none", () => {
    const matches = [{ staticData: { plane: "detail" } }, {}];
    assert.equal(planeFromMatches(matches), "detail");
  });

  it("falls back to tab when nothing declares one", () => {
    assert.equal(planeFromMatches([{}, {}]), DEFAULT_PLANE);
    assert.equal(planeFromMatches([]), DEFAULT_PLANE);
  });

  it("ignores a value that is not a plane", () => {
    // A typo must not become a data-plane the CSS has no rule for.
    assert.equal(planeFromMatches([{ staticData: { plane: "detials" } }]), DEFAULT_PLANE);
  });
});

describe("planeIsUndeclared", () => {
  it("is true only when no match declares a plane", () => {
    assert.equal(planeIsUndeclared([{}, {}]), true);
    assert.equal(planeIsUndeclared([{}, { staticData: { plane: "tab" } }]), false);
    assert.equal(planeIsUndeclared([{ staticData: { plane: "nope" } }]), true);
  });
});

describe("travelDirection", () => {
  it("points the way along the tab bar", () => {
    assert.equal(travelDirection(0, 3), 1);
    assert.equal(travelDirection(3, 0), -1);
  });

  it("has no direction when staying put", () => {
    assert.equal(travelDirection(2, 2), 0);
  });

  it("has no direction when either end is off the bar", () => {
    // Leaving a tab for Settings, or arriving from it, is not a sideways move.
    assert.equal(travelDirection(-1, 2), 0);
    assert.equal(travelDirection(2, -1), 0);
    assert.equal(travelDirection(-1, -1), 0);
  });
});
