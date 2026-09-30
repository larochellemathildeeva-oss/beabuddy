/**
 * The device copy of a synced setting (account-settings.ts). localStorage
 * when it works; when it throws (storage blocked, a full quota), the value is
 * kept in memory for this visit instead, so a setting pulled from the account
 * or changed on this screen still shows everywhere until the page is left.
 */
const memory = new Map<string, string | null>();

export function getStored(key: string): string | null {
  try {
    const value = globalThis.localStorage?.getItem(key) ?? null;
    return memory.has(key) ? (memory.get(key) ?? null) : value;
  } catch {
    return memory.get(key) ?? null;
  }
}

/** Stores `value`, or removes it when null. */
export function setStored(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage?.removeItem(key);
    else globalThis.localStorage?.setItem(key, value);
    memory.delete(key);
  } catch {
    memory.set(key, value);
  }
}
