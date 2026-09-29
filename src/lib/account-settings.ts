/**
 * The settings that follow the traveller from one device to the next.
 *
 * Each one is still kept on the device, under the same key as before, so a
 * screen reads it at once and the theme is on before first paint. The account
 * (`profiles.app_settings`) holds a copy: on sign-in the account's copy wins,
 * and a setting the account has never seen is sent up from this device, so
 * whoever set things up on one phone finds them on the next.
 *
 * Values travel as the exact text the device stores, so nothing here needs to
 * know what a layout or a personality looks like; each hook still cleans what
 * it reads. `null` is a setting put back to its default.
 *
 * Not synced, on purpose: the Trip documents lock (a privacy screen for
 * whoever holds this phone), near-me location consent, the Google sign-in
 * choice, the day map's Live/Split layout, the directions boxes (one of them
 * is "keep on this phone"), a trip's travel mode and currency pair, offline
 * copies, and the tour and one-time notices.
 */
import { STOP_PICTURES_KEY } from "./stop-pictures.ts";
import { THEME_KEY } from "./theme.ts";

export const SYNCED_SETTINGS = [
  "theme",
  "personality",
  "pictures",
  "homeLayout",
  "tripView",
  "statsLayout",
  "homeCurrency",
] as const;
export type SyncedSetting = (typeof SYNCED_SETTINGS)[number];

export type AccountSettings = Partial<Record<SyncedSetting, string | null>>;

/** Same key as `BEA_SETTINGS_KEY` in useBeaSettings. */
export const PERSONALITY_KEY = "bea-personality";
export const HOME_CURRENCY_KEY = "bea-home-currency";
export const homeLayoutKey = (uid: string | undefined) => `bea-home-layout-${uid ?? "anon"}`;
export const tripViewKey = (uid: string | undefined) => `bea-trip-view-${uid ?? "anon"}`;
export const statsLayoutKey = (uid: string | undefined) => `bea-stats-layout-${uid ?? "anon"}`;

/** Where this device keeps a synced setting for this traveller. */
export function settingStorageKey(name: SyncedSetting, uid: string): string {
  switch (name) {
    case "theme":
      return THEME_KEY;
    case "personality":
      return PERSONALITY_KEY;
    case "pictures":
      return STOP_PICTURES_KEY;
    case "homeLayout":
      return homeLayoutKey(uid);
    case "tripView":
      return tripViewKey(uid);
    case "statsLayout":
      return statsLayoutKey(uid);
    case "homeCurrency":
      return HOME_CURRENCY_KEY;
  }
}

/** Longer than any real setting; a bigger value is not one of ours. */
export const MAX_SETTING_LENGTH = 4000;

function isSynced(name: string): name is SyncedSetting {
  return (SYNCED_SETTINGS as readonly string[]).includes(name);
}

/** The account's copy, keeping only known settings with sensible values. */
export function cleanAccountSettings(raw: unknown): AccountSettings {
  const out: AccountSettings = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isSynced(name)) continue;
    if (value === null) out[name] = null;
    else if (typeof value === "string" && value.length <= MAX_SETTING_LENGTH) out[name] = value;
  }
  return out;
}

export type SyncPlan = {
  /** Written to this device: text to store, or null to remove. */
  toDevice: AccountSettings;
  /** Sent to the account: set here, never seen there. */
  toAccount: AccountSettings;
};

/**
 * What a sign-in changes. The account wins wherever it has a say, except for
 * settings changed on this device while the account was being read (`busy`),
 * which are on their way up already.
 */
export function planSync(
  account: AccountSettings,
  device: Partial<Record<SyncedSetting, string | null>>,
  busy: ReadonlySet<SyncedSetting> = new Set(),
): SyncPlan {
  const plan: SyncPlan = { toDevice: {}, toAccount: {} };
  for (const name of SYNCED_SETTINGS) {
    if (busy.has(name)) continue;
    const here = device[name] ?? null;
    if (name in account) {
      const there = account[name] ?? null;
      if (there !== here) plan.toDevice[name] = there;
    } else if (here !== null && here.length <= MAX_SETTING_LENGTH) {
      plan.toAccount[name] = here;
    }
  }
  return plan;
}
