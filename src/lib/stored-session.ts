/**
 * Whether this browser holds a Supabase session, from the names of its
 * localStorage keys alone (`sb-<project>-auth-token`). No network and no
 * token read: it only decides what to paint while sign-in is still being
 * checked, so a first-time visitor sees the welcome page at once instead of
 * a blank "Loading…". A wrong guess costs one repaint, never access: every
 * query still goes through the real session.
 */
export function hasStoredSessionKey(keys: Iterable<string>): boolean {
  for (const key of keys) {
    if (/^sb-[^-]+(-[^-]+)*-auth-token$/.test(key)) return true;
  }
  return false;
}

/** The same, against this browser's localStorage; false where it is blocked. */
export function browserHasStoredSession(): boolean {
  try {
    const store = window.localStorage;
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key) keys.push(key);
    }
    return hasStoredSessionKey(keys);
  } catch {
    return false;
  }
}

/**
 * The user in a saved Supabase session's JSON, or null. Used only when the
 * session cannot be refreshed for want of a network: the token may have
 * expired, but the traveller is still the one signed in on this phone, and
 * the pages kept offline are theirs. Every query still needs a live token.
 */
export function userFromStoredSession(raw: string | null): { id: string } | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const user = (parsed as { user?: unknown } | null)?.user;
    if (user && typeof user === "object" && typeof (user as { id?: unknown }).id === "string") {
      return user as { id: string };
    }
  } catch {
    // Not a session.
  }
  return null;
}

/** The signed-in user saved in this browser, read without the network. */
export function browserStoredSessionUser(): { id: string } | null {
  try {
    const store = window.localStorage;
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key && hasStoredSessionKey([key])) {
        const user = userFromStoredSession(store.getItem(key));
        if (user) return user;
      }
    }
  } catch {
    // Storage blocked.
  }
  return null;
}
