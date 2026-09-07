import { strict as assert } from "node:assert";
import { test } from "node:test";
import { generateInviteCode, INVITE_CODE_LENGTH, inviteExpiresAt } from "./trip-invite.ts";

test("generateInviteCode uses unambiguous length and alphabet", () => {
  const code = generateInviteCode();
  assert.equal(code.length, INVITE_CODE_LENGTH);
  assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  assert.notEqual(generateInviteCode(), generateInviteCode());
});

test("inviteExpiresAt is about seven days out", () => {
  const from = Date.parse("2026-09-07T00:00:00.000Z");
  const exp = Date.parse(inviteExpiresAt(from));
  assert.equal(exp - from, 7 * 24 * 60 * 60 * 1000);
});
