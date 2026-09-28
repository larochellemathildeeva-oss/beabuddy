/**
 * The traveller's own name, remembered on this device so Home and You can
 * greet them by it straight away. Without it the email's first half showed
 * while the profile loaded, then blinked to the real name.
 */
export type NameStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const KEY_PREFIX = "bea.profileName.";
const memory = new Map<string, string>();

export function rememberedProfileName(storage: NameStorage, userId: string): string {
  const cached = memory.get(userId);
  if (cached !== undefined) return cached;
  const stored = storage.getItem(KEY_PREFIX + userId) ?? "";
  memory.set(userId, stored);
  return stored;
}

export function rememberProfileName(storage: NameStorage, userId: string, name: string): void {
  const trimmed = name.trim();
  memory.set(userId, trimmed);
  if (trimmed) storage.setItem(KEY_PREFIX + userId, trimmed);
  else storage.removeItem(KEY_PREFIX + userId);
}

/**
 * The name to show. The email's first half stands in only once the profile
 * has answered with no name — never while it is still loading.
 */
export function shownName(input: {
  profileName: string;
  profileLoaded: boolean;
  email: string | undefined;
}): string {
  const name = input.profileName.trim();
  if (name) return name;
  if (!input.profileLoaded) return "";
  return input.email?.split("@")[0] ?? "";
}
