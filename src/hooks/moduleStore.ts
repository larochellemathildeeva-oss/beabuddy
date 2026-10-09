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
  type WidgetSize,
} from "@/lib/module-layout";
import { getStored, setStored } from "@/lib/settings-storage";

export type ModuleInfo<K extends string> = { key: K; label: string; hint: string };

/**
 * One screen's modules, per account, shared by every component that shows
 * them: a switch flipped under You changes Home at once, without a reload.
 */
export function createModuleStore<K extends string>(config: {
  normalize?: (layout: ModuleLayout<K>) => ModuleLayout<K>;
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
  /**
   * The defaults right now, when they depend on the moment (Home with or
   * without a trip). Read whenever nothing is saved, so Customize shows them
   * and the first change starts from them.
   */
  defaultsNow?: (userId: string | undefined) => readonly K[];
}) {
  const fixed: ReadonlySet<K> = new Set(config.fixed ?? []);
  const keys = config.modules.map((m) => m.key);
  const normalize = config.normalize ?? ((layout: ModuleLayout<K>) => layout);
  const defaultsNow = (userId: string | undefined) =>
    config.defaultsNow?.(userId) ?? config.defaults;
  const fallbacks = new Map<string, ModuleLayout<K>>();
  /** The default layout for now, the same object each time it is asked. */
  const fallbackNow = (userId: string | undefined): ModuleLayout<K> => {
    const list = defaultsNow(userId);
    const sig = list.join(",");
    let hit = fallbacks.get(sig);
    if (!hit) {
      hit = normalize(defaultModules(keys, list));
      fallbacks.set(sig, hit);
    }
    return hit;
  };
  const fallback = normalize(defaultModules(keys, config.defaults));
  const listeners = new Set<() => void>();
  const cache = new Map<string, { raw: string | null; layout: ModuleLayout<K> }>();

  function current(userId: string | undefined): ModuleLayout<K> {
    const key = config.keyFor(userId);
    const raw = getStored(key);
    if (raw === null) return fallbackNow(userId);
    const hit = cache.get(key);
    if (hit && hit.raw === raw) return hit.layout;
    const layout = normalize(readModules(raw, keys, config.defaults, config.newOn));
    cache.set(key, { raw, layout });
    return layout;
  }

  function write(userId: string | undefined, next: ModuleLayout<K> | null): void {
    const key = config.keyFor(userId);
    const raw = next ? writeModules(next) : null;
    setStored(key, raw);
    if (next) cache.set(key, { raw, layout: next });
    if (userId) saveAccountSetting(config.setting, raw);
    notify();
  }

  function notify(): void {
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

  /** Tell every screen the defaults may have changed (`defaultsNow`). */
  useModules.refresh = notify;
  return useModules;

  function useModules() {
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
    const resize = useCallback(
      (key: K, size: WidgetSize) => {
        const layout = current(userId);
        write(userId, normalize({ ...layout, sizes: { ...layout.sizes, [key]: size } }));
      },
      [userId],
    );
    const reorder = useCallback(
      (active: K, over: K) => {
        const layout = current(userId);
        const order = [...layout.order];
        const from = order.indexOf(active);
        const to = order.indexOf(over);
        if (from < 0 || to < 0 || from === to) return;
        order.splice(from, 1);
        order.splice(to, 0, active);
        write(userId, { ...layout, order });
      },
      [userId],
    );
    const reset = useCallback(() => write(userId, null), [userId]);
    // Whether this account has a layout of its own on this phone, or the defaults.
    const saved = useSyncExternalStore(
      subscribe,
      () => getStored(config.keyFor(userId)) !== null,
      () => false,
    );
    const layout = Object.fromEntries(keys.map((k) => [k, modules.on.has(k)])) as Record<
      K,
      boolean
    >;
    return {
      layout,
      modules,
      shown: shownModules(modules),
      saved,
      fixed,
      toggle,
      move,
      reset,
      resize,
      reorder,
    };
  }
}
