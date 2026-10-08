import { normalizeHomeWidgets } from "@/lib/home-widget-grid";
import { homeLayoutKey } from "@/lib/account-settings";
import { createModuleStore, type ModuleInfo } from "@/hooks/moduleStore";

export type HomeSectionKey =
  | "trip"
  | "stops"
  | "suggested"
  | "saved"
  | "now"
  | "group"
  | "tools"
  | "weatherThere"
  | "detour"
  | "notes"
  | "weather"
  | "waiting"
  | "future";

export type HomeLayout = Record<HomeSectionKey, boolean>;

/**
 * Home's modules: the mockup's "Customizable trip home" (the trip ones show
 * while a trip is under way or ahead), and the ones Home always had.
 */
export const HOME_SECTIONS: ModuleInfo<HomeSectionKey>[] = [
  {
    key: "trip",
    label: "Trips",
    hint: "Your current or next trip at the top, and the trips after it.",
  },
  { key: "stops", label: "Current / Next stop", hint: "On a trip: where you are and what's next." },
  {
    key: "suggested",
    label: "Suggested for your trip",
    hint: "Ideas for the town you are in: landmarks, cafés, day trips.",
  },
  { key: "saved", label: "Saved for this trip", hint: "Places you saved in the trip's cities." },
  { key: "now", label: "Right now there", hint: "The time now where the trip is." },
  { key: "group", label: "Group plans", hint: "Who's coming, and inviting someone." },
  { key: "tools", label: "Trip tools", hint: "Currency, transport, translate, offline." },
  { key: "weatherThere", label: "Weather there", hint: "Today's weather where the trip is." },
  {
    key: "detour",
    label: "Worth a detour",
    hint: "A place you saved near the trip that isn't in the plan yet.",
  },
  { key: "notes", label: "Notes from Béa", hint: "A line from Béa about the trip." },
  { key: "weather", label: "Weather here", hint: "The weather where you are, at a glance." },
  {
    key: "waiting",
    label: "Saved places",
    hint: "A saved place within a short walk, or the one waiting for you.",
  },
  { key: "future", label: "Future me note", hint: "The newest note you left for yourself." },
];

/**
 * With a trip ahead, as the minimalist design draws Home: the trip, Places
 * saved and Travellers side by side, Weather there, Notes from Béa (and the
 * current and next stop once it is under way). With none, the weather here,
 * the saved places waiting and the newest note, as before. The others are a
 * tap away in Customize home.
 */
export const DEFAULT_HOME_MODULES: HomeSectionKey[] = [
  "trip",
  "stops",
  "saved",
  "group",
  "weatherThere",
  "notes",
  "weather",
  "waiting",
  "future",
];

/** Default modules for Home with no trip: left out while one is ahead, unless chosen. */
export const NO_TRIP_DEFAULTS: ReadonlySet<HomeSectionKey> = new Set([
  "weather",
  "waiting",
  "future",
]);

/**
 * Whether Home has no trip ahead, once the trips have loaded. Until then the
 * defaults are the trip ones, so nothing appears and then goes again.
 */
let noTripKnown = false;

/** The defaults for this moment: without the no-trip modules while a trip may be ahead. */
export function homeDefaultsNow(noTrip: boolean): HomeSectionKey[] {
  return noTrip
    ? DEFAULT_HOME_MODULES
    : DEFAULT_HOME_MODULES.filter((k) => !NO_TRIP_DEFAULTS.has(k));
}

/** Wide modules take a row; the others sit two to a row as cards. */
export const HOME_SMALL: ReadonlySet<HomeSectionKey> = new Set([
  "saved",
  "now",
  "group",
  "tools",
  "weatherThere",
  "detour",
  "notes",
]);

export const useHomeLayout = createModuleStore({
  setting: "homeLayout",
  normalize: normalizeHomeWidgets,
  keyFor: homeLayoutKey,
  prefix: "bea-home-layout-",
  modules: HOME_SECTIONS,
  defaults: DEFAULT_HOME_MODULES,
  // The current and next stop sit under the trip's map, wherever it is.
  fixed: [],
  // Home already showed it before it could be switched off.
  newOn: ["suggested"],
  defaultsNow: () => homeDefaultsNow(noTripKnown),
});

/** Home reports, once its trips have loaded, whether there is no trip ahead. */
export function setHomeNoTrip(noTrip: boolean): void {
  if (noTrip === noTripKnown) return;
  noTripKnown = noTrip;
  useHomeLayout.refresh();
}
