/**
 * How strong a Protected passcode must be.
 *
 * Protected is encrypted in the browser with a key from the passcode
 * (PBKDF2, 210,000 rounds, then AES-GCM; vaultCrypto.ts). The cipher is not
 * the weak part: anyone holding a copy of the vault's settings can try
 * passcodes offline against its verifier, and 10,000 four-digit PINs take
 * minutes. So a new passcode is either a PIN of at least 6 digits or a
 * passphrase of at least 10 characters.
 *
 * Existing vaults with a shorter passcode still unlock (Béa cannot change a
 * passcode it does not know); on unlock they are asked to choose a stronger
 * one, which re-encrypts what is inside (useVault's `changePasscode`).
 *
 * Pure and tested. The hook enforces it as well as the form, so no other
 * caller can create a weak vault.
 */

export const VAULT_PIN_MIN_DIGITS = 6;
export const VAULT_PASSPHRASE_MIN_CHARS = 10;

export type PasscodeCheck = { valid: true } | { valid: false; message: string };

/** Characters as a person counts them, so "é" or an emoji is one. */
function length(value: string): number {
  return [...value].length;
}

export function validateVaultPasscode(value: string): PasscodeCheck {
  if (/^\d+$/.test(value)) {
    return length(value) >= VAULT_PIN_MIN_DIGITS
      ? { valid: true }
      : { valid: false, message: `Use at least ${VAULT_PIN_MIN_DIGITS} digits.` };
  }
  if (value.trim() === "") return { valid: false, message: "Choose a passcode." };
  return length(value) >= VAULT_PASSPHRASE_MIN_CHARS
    ? { valid: true }
    : {
        valid: false,
        message: `Use at least ${VAULT_PASSPHRASE_MIN_CHARS} characters, or a PIN of ${VAULT_PIN_MIN_DIGITS} digits.`,
      };
}

/** The rule, as the form states it. */
export const VAULT_PASSCODE_HINT = `At least ${VAULT_PIN_MIN_DIGITS} digits, or a passphrase of ${VAULT_PASSPHRASE_MIN_CHARS} characters or more.`;
