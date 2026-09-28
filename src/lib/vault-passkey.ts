/**
 * Face ID / fingerprint unlock for Protected, through a device passkey.
 *
 * Protected is encrypted with a key derived from the traveller's passcode
 * (vaultCrypto.ts). A passkey cannot stand in for the passcode unless it can
 * produce a secret of its own, so this uses WebAuthn's PRF extension: after
 * the device checks the face or finger, the authenticator returns 32 bytes
 * that only it can compute for this credential and salt. Those bytes (through
 * HKDF) encrypt a copy of the Protected key, and only that encrypted copy is
 * kept, in this browser's storage. Without the device's biometric check the
 * copy is useless; the passcode keeps working everywhere.
 *
 * The older "Face ID" kept the key itself in localStorage, which is why
 * `clearStoredVaultKeys` exists. This never stores the key or the PRF output.
 *
 * Where PRF is not supported (older browsers, some password managers), enrol
 * fails with a plain message and the passcode is the only way in.
 */
import { fromB64, randomB64, toB64 } from "./vaultCrypto.ts";

const enc = new TextEncoder();

export type PasskeyRecord = {
  v: 1;
  /** The credential's raw id, base64. */
  credentialId: string;
  /** The PRF input, base64. */
  prfSalt: string;
  /** The Protected key's 32 raw bytes, encrypted with the PRF-derived key. */
  wrapped: string;
  iv: string;
};

export function passkeyStorageKey(uid: string): string {
  return `bea.protected.passkey.${uid}`;
}

/** A stored record, or null for anything missing or malformed. */
export function parsePasskeyRecord(raw: string | null | undefined): PasskeyRecord | null {
  if (!raw) return null;
  try {
    const r = JSON.parse(raw) as Partial<PasskeyRecord>;
    const b64 = (s: unknown) =>
      typeof s === "string" && s.length > 0 && /^[A-Za-z0-9+/=]+$/.test(s);
    if (r.v !== 1) return null;
    if (!b64(r.credentialId) || !b64(r.prfSalt) || !b64(r.wrapped) || !b64(r.iv)) return null;
    return r as PasskeyRecord;
  } catch {
    return null;
  }
}

export function readPasskeyRecord(uid: string): PasskeyRecord | null {
  try {
    return parsePasskeyRecord(window.localStorage.getItem(passkeyStorageKey(uid)));
  } catch {
    return null;
  }
}

export function forgetPasskey(uid: string) {
  try {
    window.localStorage.removeItem(passkeyStorageKey(uid));
  } catch {
    /* private mode */
  }
}

/** Whether this browser can even try (it may still lack PRF). */
export function passkeysPossible(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof window.PublicKeyCredential === "function" &&
    !!navigator.credentials
  );
}

/** Same bits PBKDF2 gives `deriveKey` in vaultCrypto — so the same AES key. */
export async function deriveKeyBits(passcode: string, saltB64: string): Promise<ArrayBuffer> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: fromB64(saltB64) as BufferSource, iterations: 210000, hash: "SHA-256" },
    base,
    256,
  );
}

export async function importVaultKey(raw: ArrayBuffer): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function wrappingKey(prfOutput: ArrayBuffer): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", prfOutput, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(32) as BufferSource,
      info: enc.encode("bea-protected-wrap-v1") as BufferSource,
    },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

type PrfResults = { enabled?: boolean; results?: { first?: ArrayBuffer } };

function prfOf(cred: PublicKeyCredential): PrfResults | undefined {
  return (cred.getClientExtensionResults() as { prf?: PrfResults }).prf;
}

async function prfAssertion(credentialId: string, prfSalt: string): Promise<ArrayBuffer> {
  const cred = (await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: "public-key", id: fromB64(credentialId) as BufferSource }],
      userVerification: "required",
      timeout: 60_000,
      extensions: {
        prf: { eval: { first: fromB64(prfSalt) as BufferSource } },
      } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  const first = cred ? prfOf(cred)?.results?.first : undefined;
  if (!first) throw new Error("This device did not unlock Protected. Use your passcode.");
  return first;
}

/**
 * Sets up Face ID / fingerprint for Protected on this device. `rawKey` is the
 * key the passcode derives (from `deriveKeyBits`), already checked.
 */
export async function enrolPasskey(uid: string, rawKey: ArrayBuffer): Promise<void> {
  if (!passkeysPossible()) {
    throw new Error(
      "This browser cannot use Face ID or fingerprint here. Keep using your passcode.",
    );
  }
  const created = (await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: "Béa" },
      user: {
        id: crypto.getRandomValues(new Uint8Array(16)),
        name: "Béa Protected",
        displayName: "Béa Protected",
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "discouraged",
        userVerification: "required",
      },
      timeout: 60_000,
      extensions: { prf: {} } as AuthenticationExtensionsClientInputs,
    },
  })) as PublicKeyCredential | null;
  if (!created) throw new Error("Face ID or fingerprint was not set up.");
  if (prfOf(created)?.enabled !== true) {
    throw new Error(
      "This device cannot unlock encrypted files with Face ID or fingerprint in this browser. Keep using your passcode.",
    );
  }
  const credentialId = toB64(created.rawId);
  const prfSalt = randomB64(32);
  const output = await prfAssertion(credentialId, prfSalt);
  const wrapKey = await wrappingKey(output);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapped = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, wrapKey, rawKey);
  const record: PasskeyRecord = {
    v: 1,
    credentialId,
    prfSalt,
    wrapped: toB64(wrapped),
    iv: toB64(iv.buffer),
  };
  window.localStorage.setItem(passkeyStorageKey(uid), JSON.stringify(record));
}

/** The Protected key, after the device's face or fingerprint check. */
export async function unlockWithPasskey(record: PasskeyRecord): Promise<CryptoKey> {
  const output = await prfAssertion(record.credentialId, record.prfSalt);
  const wrapKey = await wrappingKey(output);
  let raw: ArrayBuffer;
  try {
    raw = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: fromB64(record.iv) as BufferSource },
      wrapKey,
      fromB64(record.wrapped) as BufferSource,
    );
  } catch {
    throw new Error("Face ID or fingerprint did not match this device's setup. Use your passcode.");
  }
  return importVaultKey(raw);
}
