import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import type { SyncedSetting } from "@/lib/account-settings";
import { saveAccountSetting } from "@/lib/account-settings-sync";
import {
  defaultModules,
  moveModule,
  readModules,
  shownModules,
  toggleModule,
  writeModules,
  type ModuleLayout,
} from "@/lib/module-layout";
import { getStored, setStored } from "@/lib/settings-storage";

export type ModuleInfo<K extends string> = { key: K; label: string; hint: string };

/**
 * One screen's modules, per account, shared by every component that shows
 * them: a switch flipped under You changes Home at once, without a reload.
 */
export function createModuleStore<K extends string>(config: {
  setting: SyncedSetting;
  keyFor: (uid: string | undefined) => string;
  /** Prefix of `keyFor`'s keys, so a change in another tab is heard. */
  prefix: string;
  modules: readonly ModuleInfo<K>[];
  defaults: readonly K[];
  /** Modules drawn in a fixed place: a switch, but no arrows. */
  fixed?: readonly K[];
  /** Modules a layout saved before they existed gets switched on. */
  newOn?: readonly K[];
}) {
  const fixed: ReadonlySet<K> = new Set(config.fixed ?? []);
  const keys = config.modules.map((m) => m.key);
  const fallback = defaultModules(keys, config.defaults);
  const listeners = new Set<() => void>();
  const cache = new Map<string, { raw: string | null; layout: ModuleLayout<K> }>();

  function current(userId: string | undefined): ModuleLayout<K> {
    const key = config.keyFor(userId);
    const raw = getStored(key);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.layout;
    const layout = readModules(raw, keys, config.defaults, config.newOn);
    cache.set(key, { raw, layout });
    return layout;
  }

  function write(userId: string | undefined, next: ModuleLayout<K> | null): void {
    const key = config.keyFor(userId);
    const raw = next ? writeModules(next) : null;
    setStored(key, raw);
    cache.set(key, { raw, layout: next ?? fallback });
    if (userId) saveAccountSetting(config.setting, raw);
    for (const listener of listeners) listener();
  }

  function subscribe(onChange: () => void): () => void {
    listeners.add(onChange);
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key.startsWith(config.prefix)) onChange();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(onChange);
      window.removeEventListener("storage", onStorage);
    };
  }

  return function useModules() {
    const { user } = useAuth();
    const userId = user?.id;
    const modules = useSyncExternalStore(
      subscribe,
      () => current(userId),
      () => fallback,
    );
    const toggle = useCallback(
      (key: K) => write(userId, toggleModule(current(userId), key)),
      [userId],
    );
    const move = useCallback(
      (key: K, step: -1 | 1) => write(userId, moveModule(current(userId), key, step, fixed)),
      [userId],
    );
    const reset = useCallback(() => write(userId, null), [userId]);
    const layout = Object.fromEntries(keys.map((k) => [k, modules.on.has(k)])) as Record<
      K,
      boolean
    >;
    return { layout, modules, shown: shownModules(modules), fixed, toggle, move, reset };
  };
}
