import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  DEFAULT_HOME_MODULES,
  HOME_SECTIONS,
  useHomeLayout,
  type HomeSectionKey,
} from "@/hooks/useHomeLayout";
import {
  HOME_NEXT_LAYOUT_PREFIX,
  homeNextLayoutKey,
  isUntouched,
  stateLayout,
  type HomeState,
} from "@/lib/home-next-layout";
import {
  moveModule,
  shownModules,
  toggleModule,
  writeModules,
  type ModuleLayout,
} from "@/lib/module-layout";
import { getStored, setStored } from "@/lib/settings-storage";

const FIXED: ReadonlySet<HomeSectionKey> = new Set(["stops", "suggested"]);
const HOME_KEYS = HOME_SECTIONS.map((m) => m.key);
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(HOME_NEXT_LAYOUT_PREFIX)) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * Home's modules for one trip state, kept on this device per account. The
 * account's Home layout is where each list starts, and is never written
 * here, so the current Home keeps its own.
 */
export function useHomeNextLayout(state: HomeState) {
  const { user } = useAuth();
  const userId = user?.id;
  const { modules: accountLayout, saved } = useHomeLayout();
  // A layout the traveller chose on Home is where each list starts; the app's untouched default is not.
  const account =
    !saved || isUntouched(accountLayout, HOME_KEYS, DEFAULT_HOME_MODULES) ? null : accountLayout;
  const key = homeNextLayoutKey(state, userId);
  const raw = useSyncExternalStore(
    subscribe,
    () => getStored(key),
    () => null,
  );
  const modules = stateLayout(state, raw, account);
  const write = useCallback(
    (next: ModuleLayout<HomeSectionKey> | null) => {
      setStored(key, next ? writeModules(next) : null);
      for (const listener of listeners) listener();
    },
    [key],
  );
  const toggle = useCallback(
    (k: HomeSectionKey) => write(toggleModule(stateLayout(state, getStored(key), account), k)),
    [write, state, key, account],
  );
  const move = useCallback(
    (k: HomeSectionKey, step: -1 | 1) =>
      write(moveModule(stateLayout(state, getStored(key), account), k, step, FIXED)),
    [write, state, key, account],
  );
  const reset = useCallback(() => write(null), [write]);
  return { modules, shown: shownModules(modules), fixed: FIXED, toggle, move, reset };
}
