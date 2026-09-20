import { strict as assert } from "node:assert";
import { test } from "node:test";
import { hitsSpanCountries } from "./place-search-near.ts";

test("hitsSpanCountries is false for one country or no countries", () => {
  assert.equal(hitsSpanCountries([{ country: "Canada" }, { country: "Canada" }]), false);
  assert.equal(hitsSpanCountries([{ country: null }, {}]), false);
  assert.equal(hitsSpanCountries([]), false);
});

test("hitsSpanCountries catches the worldwide Subway list", () => {
  assert.equal(
    hitsSpanCountries([
      { country: "Mexico" },
      { country: "New Zealand" },
      { country: "Finland" },
      { country: "India" },
    ]),
    true,
  );
});
