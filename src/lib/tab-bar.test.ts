import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { activeTabIndex, indicatorOffset, pathMatchesTab } from "./tab-bar.ts";

const TABS = [
  { to: "/" },
  { to: "/world" },
  { to: "/trips" },
  { to: "/recommendations" },
  { to: "/opportunities" },
  { to: "/profile" },
] as const;

describe("pathMatchesTab", () => {
  it("gives Home only the root", () => {
    assert.equal(pathMatchesTab("/", "/"), true);
    assert.equal(pathMatchesTab("/world", "/"), false);
  });

  it("gives a tab its own subtree", () => {
    assert.equal(pathMatchesTab("/trips", "/trips"), true);
    assert.equal(pathMatchesTab("/trips/abc-123", "/trips"), true);
  });

  it("does not let a tab steal a sibling with the same prefix", () => {
    assert.equal(pathMatchesTab("/tripsy", "/trips"), false);
    assert.equal(pathMatchesTab("/profiles", "/profile"), false);
  });
});

describe("activeTabIndex", () => {
  it("finds each tab from its own path", () => {
    TABS.forEach((tab, i) => {
      assert.equal(activeTabIndex(tab.to, TABS), i, tab.to);
    });
  });

  it("finds the tab from a nested path", () => {
    assert.equal(activeTabIndex("/trips/abc", TABS), 2);
  });

  it("returns -1 for a route no tab owns", () => {
    // This is the whole point: these must not light up Home.
    for (const path of ["/preferences", "/help", "/story", "/expenses", "/how-it-works"]) {
      assert.equal(activeTabIndex(path, TABS), -1, path);
    }
  });

  it("prefers the longest match when two tabs could claim a path", () => {
    const nested = [{ to: "/trips" }, { to: "/trips/archive" }] as const;
    assert.equal(activeTabIndex("/trips/archive/2024", nested), 1);
  });
});

describe("indicatorOffset", () => {
  it("moves one full width per tab", () => {
    assert.equal(indicatorOffset(0), "translateX(0%)");
    assert.equal(indicatorOffset(3), "translateX(300%)");
  });

  it("does not produce a negative offset when nothing is active", () => {
    // The indicator is hidden at -1, but it must not first fly off the left.
    assert.equal(indicatorOffset(-1), "translateX(0%)");
  });
});
