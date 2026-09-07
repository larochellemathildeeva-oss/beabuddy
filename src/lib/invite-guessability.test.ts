import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  hoursToScanFraction,
  inviteAttemptsPerHour,
  inviteCodeSpace,
  INVITE_ALPHABET_SIZE,
  INVITE_ATTEMPT_LIMIT,
  INVITE_GUESS_LENGTH,
} from "./invite-guessability.ts";
import { INVITE_CODE_LENGTH, generateInviteCode } from "./trip-invite.ts";

test("guessability constants stay in sync with trip-invite", () => {
  assert.equal(INVITE_GUESS_LENGTH, INVITE_CODE_LENGTH);
  assert.equal(INVITE_ALPHABET_SIZE, 32);
  assert.match(generateInviteCode(), /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
});

test("invite space is 32^10", () => {
  assert.equal(inviteCodeSpace(), 32 ** 10);
  assert.ok(inviteCodeSpace() > 1e15);
});

test("throttle allows 120 attempts per user-hour", () => {
  assert.equal(INVITE_ATTEMPT_LIMIT, 20);
  assert.equal(inviteAttemptsPerHour(), 120);
});

test("scanning even 1e-9 of the space is impractical for one user", () => {
  const hours = hoursToScanFraction(1e-9);
  assert.ok(hours > 1000);
});
