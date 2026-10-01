import { supabase } from "@/integrations/supabase/client";
import { isMissingColumn } from "@/lib/bookings";
import {
  cleanAccountSettings,
  ownsDeviceSettings,
  planSync,
  SETTINGS_OWNER_KEY,
  settingStorageKey,
  SYNCED_SETTINGS,
  type AccountSettings,
  type SyncedSetting,
} from "@/lib/account-settings";
import { getStored, setStored } from "@/lib/settings-storage";
import { ACCESSIBILITY_KEY, applyAccessibility, parseAccessibility } from "@/lib/accessibility";
import { applyStopPictures, asStopPictures, STOP_PICTURES_KEY } from "@/lib/stop-pictures";
import { applyTheme, DEFAULT_THEME, isThemeName, THEME_KEY, type ThemeName } from "@/lib/theme";

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
/** Waits between tries after a failed save: offline, or a blip. */
const RETRY_MS = [5_000, 20_000, 60_000, 300_000];

let uid: string | null = null;
let unavailable = false;
let started = false;
/** Changes not yet sent, all for `uid`. */
const pending: AccountSettings = {};
/** Changes on their way to the account right now. */
const sending = new Set<SyncedSetting>();
/** Counts changes made here, so a read can tell which came after it started. */
let edits = 0;
const editedAt = new Map<SyncedSetting, number>();
let timer: ReturnType<typeof setTimeout> | null = null;
let failures = 0;

function giveUp(error: { message?: string; code?: string } | null) {
  if (!unavailable) {
    console.warn(
      "Settings stay on this device: the app_settings migration is not applied yet.",
      error?.message,
    );
  }
  unavailable = true;
}

function clearPending() {
  for (const name of Object.keys(pending)) delete pending[name as SyncedSetting];
  if (timer) clearTimeout(timer);
  timer = null;
  failures = 0;
}

function readDevice(id: string): Partial<Record<SyncedSetting, string | null>> {
  const out: Partial<Record<SyncedSetting, string | null>> = {};
  for (const name of SYNCED_SETTINGS) out[name] = getStored(settingStorageKey(name, id));
  return out;
}

function themeFrom(value: string | null): ThemeName {
  return isThemeName(value) ? value : DEFAULT_THEME;
}

/** Stores the account's value here and tells the screens showing it. */
function writeDevice(name: SyncedSetting, id: string, value: string | null) {
  const key = settingStorageKey(name, id);
  setStored(key, value);
  if (name === "theme") applyTheme(themeFrom(value));
  if (name === "pictures") applyStopPictures(asStopPictures(value), document.documentElement);
  if (name === "accessibility") {
    applyAccessibility(parseAccessibility(value), document.documentElement);
  }
  // The same signal another tab's change gives, which every settings hook
  // listens for.
  window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
}

async function flush() {
  timer = null;
  const id = uid;
  if (!id || unavailable) return;
  const patch = { ...pending };
  const names = Object.keys(patch) as SyncedSetting[];
  if (names.length === 0) return;
  for (const name of names) {
    delete pending[name];
    sending.add(name);
  }
  const { error } = await supabase.rpc("merge_app_settings", { patch });
  for (const name of names) sending.delete(name);
  // Signed out or switched while it was sent: nothing of it is the new
  // account's, whatever happened.
  if (uid !== id) return;
  if (!error) {
    failures = 0;
    if (Object.keys(pending).length > 0) schedule();
    return;
  }
  if (isMissingColumn(error, COLUMN) || isMissingColumn(error, ["merge_app_settings"])) {
    giveUp(error);
    return;
  }
  // Offline or a blip: keep it, unless there is a newer change, and try again.
  for (const name of names) {
    if (!(name in pending)) pending[name] = patch[name] ?? null;
  }
  schedule(RETRY_MS[Math.min(failures, RETRY_MS.length - 1)]);
  failures += 1;
}

function schedule(delay = SEND_AFTER_MS) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void flush(), delay);
}

/** Sends a changed setting to the account. `null` is a setting reset to its default. */
export function saveAccountSetting(name: SyncedSetting, value: string | null): void {
  if (typeof window === "undefined" || unavailable || !uid) return;
  edits += 1;
  editedAt.set(name, edits);
  pending[name] = value;
  // A change here makes the device-wide settings this account's.
  setStored(SETTINGS_OWNER_KEY, uid);
  schedule();
}

async function pull(id: string) {
  const startedAt = edits;
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
  // Left alone: anything changed here since this read began, waiting to be
  // sent, or being sent now. Their own save carries them.
  const busy = new Set<SyncedSetting>([
    ...(Object.keys(pending) as SyncedSetting[]),
    ...sending,
    ...SYNCED_SETTINGS.filter((name) => (editedAt.get(name) ?? 0) > startedAt),
  ]);
  const owns = ownsDeviceSettings(getStored(SETTINGS_OWNER_KEY), id);
  const plan = planSync(cleanAccountSettings(data?.app_settings), readDevice(id), busy, owns);
  for (const [name, value] of Object.entries(plan.toDevice)) {
    writeDevice(name as SyncedSetting, id, value ?? null);
  }
  setStored(SETTINGS_OWNER_KEY, id);
  for (const [name, value] of Object.entries(plan.toAccount)) {
    pending[name as SyncedSetting] = value ?? null;
  }
  if (Object.keys(pending).length > 0) schedule();
}

function signedIn(id: string | null) {
  if (id === uid) return;
  uid = id;
  // Changes made signed out, or as someone else, are not this account's.
  clearPending();
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
  // Coming back to Béa after changing something on another device, or back
  // online with a change still to send.
  const resume = () => {
    if (!uid || unavailable) return;
    if (Object.keys(pending).length > 0) schedule();
    void pull(uid);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") resume();
  });
  window.addEventListener("online", resume);
  // A theme, pictures or reading choice made in another tab: paint this one too, not
  // only the picker.
  window.addEventListener("storage", (e) => {
    if (e.key === THEME_KEY) {
      const theme = themeFrom(e.newValue);
      document.documentElement.setAttribute("data-theme", theme);
      document.documentElement.classList.toggle("dark", theme === "dark");
    } else if (e.key === STOP_PICTURES_KEY) {
      applyStopPictures(asStopPictures(e.newValue), document.documentElement);
    } else if (e.key === ACCESSIBILITY_KEY) {
      applyAccessibility(parseAccessibility(e.newValue), document.documentElement);
    }
  });
}
