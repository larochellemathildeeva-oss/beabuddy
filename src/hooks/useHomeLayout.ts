import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { homeLayoutKey } from "@/lib/account-settings";
import { saveAccountSetting } from "@/lib/account-settings-sync";

export type HomeSectionKey = "trip" | "weather" | "waiting" | "future";

export type HomeLayout = Record<HomeSectionKey, boolean>;

export const HOME_SECTIONS: { key: HomeSectionKey; label: string; hint: string }[] = [
  { key: "weather", label: "Weather", hint: "The weather where you are, at a glance." },
  {
    key: "trip",
    label: "Trips",
    hint: "Your current or next trip, what's next up, and the trips after it.",
  },
  {
    key: "waiting",
    label: "Saved places",
    hint: "A saved place within a short walk, or the one waiting for you.",
  },
  { key: "future", label: "Future me note", hint: "The newest note you left for yourself." },
];

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  trip: true,
  weather: true,
  waiting: true,
  future: true,
};

const keyFor = homeLayoutKey;

function read(userId: string | undefined): HomeLayout {
  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_HOME_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<HomeLayout>;
    return { ...DEFAULT_HOME_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_HOME_LAYOUT;
  }
}

/*
 * One layout per account, shared by every screen that shows it. Each caller
 * used to keep its own copy, read once on mount, so a switch flipped under
 * You changed that sheet and nothing else until the page was reloaded.
 */
const listeners = new Set<() => void>();
/** The last layout read per key, with the stored text it came from. */
const cache = new Map<string, { raw: string | null; layout: HomeLayout }>();

function rawFor(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return cache.get(key)?.raw ?? null;
  }
}

/**
 * The same object for as long as the stored text is the same, which is what
 * a store snapshot needs. Checked against storage on every read, so a layout
 * removed from outside (erasing this device's data) reads as the default.
 */
function current(userId: string | undefined): HomeLayout {
  const key = keyFor(userId);
  const raw = rawFor(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.layout;
  const layout = read(userId);
  cache.set(key, { raw, layout });
  return layout;
}

function write(userId: string | undefined, next: HomeLayout | null): void {
  const key = keyFor(userId);
  const raw = next ? JSON.stringify(next) : null;
  try {
    if (raw) window.localStorage.setItem(key, raw);
    else window.localStorage.removeItem(key);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
  cache.set(key, { raw, layout: next ?? DEFAULT_HOME_LAYOUT });
  if (userId) saveAccountSetting("homeLayout", raw);
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("bea-home-layout-")) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useHomeLayout() {
  const { user } = useAuth();
  const userId = user?.id;
  const layout = useSyncExternalStore(
    subscribe,
    () => current(userId),
    () => DEFAULT_HOME_LAYOUT,
  );

  const toggle = useCallback(
    (key: HomeSectionKey) => {
      const prev = current(userId);
      write(userId, { ...prev, [key]: !prev[key] });
    },
    [userId],
  );

  const reset = useCallback(() => write(userId, null), [userId]);

  return { layout, toggle, reset };
}
