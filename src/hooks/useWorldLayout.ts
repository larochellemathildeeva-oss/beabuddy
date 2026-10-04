import { worldLayoutKey } from "@/lib/account-settings";
import { createModuleStore, type ModuleInfo } from "@/hooks/moduleStore";

export type WorldSectionKey =
  "filters" | "card" | "figures" | "add" | "bucket" | "been" | "now" | "notes" | "import" | "lists";

export type WorldLayout = Record<WorldSectionKey, boolean>;

/** What can sit under the globe on the Map view: the mockup's World modules. */
export const WORLD_SECTIONS: ModuleInfo<WorldSectionKey>[] = [
  {
    key: "filters",
    label: "Globe filters",
    hint: "Cities, provinces and states, countries, continents.",
  },
  { key: "card", label: "Place card", hint: "The city you tapped on the globe." },
  {
    key: "figures",
    label: "Your travel stats",
    hint: "Countries, cities, places been and saved, at a glance.",
  },
  { key: "add", label: "Add places", hint: "Paste a list, add one by hand or import a file." },
  { key: "bucket", label: "Bucket list", hint: "The places you want to go." },
  { key: "been", label: "Been there", hint: "Every city you've been to." },
  {
    key: "now",
    label: "Right now there",
    hint: "The time and weather now where your next trip goes.",
  },
  { key: "notes", label: "Notes from Béa", hint: "A line from Béa about your world." },
  {
    key: "import",
    label: "Import your travels",
    hint: "Turn a file of past trips or a saved list into places on your globe.",
  },
  {
    key: "lists",
    label: "Your travel lists",
    hint: "Bucket list, Been there and Next time, as photo tiles.",
  },
];

/** As the mockup's phones show World: the filters, the place card, the stats. */
export const DEFAULT_WORLD_MODULES: WorldSectionKey[] = ["filters", "card", "figures"];

/** Wide modules take a row; the others sit two to a row as cards. */
export const WORLD_SMALL: ReadonlySet<WorldSectionKey> = new Set([
  "add",
  "bucket",
  "been",
  "now",
  "notes",
  "import",
]);

export const useWorldLayout = createModuleStore({
  setting: "worldLayout",
  keyFor: worldLayoutKey,
  prefix: "bea-world-layout-",
  modules: WORLD_SECTIONS,
  defaults: DEFAULT_WORLD_MODULES,
});
