import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_RADIUS,
  NEAR_RADII,
  NUDGE_RADIUS,
  formatMetres,
  nearFromSearch,
  nudgePin,
  pinsWithin,
  reachLabel,
} from "./near.ts";

const HERE = { lat: 45.5017, lon: -73.5673 }; // Montreal
// Roughly 0.001 degrees of latitude is ~111 m.
const at = (id: string, dLat: number) => ({ id, lat: HERE.lat + dLat, lon: HERE.lon });

describe("pinsWithin", () => {
  it("returns nothing without a location, rather than everything", () => {
    assert.deepEqual(pinsWithin(null, [at("a", 0)], 5_000), []);
  });

  it("keeps only what is inside the radius", () => {
    const pins = [at("close", 0.001), at("far", 0.5)];
    const out = pinsWithin(HERE, pins, 1_000);
    assert.deepEqual(
      out.map((r) => r.pin.id),
      ["close"],
    );
  });

  it("sorts nearest first", () => {
    const out = pinsWithin(HERE, [at("mid", 0.01), at("near", 0.001), at("edge", 0.02)], 5_000);
    assert.deepEqual(
      out.map((r) => r.pin.id),
      ["near", "mid", "edge"],
    );
  });

  it("drops anything dismissed", () => {
    const out = pinsWithin(HERE, [at("a", 0.001), at("b", 0.002)], 5_000, ["a"]);
    assert.deepEqual(
      out.map((r) => r.pin.id),
      ["b"],
    );
  });

  it("reports a distance with each pin", () => {
    const [row] = pinsWithin(HERE, [at("a", 0.001)], 5_000);
    assert.ok(row);
    assert.ok(row.metres > 80 && row.metres < 140, `got ${row.metres}`);
  });
});

describe("reachLabel", () => {
  it("describes effort, not distance", () => {
    assert.equal(reachLabel(100), "Right here");
    assert.equal(reachLabel(1_500), "A short walk");
    assert.equal(reachLabel(9_000), "Across town");
    assert.equal(reachLabel(100_000), "Day trip");
    assert.equal(reachLabel(900_000), "Next journey");
  });

  it("says Someday when there is no location at all", () => {
    assert.equal(reachLabel(null), "Someday");
  });

  it("has no gap between buckets", () => {
    for (const m of [400, 401, 2_000, 2_001, 15_000, 15_001, 150_000, 150_001]) {
      assert.ok(reachLabel(m).length > 0, `no label at ${m}`);
    }
  });
});

describe("nudgePin", () => {
  it("picks the nearest thing worth mentioning", () => {
    const out = nudgePin(HERE, [at("mid", 0.01), at("near", 0.001)]);
    assert.equal(out?.pin.id, "near");
  });

  it("stays quiet when nothing is close enough", () => {
    // Inside the vault's radius but well outside nudge range: Home is not a
    // list, so "somewhere across town" is noise rather than a prompt.
    assert.ok(NUDGE_RADIUS < DEFAULT_RADIUS);
    assert.equal(nudgePin(HERE, [at("acrosstown", 0.05)]), null);
  });

  it("stays quiet without a location", () => {
    assert.equal(nudgePin(null, [at("a", 0.001)]), null);
  });

  it("respects a dismissal", () => {
    assert.equal(nudgePin(HERE, [at("a", 0.001)], ["a"]), null);
  });
});

describe("formatMetres", () => {
  it("is precise up close and rounder far away", () => {
    assert.equal(formatMetres(42), "42 m");
    assert.equal(formatMetres(412), "410 m");
    assert.equal(formatMetres(1_430), "1.4 km");
    assert.equal(formatMetres(12_400), "12 km");
  });

  it("returns nothing for a nonsense distance", () => {
    assert.equal(formatMetres(Number.NaN), "");
    assert.equal(formatMetres(-5), "");
  });
});

describe("nearFromSearch", () => {
  it("accepts the router's own encoding", () => {
    // The router JSON-encodes what it writes, so its links come back as "1".
    assert.equal(nearFromSearch("1"), "1");
  });

  it("accepts a hand-typed or shared ?near=1", () => {
    // Which parses as the number. Honouring only the string would mean the
    // filter worked inside the app and broke on a shared link.
    assert.equal(nearFromSearch(1), "1");
    assert.equal(nearFromSearch(true), "1");
  });

  it("rejects everything else, so the URL stays meaningful", () => {
    for (const junk of ["true", "", "0", 0, 2, null, undefined, {}]) {
      assert.equal(nearFromSearch(junk), undefined, String(junk));
    }
  });
});

describe("radii", () => {
  it("offers the default among the choices", () => {
    assert.ok((NEAR_RADII as readonly number[]).includes(DEFAULT_RADIUS));
  });
});
