/**
 * How strong a Protected passcode must be.
 *
 * Protected is encrypted in the browser with a key from the passcode
 * (PBKDF2, 210,000 rounds, then AES-GCM; vaultCrypto.ts). The cipher is not
 * the weak part: anyone holding a copy of the vault's settings can try
 * passcodes offline against its verifier, with no rate limit. PBKDF2 slows
 * each guess but adds no entropy: a million six-digit PINs fall in hours on
 * one GPU. So a new passcode is a passphrase of at least 12 characters, and
 * one made only of digits needs at least 12 of them. Length is the rule, not
 * character classes, which mostly produce predictable passwords.
 *
 * Existing vaults with a shorter passcode still unlock (Béa cannot change a
 * passcode it does not know); on unlock they are asked to choose a stronger
 * one, which re-encrypts what is inside (useVault's `changePasscode`).
 *
 * Pure and tested. The hook enforces it as well as the form, so no other
 * caller can create a weak vault.
 */

export const VAULT_PASSPHRASE_MIN_CHARS = 12;
export const VAULT_NUMERIC_MIN_DIGITS = 12;

export type PasscodeCheck = { valid: true } | { valid: false; message: string };

/** Characters as a person counts them, so "é" or an emoji is one. */
function length(value: string): number {
  return [...value].length;
}

export function validateVaultPasscode(value: string): PasscodeCheck {
  if (value.trim() === "") return { valid: false, message: "Choose a passphrase." };
  if (/^\d+$/.test(value)) {
    return length(value) >= VAULT_NUMERIC_MIN_DIGITS
      ? { valid: true }
      : {
          valid: false,
          message: `A passcode of only digits needs at least ${VAULT_NUMERIC_MIN_DIGITS}. A passphrase of ${VAULT_PASSPHRASE_MIN_CHARS} characters or more is easier to remember.`,
        };
  }
  return length(value) >= VAULT_PASSPHRASE_MIN_CHARS
    ? { valid: true }
    : {
        valid: false,
        message: `Use at least ${VAULT_PASSPHRASE_MIN_CHARS} characters. A few words with spaces works well.`,
      };
}

/** The rule, as the form states it. */
export const VAULT_PASSCODE_HINT = `At least ${VAULT_PASSPHRASE_MIN_CHARS} characters, such as a few words with spaces.`;
