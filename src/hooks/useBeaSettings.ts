import { useSyncExternalStore } from "react";
import {
  cleanSettings,
  DEFAULT_SETTINGS,
  successLine,
  type BeaSettings,
  type SuccessKind,
} from "@/lib/bea-personality";
import { PERSONALITY_KEY } from "@/lib/account-settings";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import { getStored, setStored } from "@/lib/settings-storage";

/** Béa's personality follows the account, like the theme (account-settings.ts). */
export const BEA_SETTINGS_KEY = PERSONALITY_KEY;

const listeners = new Set<() => void>();
let cached: BeaSettings | null = null;

function read(): BeaSettings {
  if (cached) return cached;
  try {
    const raw = getStored(BEA_SETTINGS_KEY);
    cached = raw ? cleanSettings(JSON.parse(raw)) : DEFAULT_SETTINGS;
  } catch {
    cached = DEFAULT_SETTINGS;
  }
  return cached;
}

export function saveBeaSettings(next: BeaSettings): void {
  cached = cleanSettings(next);
  setStored(BEA_SETTINGS_KEY, JSON.stringify(cached));
  saveAccountSetting("personality", JSON.stringify(cached));
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

/**
 * Béa's reaction to something finishing, for a toast's second line — or null
 * (reactions off, a plain mix, or simply not this time). Reads the settings
 * directly, so it can be called from an event handler.
 */
export function beaCheer(kind: SuccessKind): string | null {
  if (typeof window === "undefined") return null;
  const line = successLine({ kind, settings: read(), recent: beaRecent() });
  rememberBeaLine(line);
  return line;
}
