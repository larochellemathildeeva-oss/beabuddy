import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveKeyBits,
  importVaultKey,
  parsePasskeyRecord,
  passkeyStorageKey,
} from "./vault-passkey.ts";
import { decryptJson, deriveKey, encryptJson, randomB64, reencryptRows } from "./vaultCrypto.ts";

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

test("a passcode change re-seals every row under the new key, each with a fresh IV", async () => {
  const oldKey = await deriveKey("2468", randomB64(16));
  const newKey = await deriveKey("winter-coffee-train", randomB64(16));
  const secret = { number: "ABC123", notes: "gate 4" };
  const sealed = await encryptJson(oldKey, secret);
  const rows = [
    { id: "a", ...sealed },
    { id: "b", ...(await encryptJson(oldKey, secret)) },
  ];
  assert.notEqual(rows[0]!.iv, rows[1]!.iv, "the same document sealed twice gets different IVs");
  assert.notEqual(rows[0]!.ciphertext, rows[1]!.ciphertext);

  const next = await reencryptRows(oldKey, newKey, rows);
  assert.deepEqual(
    next.map((r) => r.id),
    ["a", "b"],
  );
  for (const row of next) {
    assert.deepEqual(await decryptJson(newKey, row.ciphertext, row.iv), secret);
    await assert.rejects(decryptJson(oldKey, row.ciphertext, row.iv));
    assert.notEqual(row.iv, sealed.iv);
  }
});

test("a row the old key cannot open stops the change before anything is sealed", async () => {
  const oldKey = await deriveKey("2468", randomB64(16));
  const other = await deriveKey("1357", randomB64(16));
  const newKey = await deriveKey("winter-coffee-train", randomB64(16));
  const rows = [{ id: "x", ...(await encryptJson(other, "not yours")) }];
  await assert.rejects(reencryptRows(oldKey, newKey, rows));
});
