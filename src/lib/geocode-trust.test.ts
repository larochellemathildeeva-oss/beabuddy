import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { geocodeIsTrustworthy, hitMatchesName, queryIsLocatable } from "./geocode-trust.ts";

describe("queryIsLocatable", () => {
  it("rejects a bare business name", () => {
    // The Harvey's case: a chain name locates nothing on its own.
    assert.equal(queryIsLocatable({ name: "Harvey's" }), false);
    assert.equal(queryIsLocatable({ name: "Starbucks" }), false);
    assert.equal(queryIsLocatable({ name: "Bar Raval" }), false);
  });

  it("accepts a street address", () => {
    assert.equal(queryIsLocatable({ name: "Bar Raval", address: "505 College St" }), true);
  });

  it("accepts an address with a locality even without a number", () => {
    assert.equal(
      queryIsLocatable({ name: "Harvey's", address: "Sainte-Catherine, Montreal" }),
      true,
    );
  });

  it("accepts a city or a country on its own", () => {
    assert.equal(queryIsLocatable({ name: "Harvey's", city: "Montreal" }), true);
    assert.equal(queryIsLocatable({ name: "Harvey's", country: "Canada" }), true);
  });

  it("rejects an address that says what, not where", () => {
    assert.equal(queryIsLocatable({ name: "Harvey's", address: "Restaurant" }), false);
  });

  it("treats blank strings as absent", () => {
    assert.equal(queryIsLocatable({ name: "Harvey's", city: "   ", address: "" }), false);
  });
});

describe("hitMatchesName", () => {
  it("matches the same name", () => {
    assert.equal(hitMatchesName("Harvey's", "Harvey's"), true);
  });

  it("matches through accents, apostrophes and case", () => {
    assert.equal(hitMatchesName("Café de Flore", "Cafe de Flore"), true);
    assert.equal(hitMatchesName("Harvey's", "Harveys"), true);
  });

  it("matches when one contains the other", () => {
    assert.equal(hitMatchesName("Bar Raval", "Bar Raval Toronto"), true);
  });

  it("rejects a different place", () => {
    assert.equal(hitMatchesName("Harvey's", "Reštaurácia U Karola"), false);
    assert.equal(hitMatchesName("Bar Raval", "El Raval"), false);
  });

  it("rejects empty input rather than matching everything", () => {
    assert.equal(hitMatchesName("", "Harvey's"), false);
    assert.equal(hitMatchesName("Harvey's", ""), false);
  });
});

describe("geocodeIsTrustworthy", () => {
  it("refuses the bug: a bare chain name matched to somewhere far away", () => {
    assert.equal(
      geocodeIsTrustworthy({ name: "Harvey's", hitName: "Harvey's" }),
      false,
      "a name alone must never be geocoded, even when the hit's name matches",
    );
  });

  it("accepts a name with a real address that comes back matching", () => {
    assert.equal(
      geocodeIsTrustworthy({
        name: "Bar Raval",
        address: "505 College St, Toronto",
        hitName: "Bar Raval",
      }),
      true,
    );
  });

  it("refuses a located query whose result is a different place", () => {
    assert.equal(
      geocodeIsTrustworthy({
        name: "Harvey's",
        city: "Montreal",
        hitName: "Boulangerie Saint-Henri",
      }),
      false,
    );
  });

  it("accepts an address-only query, which is specific by itself", () => {
    assert.equal(
      geocodeIsTrustworthy({ address: "505 College St, Toronto", hitName: "Some Building" }),
      true,
    );
  });

  it("refuses when the hit has no name to check against", () => {
    assert.equal(geocodeIsTrustworthy({ name: "Harvey's", city: "Montreal" }), false);
  });
});
