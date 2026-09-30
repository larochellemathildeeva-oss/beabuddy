import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  accountCopyWins,
  backedUp,
  isMissingTable,
  readKeptDirections,
  signOutClears,
} from "./directions-backup.ts";

const at = (iso: string) => ({ savedAt: iso });

test("only a real copy is read back from the account", () => {
  const copy = { legs: [{ from: "A" }], unresolved: ["B"], savedAt: "2026-09-30T08:00:00Z" };
  assert.deepEqual(readKeptDirections(copy), copy);
  assert.equal(readKeptDirections(null), null);
  assert.equal(readKeptDirections("legs"), null);
  assert.equal(readKeptDirections({ ...copy, legs: "nope" }), null);
  assert.equal(readKeptDirections({ ...copy, unresolved: [1] }), null);
  assert.equal(readKeptDirections({ ...copy, savedAt: "yesterday" }), null);
  assert.equal(readKeptDirections({ legs: [], unresolved: [] }), null);
});

test("the account's copy is written onto the phone only when it is newer or the phone has none", () => {
  assert.equal(accountCopyWins(null, at("2026-09-30T08:00:00Z")), true);
  assert.equal(accountCopyWins(at("2026-09-29T08:00:00Z"), at("2026-09-30T08:00:00Z")), true);
  assert.equal(accountCopyWins(at("2026-09-30T08:00:00Z"), at("2026-09-30T08:00:00Z")), false);
  // Kept on the phone while the account could not be reached: the phone's stays.
  assert.equal(accountCopyWins(at("2026-09-30T09:00:00Z"), at("2026-09-30T08:00:00Z")), false);
  assert.equal(accountCopyWins(null, null), false);
  // A phone copy with no date is older than any real one.
  assert.equal(accountCopyWins({}, at("2026-09-30T08:00:00Z")), true);
});

test("a phone copy is backed up only by an account copy as new or newer", () => {
  assert.equal(backedUp(at("2026-09-30T08:00:00Z"), at("2026-09-30T08:00:00Z")), true);
  assert.equal(backedUp(at("2026-09-30T08:00:00Z"), at("2026-09-30T09:00:00Z")), true);
  assert.equal(backedUp(at("2026-09-30T09:00:00Z"), at("2026-09-30T08:00:00Z")), false);
  assert.equal(backedUp(at("2026-09-30T08:00:00Z"), null), false);
  assert.equal(backedUp(at("2026-09-30T08:00:00Z"), undefined), false);
  assert.equal(backedUp(at("2026-09-30T08:00:00Z"), { savedAt: "garbled" }), false);
});

test("sign-out clears only what the account holds, and nothing without an answer", () => {
  const phone = new Map([
    ["kyoto", at("2026-09-30T08:00:00Z")],
    ["lisbon", at("2026-09-30T10:00:00Z")],
    ["oaxaca", at("2026-09-30T08:00:00Z")],
  ]);
  const account = new Map([
    ["kyoto", at("2026-09-30T08:00:00Z")],
    // Kept again on the phone after the last copy reached the account.
    ["lisbon", at("2026-09-30T09:00:00Z")],
  ]);
  assert.deepEqual(signOutClears(phone, account), { clear: ["kyoto"], keep: ["lisbon", "oaxaca"] });
  // No signal, or the table not there yet: everything stays.
  assert.deepEqual(signOutClears(phone, null), {
    clear: [],
    keep: ["kyoto", "lisbon", "oaxaca"],
  });
  assert.deepEqual(signOutClears(new Map(), account), { clear: [], keep: [] });
});

test("a table that is not there yet is told apart from other errors", () => {
  assert.equal(isMissingTable({ code: "42P01", message: "" }), true);
  assert.equal(isMissingTable({ code: "PGRST205", message: "" }), true);
  assert.equal(
    isMissingTable({
      message: "Could not find the table 'public.trip_directions' in the schema cache",
    }),
    true,
  );
  assert.equal(
    isMissingTable({ message: 'relation "public.trip_directions" does not exist' }),
    true,
  );
  assert.equal(isMissingTable({ code: "42501", message: "permission denied" }), false);
  assert.equal(isMissingTable(null), false);
});
