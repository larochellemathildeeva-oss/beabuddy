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
    false,
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

/** Drop leftover Face ID convenience keys from older app versions. */
export function clearStoredVaultKeys(uid: string) {
  if (typeof window === "undefined") return;
  localStorage.removeItem(`bea.vault.key.${uid}`);
  localStorage.removeItem(`bea.vault.cred.${uid}`);
}
