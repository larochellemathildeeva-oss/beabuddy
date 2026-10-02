import type { NameStorage } from "./profile-name";

const DISMISS_PREFIX = "bea.nameAsk.dismissed.";

/**
 * Sign-up no longer asks for a name, so a new account's profile starts with
 * the email's first half (the `handle_new_user` fallback). Home asks once,
 * where the greeting shows it — and so do the trip's other travellers.
 */
export function shouldAskName(
  storage: Pick<NameStorage, "getItem">,
  input: {
    userId: string | undefined;
    email: string | undefined;
    profileName: string;
    profileLoaded: boolean;
  },
): boolean {
  if (!input.userId || !input.profileLoaded) return false;
  const name = input.profileName.trim();
  const fallback = input.email?.split("@")[0] ?? "";
  if (name && name !== fallback) return false;
  return storage.getItem(DISMISS_PREFIX + input.userId) !== "1";
}

export function dismissNameAsk(storage: Pick<NameStorage, "setItem">, userId: string): void {
  storage.setItem(DISMISS_PREFIX + userId, "1");
}
