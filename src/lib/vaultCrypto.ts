// Client-side encryption for trip documents (reservations, tickets, confirmations).
// Documents are encrypted in the browser with a key derived from the user's
// passcode; the server only ever stores ciphertext.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function randomB64(bytes = 16): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return toB64(a.buffer);
}

export async function deriveKey(passcode: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passcode), "PBKDF2", false, [
    "deriveKey",
  ]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: fromB64(saltB64) as BufferSource, iterations: 210000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson(key: CryptoKey, value: unknown) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const buf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(value)),
  );
  return { ciphertext: toB64(buf), iv: toB64(iv.buffer) };
}

export async function decryptJson<T>(key: CryptoKey, ciphertext: string, iv: string): Promise<T> {
  const buf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromB64(iv) as BufferSource },
    key,
    fromB64(ciphertext) as BufferSource,
  );
  return JSON.parse(dec.decode(buf)) as T;
}

export async function exportKey(key: CryptoKey): Promise<string> {
  return toB64(await crypto.subtle.exportKey("raw", key));
}

export async function importKey(raw: string): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", fromB64(raw) as BufferSource, "AES-GCM", true, [
    "encrypt",
    "decrypt",
  ]);
}

/* ---------- biometric (WebAuthn) unlock ---------- */

const KEY_STORE = (uid: string) => `bea.vault.key.${uid}`;
const CRED_STORE = (uid: string) => `bea.vault.cred.${uid}`;

export function biometricAvailable(): boolean {
  return typeof window !== "undefined" && !!window.PublicKeyCredential;
}

export function biometricEnrolled(uid: string): boolean {
  if (typeof window === "undefined") return false;
  return !!localStorage.getItem(CRED_STORE(uid)) && !!localStorage.getItem(KEY_STORE(uid));
}

export async function enrolBiometric(uid: string, email: string, key: CryptoKey): Promise<string> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = enc.encode(uid);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Béa" },
      user: { id: userId, name: email, displayName: email },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },
        { type: "public-key", alg: -257 },
      ],
      authenticatorSelection: { userVerification: "required", residentKey: "preferred" },
      timeout: 60000,
    },
  })) as PublicKeyCredential | null;
  if (!cred) throw new Error("Device unlock was cancelled");
  const credId = toB64(cred.rawId);
  localStorage.setItem(CRED_STORE(uid), credId);
  localStorage.setItem(KEY_STORE(uid), await exportKey(key));
  return credId;
}

export async function unlockWithBiometric(uid: string): Promise<CryptoKey> {
  const credId = localStorage.getItem(CRED_STORE(uid));
  const raw = localStorage.getItem(KEY_STORE(uid));
  if (!credId || !raw) throw new Error("Device unlock isn't set up on this device");
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: "public-key", id: fromB64(credId) as BufferSource }],
      userVerification: "required",
      timeout: 60000,
    },
  });
  if (!assertion) throw new Error("Device unlock failed");
  return importKey(raw);
}

export async function storedVaultKey(uid: string): Promise<CryptoKey | null> {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(KEY_STORE(uid));
  if (!raw) return null;
  try {
    return await importKey(raw);
  } catch {
    return null;
  }
}

export function forgetBiometric(uid: string) {
  localStorage.removeItem(CRED_STORE(uid));
  localStorage.removeItem(KEY_STORE(uid));
}
