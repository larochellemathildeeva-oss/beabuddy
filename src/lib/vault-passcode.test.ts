import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  VAULT_NUMERIC_MIN_DIGITS,
  VAULT_PASSPHRASE_MIN_CHARS,
  validateVaultPasscode,
} from "./vault-passcode.ts";

test("the policy is twelve characters, twelve digits", () => {
  assert.equal(VAULT_PASSPHRASE_MIN_CHARS, 12);
  assert.equal(VAULT_NUMERIC_MIN_DIGITS, 12);
});

test("ordinary numeric PINs are refused", () => {
  for (const weak of ["1234", "000000", "739184", "12345678", "12345678901"]) {
    assert.equal(validateVaultPasscode(weak).valid, false, weak);
  }
  assert.equal(validateVaultPasscode("739184552761").valid, true);
});

test("passphrases need twelve characters", () => {
  for (const weak of ["secret", "abcd", "pass word", "12345abcd!?", "winter-cafe"]) {
    assert.equal(validateVaultPasscode(weak).valid, false, weak);
  }
  assert.equal(validateVaultPasscode("winter-coffee-train").valid, true);
  assert.equal(validateVaultPasscode("violet window").valid, true);
});

test("characters are counted as a person counts them", () => {
  assert.equal(validateVaultPasscode("é".repeat(VAULT_PASSPHRASE_MIN_CHARS - 1)).valid, false);
  assert.equal(validateVaultPasscode("é".repeat(VAULT_PASSPHRASE_MIN_CHARS)).valid, true);
});

test("blank or whitespace is refused with a message", () => {
  const blank = validateVaultPasscode("");
  assert.equal(blank.valid, false);
  if (!blank.valid) assert.ok(blank.message.length > 0);
  assert.equal(validateVaultPasscode(" ".repeat(20)).valid, false);
});
