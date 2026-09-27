/**
 * Which painted picture a place gets when the traveller shows illustrations
 * (the default of the three picture settings). One set in `public/places/`,
 * the same in every theme, in the master design's painterly style.
 *
 * Read from what Béa already stores — the category, the timeline kind, the
 * name — never from where the place is: a café in Kyoto and a café in Lisbon
 * get the same café.
 */

export const PLACE_ART = [
  "cafe",
  "restaurant",
  "bar",
  "bakery",
  "market",
  "museum",
  "church",
  "temple",
  "landmark",
  "park",
  "beach",
  "viewpoint",
  "harbour",
  "shop",
  "hotel",
  "station",
  "street",
  "nature",
] as const;
export type PlaceArt = (typeof PLACE_ART)[number];

/** Checked in order: the first kind whose word appears wins. */
const WORDS: [PlaceArt, string[]][] = [
  ["bakery", ["bakery", "boulangerie", "patisserie", "pastry", "panader"]],
  ["cafe", ["cafe", "café", "coffee", "tea house", "teahouse", "espresso", "brunch"]],
  [
    "bar",
    [
      "bar",
      "pub",
      "wine",
      "cocktail",
      "brewery",
      "biergarten",
      "izakaya",
      "nightclub",
      "club",
      "drinks",
    ],
  ],
  [
    "restaurant",
    [
      "restaurant",
      "bistro",
      "brasserie",
      "trattoria",
      "osteria",
      "taverna",
      "food",
      "dinner",
      "lunch",
      "breakfast",
      "meal",
      "eatery",
      "ramen",
      "sushi",
      "pizza",
      "tapas",
    ],
  ],
  ["market", ["market", "mercado", "marché", "bazaar", "souk", "food hall"]],
  ["museum", ["museum", "musée", "museo", "museu", "gallery", "exhibition", "art"]],
  ["temple", ["temple", "shrine", "pagoda", "mosque", "stupa", "wat"]],
  [
    "church",
    [
      "church",
      "cathedral",
      "basilica",
      "chapel",
      "abbey",
      "église",
      "iglesia",
      "chiesa",
      "synagogue",
    ],
  ],
  [
    "landmark",
    [
      "castle",
      "palace",
      "fort",
      "fortress",
      "monument",
      "tower",
      "ruins",
      "landmark",
      "attraction",
      "sight",
      "citadel",
      "château",
    ],
  ],
  ["beach", ["beach", "plage", "playa", "praia", "spiaggia", "bay", "cove", "swim"]],
  [
    "viewpoint",
    ["viewpoint", "lookout", "miradouro", "mirador", "belvedere", "summit", "peak", "view"],
  ],
  [
    "nature",
    [
      "hike",
      "trail",
      "waterfall",
      "forest",
      "lake",
      "mountain",
      "canyon",
      "nature",
      "national park",
      "walk",
    ],
  ],
  ["park", ["park", "garden", "jardin", "jardim", "botanical", "zoo"]],
  ["harbour", ["harbour", "harbor", "port", "marina", "pier", "boat", "ferry", "quay", "wharf"]],
  [
    "station",
    [
      "station",
      "airport",
      "train",
      "flight",
      "bus",
      "transport",
      "transfer",
      "terminal",
      "aerodrome",
    ],
  ],
  [
    "hotel",
    [
      "hotel",
      "hostel",
      "stay",
      "lodging",
      "accommodation",
      "guest house",
      "guesthouse",
      "apartment",
      "airbnb",
      "b&b",
      "resort",
      "ryokan",
      "riad",
      "check-in",
      "check in",
    ],
  ],
  ["shop", ["shop", "store", "boutique", "mall", "shopping", "bookshop", "bookstore", "souvenir"]],
];

function plain(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[_/,.;:()!?"'’-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()} `;
}

/**
 * The picture for a place: its category first, then its kind, then its name,
 * so "Café 23" filed under Restaurant is a restaurant. A place with nothing to
 * go on is a street in an old town.
 */
export function placeArtFor(place: {
  category?: string | null | undefined;
  kind?: string | null | undefined;
  name?: string | null | undefined;
}): PlaceArt {
  for (const source of [place.category, place.kind, place.name]) {
    const text = plain(source ?? "");
    if (text.trim() === "") continue;
    for (const [art, words] of WORDS) {
      if (words.some((word) => text.includes(` ${plain(word).trim()} `))) return art;
    }
  }
  return "street";
}

export function placeArtUrl(art: PlaceArt): string {
  return `/places/${art}.webp`;
}
