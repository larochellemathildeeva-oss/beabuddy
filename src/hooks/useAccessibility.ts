import { useEffect, useSyncExternalStore } from "react";
import {
  ACCESSIBILITY_KEY,
  applyAccessibility,
  DEFAULT_ACCESSIBILITY,
  parseAccessibility,
  serializeAccessibility,
  type Accessibility,
} from "@/lib/accessibility";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import { getStored, setStored } from "@/lib/settings-storage";

// One value for the whole page, so every screen follows a change at once.
let current: Accessibility | null = null;
const listeners = new Set<() => void>();

function snapshot(): Accessibility {
  if (current === null) current = parseAccessibility(getStored(ACCESSIBILITY_KEY));
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab, or the account's value arriving from another device.
  const onStorage = (e: StorageEvent) => {
    if (e.key === ACCESSIBILITY_KEY || e.key === null) {
      current = null;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function setAccessibility(patch: Partial<Accessibility>) {
  const next = { ...snapshot(), ...patch };
  current = next;
  applyAccessibility(next, document.documentElement);
  const stored = serializeAccessibility(next);
  setStored(ACCESSIBILITY_KEY, stored);
  saveAccountSetting("accessibility", stored);
  listeners.forEach((l) => l());
}

/** The reading settings, applied to the page and saved on change. */
export function useAccessibility(): [Accessibility, (patch: Partial<Accessibility>) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => DEFAULT_ACCESSIBILITY);
  useEffect(() => {
    applyAccessibility(value, document.documentElement);
  }, [value]);
  return [value, setAccessibility];
}
