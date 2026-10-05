/**
 * Home's modules, one list per trip state (owner decision: "Home and the
 * trip page: customizable modules, separate lists per trip state"). Which
 * modules each state can show, its starting order, and the device key each
 * list is kept under. The account's Home layout (`homeLayout`) stays the
 * starting point, so nothing a traveller already chose is lost.
 *
 * Pure, so it is tested; `useHomeNextLayout` keeps the lists.
 */
import type { HomeSectionKey } from "../hooks/useHomeLayout.ts";
import { defaultModules, readModules, type ModuleLayout } from "./module-layout.ts";

export const HOME_STATES = ["upcoming", "ontrip", "none"] as const;
export type HomeState = (typeof HOME_STATES)[number];

export const HOME_STATE_LABEL: Record<HomeState, string> = {
  upcoming: "Upcoming trip",
  ontrip: "On a trip",
  none: "No trip",
};

/** The trip modules: drawn only while there is a trip ahead or under way. */
const TRIP_MODULES: readonly HomeSectionKey[] = [
  "saved",
  "now",
  "group",
  "tools",
  "weatherThere",
  "detour",
  "notes",
];

/** What each state can show. "stops" is the Current / Next stop pair under the on-trip map. */
export const STATE_MODULES: Record<HomeState, readonly HomeSectionKey[]> = {
  ontrip: ["stops", "trip", ...TRIP_MODULES, "weather", "waiting", "future"],
  upcoming: ["trip", ...TRIP_MODULES, "weather", "waiting", "future"],
  none: ["trip", "weather", "waiting", "future"],
};

/**
 * Each state's first list, from the mockup's DEFAULTS (Right now there on a
 * trip, Saved for this trip before one, the saved places and Future me with
 * none), with what Home always showed.
 */
export const STATE_DEFAULTS: Record<HomeState, readonly HomeSectionKey[]> = {
  ontrip: ["stops", "now", "trip", "weather", "waiting", "future"],
  upcoming: ["saved", "trip", "weather", "waiting", "future"],
  none: ["waiting", "trip", "future"],
};

/** Kept on this device, per account, per state. */
export const homeNextLayoutKey = (state: HomeState, uid: string | undefined) =>
  `bea-home-next-layout-${state}-${uid ?? "anon"}`;

export const HOME_NEXT_LAYOUT_PREFIX = "bea-home-next-layout-";

/**
 * A state's list: its own when one was saved on this device, else the
 * account's Home layout (what Home shows today) narrowed to the state's
 * modules, else the state's defaults.
 */
export function stateLayout(
  state: HomeState,
  raw: string | null,
  account: ModuleLayout<HomeSectionKey> | null,
): ModuleLayout<HomeSectionKey> {
  const keys = STATE_MODULES[state];
  if (raw) return readModules(raw, keys, STATE_DEFAULTS[state]);
  if (account && account.on.size > 0) {
    const order = account.order.filter((k) => keys.includes(k));
    for (const k of keys) if (!order.includes(k)) order.push(k);
    const on = new Set(order.filter((k) => account.on.has(k)));
    // The pair of stop cards always shows on a trip unless switched off here.
    if (state === "ontrip" && !raw) on.add("stops");
    return { order, on };
  }
  return defaultModules(keys, STATE_DEFAULTS[state]);
}

/**
 * True when an account layout is still the app's own default (never
 * customized): each state then starts from its own defaults instead.
 */
export function isUntouched(
  account: ModuleLayout<HomeSectionKey>,
  keys: readonly HomeSectionKey[],
  defaults: readonly HomeSectionKey[],
): boolean {
  const base = defaultModules(keys, defaults);
  const order = account.order.join(",") === base.order.join(",");
  const on = account.on.size === base.on.size && [...base.on].every((k) => account.on.has(k));
  return order && on;
}

/** Which state Home is in. */
export function homeState(trip: unknown, underway: boolean): HomeState {
  if (!trip) return "none";
  return underway ? "ontrip" : "upcoming";
}
