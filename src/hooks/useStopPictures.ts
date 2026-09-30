import { useEffect, useSyncExternalStore } from "react";
import {
  applyStopPictures,
  asStopPictures,
  STOP_PICTURES_KEY,
  type StopPictures,
} from "@/lib/stop-pictures";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import { getStored, setStored } from "@/lib/settings-storage";

// One value for the whole page, so every picture follows a change at once.
let current: StopPictures | null = null;
const listeners = new Set<() => void>();

function snapshot(): StopPictures {
  if (current === null) {
    current = asStopPictures(getStored(STOP_PICTURES_KEY));
  }
  return current;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab, or the account's value arriving from another device.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STOP_PICTURES_KEY || e.key === null) {
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

function setStopPictures(next: StopPictures) {
  current = next;
  applyStopPictures(next, document.documentElement);
  setStored(STOP_PICTURES_KEY, next);
  saveAccountSetting("pictures", next);
  listeners.forEach((l) => l());
}

/** The stop-pictures setting, applied to the page and saved on change. */
export function useStopPictures(): [StopPictures, (next: StopPictures) => void] {
  const value = useSyncExternalStore(subscribe, snapshot, () => "illustrations" as const);
  useEffect(() => {
    applyStopPictures(value, document.documentElement);
  }, [value]);
  return [value, setStopPictures];
}
