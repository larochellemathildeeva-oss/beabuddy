import { strict as assert } from "node:assert";
import { test } from "node:test";
import { validateVaultPasscode } from "./vault-passcode.ts";

test("a PIN needs six digits", () => {
  for (const weak of ["1234", "0000", "12345"]) {
    assert.equal(validateVaultPasscode(weak).valid, false, weak);
  }
  assert.equal(validateVaultPasscode("739184").valid, true);
  assert.equal(validateVaultPasscode("73918455").valid, true);
});

test("anything else needs ten characters", () => {
  for (const weak of ["secret", "abcd", "12345abcd", "pass word"]) {
    assert.equal(validateVaultPasscode(weak).valid, false, weak);
  }
  assert.equal(validateVaultPasscode("winter-coffee-train").valid, true);
  assert.equal(validateVaultPasscode("1234abcd!?").valid, true);
});

test("characters are counted as a person counts them", () => {
  // Nine accented letters are nine characters, not more.
  assert.equal(validateVaultPasscode("ééééééééé").valid, false);
  assert.equal(validateVaultPasscode("éééééééééé").valid, true);
});

test("blank or whitespace is refused with a message", () => {
  const blank = validateVaultPasscode("");
  assert.equal(blank.valid, false);
  assert.equal(validateVaultPasscode("          ").valid, false);
  if (!blank.valid) assert.ok(blank.message.length > 0);
});
