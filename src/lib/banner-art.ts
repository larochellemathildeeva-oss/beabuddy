/**
 * The illustrated scenes in `public/banners/`, one per kind of place, painted
 * in the master design's style. One picture serves every theme, as in the
 * master; Dark only dims it (`.art-dim` in styles.css).
 */
export const BANNER_SCENES = [
  "coastal",
  "island",
  "temple",
  "oldtown",
  "mountain",
  "desert",
  "tropical",
  "skyline",
] as const;
export type BannerSceneName = (typeof BANNER_SCENES)[number];

/**
 * Words in a place's name that say which scene suits it. Checked in order, so
 * the more particular kinds (islands, temples) come before the general ones.
 * Whole words only, lower case, accents stripped.
 */
const HINTS: [BannerSceneName, string[]][] = [
  [
    "island",
    [
      "santorini",
      "mykonos",
      "crete",
      "ibiza",
      "mallorca",
      "majorca",
      "capri",
      "sicily",
      "sardinia",
      "corsica",
      "madeira",
      "azores",
      "canary",
      "canaries",
      "tenerife",
      "malta",
      "greece",
      "cyclades",
      "island",
      "islands",
      "isle",
      "iceland",
    ],
  ],
  [
    "tropical",
    [
      "bali",
      "thailand",
      "phuket",
      "maldives",
      "hawaii",
      "honolulu",
      "maui",
      "cancun",
      "tulum",
      "caribbean",
      "jamaica",
      "bahamas",
      "costa rica",
      "fiji",
      "tahiti",
      "seychelles",
      "mauritius",
      "philippines",
      "vietnam",
      "cuba",
      "brazil",
      "rio",
      "puerto rico",
      "dominican",
      "sri lanka",
    ],
  ],
  [
    "temple",
    [
      "japan",
      "tokyo",
      "kyoto",
      "osaka",
      "nara",
      "china",
      "beijing",
      "shanghai",
      "korea",
      "seoul",
      "taiwan",
      "cambodia",
      "angkor",
      "laos",
      "nepal",
      "kathmandu",
      "india",
      "myanmar",
    ],
  ],
  [
    "desert",
    [
      "morocco",
      "marrakech",
      "marrakesh",
      "egypt",
      "cairo",
      "dubai",
      "abu dhabi",
      "jordan",
      "petra",
      "arizona",
      "sedona",
      "nevada",
      "las vegas",
      "utah",
      "sahara",
      "oman",
      "qatar",
      "doha",
      "namibia",
      "atacama",
      "riyadh",
      "saudi",
      "tunisia",
      "palm springs",
    ],
  ],
  [
    "mountain",
    [
      "alps",
      "switzerland",
      "zermatt",
      "interlaken",
      "chamonix",
      "banff",
      "colorado",
      "denver",
      "aspen",
      "dolomites",
      "patagonia",
      "peru",
      "cusco",
      "nepal",
      "himalaya",
      "innsbruck",
      "austria",
      "norway",
      "whistler",
      "andorra",
      "tyrol",
      "pyrenees",
      "mountain",
      "mountains",
      "scotland",
      "highlands",
      "yosemite",
      "montana",
      "chile",
    ],
  ],
  [
    "coastal",
    [
      "lisbon",
      "porto",
      "nice",
      "cannes",
      "marseille",
      "amalfi",
      "positano",
      "cinque terre",
      "barcelona",
      "valencia",
      "malaga",
      "san sebastian",
      "biarritz",
      "algarve",
      "dubrovnik",
      "split",
      "croatia",
      "portugal",
      "riviera",
      "sydney",
      "cape town",
      "san francisco",
      "san diego",
      "vancouver",
      "halifax",
      "brighton",
      "coast",
      "beach",
      "bay",
      "naples",
      "genoa",
      "monaco",
    ],
  ],
  [
    "skyline",
    [
      "new york",
      "nyc",
      "manhattan",
      "chicago",
      "toronto",
      "hong kong",
      "singapore",
      "london",
      "los angeles",
      "miami",
      "seattle",
      "boston",
      "montreal",
      "frankfurt",
      "shenzhen",
      "kuala lumpur",
      "bangkok",
      "melbourne",
      "sao paulo",
      "mexico city",
      "city",
    ],
  ],
  [
    "oldtown",
    [
      "paris",
      "rome",
      "florence",
      "venice",
      "prague",
      "vienna",
      "budapest",
      "krakow",
      "bruges",
      "amsterdam",
      "edinburgh",
      "seville",
      "granada",
      "madrid",
      "quebec",
      "tallinn",
      "riga",
      "vilnius",
      "salzburg",
      "munich",
      "berlin",
      "copenhagen",
      "stockholm",
      "bologna",
      "verona",
      "siena",
      "provence",
      "arles",
      "avignon",
      "lyon",
      "bordeaux",
      "italy",
      "france",
      "spain",
      "germany",
      "belgium",
      "netherlands",
      "czech",
      "poland",
      "hungary",
      "ireland",
      "dublin",
      "england",
    ],
  ],
];

function plain(text: string): string {
  return ` ${text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function hash(seed: string): number {
  let h = 2166136261;
  for (const ch of seed) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Which scene a trip gets: the first kind of place its title, cities or
 * country name, or else one picked from the title so it keeps its picture.
 */
export function bannerSceneFor(
  places: (string | null | undefined)[],
  seed: string,
): BannerSceneName {
  const text = plain(places.filter(Boolean).join(" "));
  for (const [scene, words] of HINTS) {
    if (words.some((word) => text.includes(` ${word} `))) return scene;
  }
  return BANNER_SCENES[hash(seed || "Béa") % BANNER_SCENES.length]!;
}

/** The illustration's path. */
export function bannerArtUrl(scene: BannerSceneName): string {
  return `/banners/${scene}.webp`;
}
