import { strict as assert } from "node:assert";
import { test } from "node:test";
import { currencyForCountry, localCurrencies, parseAmount, quickAmounts } from "./currency.ts";

test("a country's currency, from its name or code", () => {
  assert.equal(currencyForCountry("Japan"), "JPY");
  assert.equal(currencyForCountry("jp"), "JPY");
  assert.equal(currencyForCountry("France"), "EUR");
  assert.equal(currencyForCountry("United Kingdom"), "GBP");
  assert.equal(currencyForCountry("Morocco"), "MAD");
  assert.equal(currencyForCountry(""), null);
  assert.equal(currencyForCountry(null), null);
  assert.equal(currencyForCountry("Atlantis"), null);
});

test("a trip's local currencies, once each, without the home one", () => {
  assert.deepEqual(localCurrencies(["France", "Italy", "Switzerland", null], "CAD"), [
    "EUR",
    "CHF",
  ]);
  assert.deepEqual(localCurrencies(["Canada"], "CAD"), []);
});

test("amounts as people type them", () => {
  assert.equal(parseAmount("12.50"), 12.5);
  assert.equal(parseAmount("12,50"), 12.5);
  assert.equal(parseAmount("1 234,5"), 1234.5);
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("1.234,50"), 1234.5);
  assert.equal(parseAmount("1,234"), 1234);
  assert.equal(parseAmount("€20"), 20);
  assert.equal(parseAmount("3000"), 3000);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});

test("quick amounts start near one unit of home money", () => {
  assert.deepEqual(quickAmounts(0.66), [1, 2, 5, 10, 20, 50]);
  assert.deepEqual(quickAmounts(110), [100, 200, 500, 1000, 2000, 5000]);
  assert.deepEqual(quickAmounts(null), [1, 2, 5, 10, 20, 50]);
});
