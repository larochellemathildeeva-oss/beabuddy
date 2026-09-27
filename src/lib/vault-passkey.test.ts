import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKeyBits,
  importVaultKey,
  parsePasskeyRecord,
  passkeyStorageKey,
} from "./vault-passkey.ts";
import { decryptJson, deriveKey, encryptJson, randomB64 } from "./vaultCrypto.ts";

test("a stored record is read only when whole and well formed", () => {
  const good = { v: 1, credentialId: "YWJj", prfSalt: "c2FsdA==", wrapped: "d3JhcA==", iv: "aXY=" };
  assert.deepEqual(parsePasskeyRecord(JSON.stringify(good)), good);
  assert.equal(parsePasskeyRecord(null), null);
  assert.equal(parsePasskeyRecord("not json"), null);
  assert.equal(parsePasskeyRecord(JSON.stringify({ ...good, v: 2 })), null);
  assert.equal(parsePasskeyRecord(JSON.stringify({ ...good, wrapped: "" })), null);
  assert.equal(parsePasskeyRecord(JSON.stringify({ ...good, iv: "<script>" })), null);
});

test("the storage key never collides with the old cleared keys", () => {
  assert.equal(passkeyStorageKey("u1"), "bea.protected.passkey.u1");
  assert.ok(!passkeyStorageKey("u1").startsWith("bea.vault."));
});

test("raw PBKDF2 bits give the same AES key as deriveKey", async () => {
  const salt = randomB64(16);
  const fromPasscode = await deriveKey("2468", salt);
  const fromBits = await importVaultKey(await deriveKeyBits("2468", salt));
  const sealed = await encryptJson(fromPasscode, "bea-vault-ok");
  assert.equal(await decryptJson<string>(fromBits, sealed.ciphertext, sealed.iv), "bea-vault-ok");
  const other = await importVaultKey(await deriveKeyBits("1357", salt));
  await assert.rejects(decryptJson<string>(other, sealed.ciphertext, sealed.iv));
});
