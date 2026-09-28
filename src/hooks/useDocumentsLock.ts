import { useCallback, useEffect, useState } from "react";
import type { useVault } from "@/hooks/useVault";
import { LOCK_GRACE_MS, freshSignIn, lockIsOn, lockSettingKey } from "@/lib/trip-documents";

type Vault = ReturnType<typeof useVault>;

/**
 * Open for a few minutes after an unlock, while Béa stays open, so going to a
 * trip and back does not ask again. Memory only: a reload locks it.
 */
let openUntil = 0;

function readLockSetting(uid: string): boolean {
  try {
    return lockIsOn(window.localStorage.getItem(lockSettingKey(uid)));
  } catch {
    return true;
  }
}

/**
 * The optional lock over the whole of Trip documents: on by default, opened
 * with the Protected passcode or Face ID / fingerprint. It is a privacy
 * screen for someone holding the unlocked phone — the bookings themselves are
 * not encrypted (trip members share them); Protected is.
 */
export function useDocumentsLock(
  uid: string | null,
  lastSignInAt: string | null | undefined,
  v: Vault,
) {
  const [lockOn, setLockOnState] = useState(true);
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!uid) return;
    setLockOnState(readLockSetting(uid));
    setReady(true);
  }, [uid]);

  useEffect(() => {
    if (v.unlocked) {
      openUntil = Date.now() + LOCK_GRACE_MS;
      bump((n) => n + 1);
    }
  }, [v.unlocked]);

  const setLockOn = useCallback(
    (on: boolean) => {
      if (!uid) return;
      try {
        if (on) window.localStorage.removeItem(lockSettingKey(uid));
        else window.localStorage.setItem(lockSettingKey(uid), "off");
      } catch {
        /* private mode: the setting lasts for this visit */
      }
      if (on) openUntil = Date.now() + LOCK_GRACE_MS;
      setLockOnState(on);
    },
    [uid],
  );

  const now = Date.now();
  const openNow = !lockOn || v.unlocked || openUntil > now || freshSignIn(lastSignInAt, now);
  // Once open, it stays open until the page is left — never shut mid-task.
  const [stayOpen, setStayOpen] = useState(false);
  useEffect(() => {
    if (openNow && ready) setStayOpen(true);
  }, [openNow, ready]);

  return { ready, lockOn, open: openNow || stayOpen, setLockOn };
}
