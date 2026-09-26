import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  addPlaceholder,
  anyFilterWorthShowing,
  categoryKey,
  categoryOptions,
  filterIsStale,
  kindFilterWorthShowing,
  placeFilterWorthShowing,
  searchWorthShowing,
} from "./reco-ui.ts";

describe("searchWorthShowing", () => {
  it("stays out of the way of a short list", () => {
    assert.equal(searchWorthShowing({ total: 1 }), false);
    assert.equal(searchWorthShowing({ total: 5 }), false);
  });

  it("appears once the list stops fitting in your head", () => {
    assert.equal(searchWorthShowing({ total: 6 }), true);
    assert.equal(searchWorthShowing({ total: 40 }), true);
  });
});

describe("place and kind filters", () => {
  it("are hidden for a vault with one place in it", () => {
    // The screenshot that prompted this: 1 saved, two filter rows above it.
    const shape = { total: 1, places: 1, kinds: 1 };
    assert.equal(placeFilterWorthShowing(shape), false);
    assert.equal(kindFilterWorthShowing(shape), false);
    assert.equal(anyFilterWorthShowing(shape), false);
  });

  it("stay hidden while there is only one value to filter to", () => {
    const shape = { total: 20, places: 1, kinds: 1 };
    assert.equal(anyFilterWorthShowing(shape), false);
  });

  it("stay hidden while the list is short, even with variety", () => {
    const shape = { total: 3, places: 3, kinds: 3 };
    assert.equal(anyFilterWorthShowing(shape), false);
  });

  it("appear once there is enough to narrow and something to narrow to", () => {
    const shape = { total: 6, places: 3, kinds: 2 };
    assert.equal(placeFilterWorthShowing(shape), true);
    assert.equal(kindFilterWorthShowing(shape), true);
  });

  it("can show one without the other", () => {
    const shape = { total: 12, places: 4, kinds: 1 };
    assert.equal(placeFilterWorthShowing(shape), true);
    assert.equal(kindFilterWorthShowing(shape), false);
    assert.equal(anyFilterWorthShowing(shape), true);
  });
});

describe("addPlaceholder", () => {
  it("teaches both inputs", () => {
    for (const text of [addPlaceholder(false), addPlaceholder(true)]) {
      assert.match(text, /link/i);
    }
  });

  it("invites a first save differently from a tenth", () => {
    assert.notEqual(addPlaceholder(false), addPlaceholder(true));
  });
});

describe("filterIsStale", () => {
  it("is fine while the selection still exists", () => {
    assert.equal(filterIsStale("Saitama", ["Saitama", "Kyoto"], "All places"), false);
  });

  it("spots a selection whose last place was removed", () => {
    assert.equal(filterIsStale("Saitama", ["Kyoto"], "All places"), true);
  });

  it("never calls the All pill stale", () => {
    assert.equal(filterIsStale("All places", [], "All places"), false);
  });
});

describe("categoryOptions", () => {
  it("lists each category once, whatever its case", () => {
    assert.deepEqual(categoryOptions(["cafe", "Cafe", "bar", " Pub ", null, "", "Bar"]), [
      "Cafe",
      "Bar",
      "Pub",
    ]);
    assert.equal(categoryKey(" Cafe "), categoryKey("cafe"));
  });
});
