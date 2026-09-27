import { useSyncExternalStore } from "react";
import { cleanSettings, DEFAULT_SETTINGS, type BeaSettings } from "@/lib/bea-personality";

/** Béa's personality lives on the device, like the theme: a preference, not account data. */
export const BEA_SETTINGS_KEY = "bea-personality";

const listeners = new Set<() => void>();
let cached: BeaSettings | null = null;

function read(): BeaSettings {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(BEA_SETTINGS_KEY);
    cached = raw ? cleanSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}

export function saveBeaSettings(next: BeaSettings): void {
  cached = cleanSettings(next);
  try {
    window.localStorage.setItem(BEA_SETTINGS_KEY, JSON.stringify(cached));
  } catch {
    /* private mode: kept for this visit */
  }
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === BEA_SETTINGS_KEY) {
      cached = null;
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** The traveller's Béa, the same on every screen, updated as soon as it changes. */
export function useBeaSettings(): BeaSettings {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_SETTINGS);
}

/**
 * What Béa said most recently, across every screen this visit, so no line
 * comes back while it is still fresh in mind.
 */
const recentLines: string[] = [];
export function beaRecent(): readonly string[] {
  return recentLines;
}
export function rememberBeaLine(line: string | null | undefined): void {
  if (!line) return;
  recentLines.push(line);
  if (recentLines.length > 12) recentLines.shift();
}
