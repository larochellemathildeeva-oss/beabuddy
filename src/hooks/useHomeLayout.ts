import { homeLayoutKey } from "@/lib/account-settings";
import { createModuleStore, type ModuleInfo } from "@/hooks/moduleStore";

export type HomeSectionKey =
  | "trip"
  | "stops"
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

/** What Home showed before it had modules, with the stops the mockup's phones show. */
export const DEFAULT_HOME_MODULES: HomeSectionKey[] = [
  "trip",
  "stops",
  "weather",
  "waiting",
  "future",
];

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
  keyFor: homeLayoutKey,
  prefix: "bea-home-layout-",
  modules: HOME_SECTIONS,
  defaults: DEFAULT_HOME_MODULES,
  // The current and next stop sit under the trip's map, wherever it is.
  fixed: ["stops"],
});
