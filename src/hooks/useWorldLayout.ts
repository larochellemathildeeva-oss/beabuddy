import { worldLayoutKey } from "@/lib/account-settings";
import { createModuleStore, type ModuleInfo } from "@/hooks/moduleStore";

export type WorldSectionKey =
  "filters" | "card" | "figures" | "add" | "bucket" | "been" | "now" | "notes" | "import" | "lists";

export type WorldLayout = Record<WorldSectionKey, boolean>;

/** What can sit under the map on the Map view: the mockup's World modules. */
export const WORLD_SECTIONS: ModuleInfo<WorldSectionKey>[] = [
  {
    key: "filters",
    label: "Map filters",
    hint: "Cities, provinces and states, countries, continents.",
  },
  { key: "card", label: "Place card", hint: "The city you picked on the globe or in search." },
  {
    key: "figures",
    label: "Your travel stats",
    hint: "Countries and cities, at a glance.",
  },
  { key: "add", label: "Add places", hint: "Paste a list, add one by hand or import a file." },
  { key: "bucket", label: "Bucket list", hint: "The places you want to go." },
  { key: "been", label: "Been there", hint: "Every city you've been to." },
  {
    key: "now",
    label: "Right now there",
    hint: "The time and weather now at a place on your bucket list.",
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
    hint: "Bucket list and Been there, one row each.",
  },
];

/**
 * As the minimalist design draws World: Countries and Cities, then your
 * travel lists. The filters, search and place card are with the globe
 * ("Globe controls and geography"); every module can be added back.
 */
export const DEFAULT_WORLD_MODULES: WorldSectionKey[] = ["figures", "lists"];

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
