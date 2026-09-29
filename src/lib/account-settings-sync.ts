import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import {
  cleanAccountSettings,
  planSync,
  settingStorageKey,
  SYNCED_SETTINGS,
  type AccountSettings,
  type SyncedSetting,
} from "@/lib/account-settings";
import { applyStopPictures, asStopPictures } from "@/lib/stop-pictures";
import { applyTheme, isThemeName } from "@/lib/theme";

/*
 * Keeps the settings in account-settings.ts the same on every device the
 * traveller signs in on. The device copy stays the one screens read; this
 * only fills it from the account on sign-in, and sends each change up.
 *
 * Until the app_settings migration is applied, settings stay on the device,
 * as they did before, with one warning in the console.
 */

const COLUMN = ["app_settings"];
const SEND_AFTER_MS = 800;

let uid: string | null = null;
let unavailable = false;
let started = false;
const pending: AccountSettings = {};
let timer: ReturnType<typeof setTimeout> | null = null;

function giveUp(error: { message?: string; code?: string } | null) {
  if (!unavailable) {
    console.warn(
      "Settings stay on this device: the app_settings migration is not applied yet.",
      error?.message,
    );
  }
  unavailable = true;
}

function readDevice(id: string): Partial<Record<SyncedSetting, string | null>> {
  const out: Partial<Record<SyncedSetting, string | null>> = {};
  for (const name of SYNCED_SETTINGS) {
    try {
      out[name] = window.localStorage.getItem(settingStorageKey(name, id));
    } catch {
      out[name] = null;
    }
  }
  return out;
}

/** Stores the account's value here and tells the screens showing it. */
function writeDevice(name: SyncedSetting, id: string, value: string | null) {
  const key = settingStorageKey(name, id);
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* private mode: the account's value is still applied below for this visit */
  }
  if (name === "theme") applyTheme(isThemeName(value) ? value : "calm");
  if (name === "pictures") applyStopPictures(asStopPictures(value), document.documentElement);
  // The same signal another tab's change gives, which every settings hook
  // listens for.
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
}

async function flush() {
  timer = null;
  if (!uid || unavailable) return;
  const patch = { ...pending };
  for (const name of Object.keys(patch)) delete pending[name as SyncedSetting];
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.rpc("merge_app_settings", { patch });
  if (error) {
    if (isMissingColumn(error, COLUMN) || isMissingColumn(error, ["merge_app_settings"])) {
      giveUp(error);
      return;
    }
    // Offline or a blip: try again with the next change, unless it is newer.
    for (const [name, value] of Object.entries(patch)) {
      if (!(name in pending)) pending[name as SyncedSetting] = value;
    }
  }
}

function schedule() {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), SEND_AFTER_MS);
}

/** Sends a changed setting to the account. `null` is a setting reset to its default. */
export function saveAccountSetting(name: SyncedSetting, value: string | null): void {
  if (typeof window === "undefined" || unavailable) return;
  pending[name] = value;
  if (uid) schedule();
}

async function pull(id: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("app_settings")
    .eq("id", id)
    .maybeSingle();
  if (uid !== id) return;
  if (error) {
    if (isMissingColumn(error, COLUMN)) giveUp(error);
    return;
  }
  const busy = new Set(Object.keys(pending) as SyncedSetting[]);
  const plan = planSync(cleanAccountSettings(data?.app_settings), readDevice(id), busy);
  for (const [name, value] of Object.entries(plan.toDevice)) {
    writeDevice(name as SyncedSetting, id, value ?? null);
  }
  for (const [name, value] of Object.entries(plan.toAccount)) {
    pending[name as SyncedSetting] = value ?? null;
  }
  if (Object.keys(pending).length > 0) schedule();
}

function signedIn(id: string | null) {
  if (id === uid) return;
  uid = id;
  // Changes made signed out, or as someone else, are not this account's.
  for (const name of Object.keys(pending)) delete pending[name as SyncedSetting];
  if (id && !unavailable) void pull(id);
}

/** Starts once per page; follows sign-in, sign-out and account switches. */
export function startAccountSettingsSync(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  supabase.auth.onAuthStateChange((_event, session) => {
    signedIn(session?.user?.id ?? null);
  });
  void supabase.auth.getSession().then(({ data }) => signedIn(data.session?.user?.id ?? null));
  // Coming back to Béa after changing something on another device.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && uid && !unavailable) void pull(uid);
  });
}
