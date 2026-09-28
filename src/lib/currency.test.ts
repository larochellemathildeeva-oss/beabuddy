import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  currencyForCountry,
  localCurrencies,
  minorDigits,
  parseAmount,
  quickAmounts,
} from "./currency.ts";

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

test("three-decimal money and small amounts keep their decimals", () => {
  assert.equal(parseAmount("12.345", "KWD"), 12.345);
  assert.equal(parseAmount("0,125", "OMR"), 0.125);
  assert.equal(parseAmount("0.125"), 0.125);
  assert.equal(parseAmount("12.345", "USD"), 12345);
  assert.equal(minorDigits("JPY"), 0);
  assert.equal(minorDigits("BHD"), 3);
  assert.equal(minorDigits("EUR"), 2);
});

test("every inhabited country has a currency", () => {
  assert.equal(currencyForCountry("Curaçao"), "XCG");
  assert.equal(currencyForCountry("SX"), "XCG");
  assert.equal(currencyForCountry("Afghanistan"), "AFN");
  assert.equal(currencyForCountry("Angola"), "AOA");
  assert.equal(currencyForCountry("Iran"), "IRR");
  assert.equal(currencyForCountry("Venezuela"), "VES");
  // Named even without a daily rate, so the sheet can say there is none.
  assert.deepEqual(localCurrencies(["Morocco"], "CAD"), ["MAD"]);
});

test("quick amounts start near one unit of home money", () => {
  assert.deepEqual(quickAmounts(0.66), [1, 2, 5, 10, 20, 50]);
  assert.deepEqual(quickAmounts(110), [100, 200, 500, 1000, 2000, 5000]);
  assert.deepEqual(quickAmounts(null), [1, 2, 5, 10, 20, 50]);
});
