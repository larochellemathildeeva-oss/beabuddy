import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import { worldLayoutKey } from "@/lib/account-settings";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import { getStored, setStored } from "@/lib/settings-storage";

export type WorldSectionKey = "filters" | "card" | "figures" | "add" | "lists";

export type WorldLayout = Record<WorldSectionKey, boolean>;

/** What sits under the globe on the Map view. */
export const WORLD_SECTIONS: { key: WorldSectionKey; label: string; hint: string }[] = [
  {
    key: "filters",
    label: "Globe filters",
    hint: "Cities, provinces and states, countries, continents.",
  },
  { key: "card", label: "Place card", hint: "The city you tapped on the globe." },
  {
    key: "figures",
    label: "Travel figures",
    hint: "Places, countries, trips and saved places at a glance.",
  },
  { key: "add", label: "Add places", hint: "Paste a list, add by hand or import a file." },
  {
    key: "lists",
    label: "Your travel lists",
    hint: "Bucket list, Been there and Next time, as photo tiles.",
  },
];

export const DEFAULT_WORLD_LAYOUT: WorldLayout = {
  filters: true,
  card: true,
  figures: true,
  add: true,
  lists: false,
};

const keyFor = worldLayoutKey;

function read(userId: string | undefined): WorldLayout {
  try {
    const raw = getStored(keyFor(userId));
    if (!raw) return DEFAULT_WORLD_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<WorldLayout>;
    return { ...DEFAULT_WORLD_LAYOUT, ...parsed };
  } catch {
    return DEFAULT_WORLD_LAYOUT;
  }
}

/*
 * One layout per account, shared by every screen that shows it. Each caller
 * used to keep its own copy, read once on mount, so a switch flipped under
 * You changed that sheet and nothing else until the page was reloaded.
 */
const listeners = new Set<() => void>();
/** The last layout read per key, with the stored text it came from. */
const cache = new Map<string, { raw: string | null; layout: WorldLayout }>();

function rawFor(key: string): string | null {
  return getStored(key);
}

/**
 * The same object for as long as the stored text is the same, which is what
 * a store snapshot needs. Checked against storage on every read, so a layout
 * removed from outside (erasing this device's data) reads as the default.
 */
function current(userId: string | undefined): WorldLayout {
  const key = keyFor(userId);
  const raw = rawFor(key);
  const hit = cache.get(key);
  if (hit && hit.raw === raw) return hit.layout;
  const layout = read(userId);
  cache.set(key, { raw, layout });
  return layout;
}

function write(userId: string | undefined, next: WorldLayout | null): void {
  const key = keyFor(userId);
  const raw = next ? JSON.stringify(next) : null;
  setStored(key, raw);
  cache.set(key, { raw, layout: next ?? DEFAULT_WORLD_LAYOUT });
  if (userId) saveAccountSetting("worldLayout", raw);
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith("bea-world-layout-")) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useWorldLayout() {
  const { user } = useAuth();
  const userId = user?.id;
  const layout = useSyncExternalStore(
    subscribe,
    () => current(userId),
    () => DEFAULT_WORLD_LAYOUT,
  );

  const toggle = useCallback(
    (key: WorldSectionKey) => {
      const prev = current(userId);
      write(userId, { ...prev, [key]: !prev[key] });
    },
    [userId],
  );

  const reset = useCallback(() => write(userId, null), [userId]);

  return { layout, toggle, reset };
}
