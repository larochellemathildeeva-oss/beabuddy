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
