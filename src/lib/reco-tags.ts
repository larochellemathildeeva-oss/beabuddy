import { preferenceGroups } from "../data/atlas.ts";

/** Tags Béa may put on a place — not pace, climate, or who you travel with. */
const PLACE_GROUPS = new Set(["What you travel for", "Food & drink", "Where you stay"]);

export const PLACE_TRAVEL_TAGS = preferenceGroups
  .filter((group) => PLACE_GROUPS.has(group.title))
  .flatMap((group) => group.tags);

const HINTS: Array<{ tag: string; re: RegExp }> = [
  { tag: "Coffee shops", re: /\b(coffee|caf[eé]|espresso|roastery)\b/i },
  { tag: "Bakeries", re: /\b(bakery|bakeries|patisserie|pâtisserie|pastry)\b/i },
  { tag: "Restaurants", re: /\b(restaurant|dining|trattoria|bistro|eatery|kitchen)\b/i },
  { tag: "Street food", re: /\b(street food|food stall|food truck|hawker)\b/i },
  { tag: "Fine dining", re: /\b(fine dining|michelin|tasting menu|omakase)\b/i },
  { tag: "Seafood", re: /\b(seafood|oyster|sushi|pescatarian)\b/i },
  { tag: "Vegetarian", re: /\b(vegetarian|veggie)\b/i },
  { tag: "Vegan", re: /\bvegan\b/i },
  { tag: "Natural wine", re: /\b(natural wine|wine bar|enoteca)\b/i },
  { tag: "Craft beer", re: /\b(craft beer|brewery|taproom|beer hall)\b/i },
  { tag: "Museums", re: /\b(museum|mus[eé]e)\b/i },
  { tag: "Art galleries", re: /\b(galler(y|ies)|art museum|contemporary art)\b/i },
  { tag: "History", re: /\b(historic|history|heritage|castle|ruins|memorial)\b/i },
  { tag: "Architecture", re: /\b(architect|cathedral|basilica|temple|palace)\b/i },
  { tag: "Markets", re: /\b(market|bazaar|souk)\b/i },
  { tag: "Shopping", re: /\b(shopping|boutique|department store|\bmall\b)\b/i },
  { tag: "Nightlife", re: /\b(nightlife|nightclub|club|cocktail bar|speakeasy)\b/i },
  { tag: "Live music", re: /\b(live music|jazz|concert|venue)\b/i },
  { tag: "Beaches", re: /\b(beach|plage|shore|seaside)\b/i },
  { tag: "Hiking", re: /\b(hike|hiking|trail|trek)\b/i },
  { tag: "Wildlife", re: /\b(wildlife|safari|zoo|aquarium|birding)\b/i },
  { tag: "Wellness & spa", re: /\b(spa|wellness|onsen|hammam|thermal)\b/i },
  { tag: "Photography", re: /\b(viewpoint|lookout|photogenic|skyline view)\b/i },
  { tag: "Local experiences", re: /\b(local experience|neighbourhood gem|neighborhood gem|artisan workshop)\b/i },
  { tag: "Gluten free", re: /\bgluten[-\s]?free\b/i },
  { tag: "Halal", re: /\bhalal\b/i },
  { tag: "Kosher", re: /\bkosher\b/i },
  { tag: "Boutique hotels", re: /\b(boutique hotel|design hotel)\b/i },
  { tag: "Hostels", re: /\bhostel\b/i },
  { tag: "Apartments", re: /\b(apartment|airbnb|holiday rental)\b/i },
  { tag: "Resorts", re: /\bresort\b/i },
  { tag: "Camping", re: /\b(camp(ing)?|glamping)\b/i },
];

const CATEGORY_TO_TAG: Record<string, string> = {
  restaurant: "Restaurants",
  food: "Restaurants",
  cafe: "Coffee shops",
  café: "Coffee shops",
  coffee: "Coffee shops",
  bakery: "Bakeries",
  museum: "Museums",
  gallery: "Art galleries",
  art: "Art galleries",
  beach: "Beaches",
  bar: "Nightlife",
  nightlife: "Nightlife",
  hotel: "Boutique hotels",
  lodging: "Boutique hotels",
  shop: "Shopping",
  store: "Shopping",
  market: "Markets",
  spa: "Wellness & spa",
};

export function isMissingTravelTagsColumn(error: { message?: string; code?: string } | null | undefined): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("travel_tags") && (/does not exist|schema cache|could not find/i.test(msg) || error?.code === "PGRST204");
}

export function normalizeTravelTags(tags: string[] | null | undefined): string[] {
  const allowed = new Set(PLACE_TRAVEL_TAGS.map((tag) => tag.toLowerCase()));
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const hit = PLACE_TRAVEL_TAGS.find((tag) => tag.toLowerCase() === raw.trim().toLowerCase());
    if (hit && allowed.has(hit.toLowerCase()) && !out.includes(hit)) out.push(hit);
    if (out.length >= 8) break;
  }
  return out;
}

/** Infer a few travel tags from a place so planning can match the user's interests. */
export type PlaceTagSource = {
  name?: string | null | undefined;
  category?: string | null | undefined;
  notes?: string | null | undefined;
  address?: string | null | undefined;
  travel_tags?: string[] | null | undefined;
};

export function suggestTravelTags(place: PlaceTagSource): string[] {
  const hay = [place.name, place.category, place.notes, place.address].filter(Boolean).join(" ");
  const tags: string[] = [];
  const add = (tag: string) => {
    if (PLACE_TRAVEL_TAGS.includes(tag) && !tags.includes(tag) && tags.length < 4) tags.push(tag);
  };

  const category = (place.category ?? "").trim().toLowerCase();
  if (category && CATEGORY_TO_TAG[category]) add(CATEGORY_TO_TAG[category]);
  const exact = PLACE_TRAVEL_TAGS.find((tag) => tag.toLowerCase() === category);
  if (exact) add(exact);

  for (const hint of HINTS) {
    if (hint.re.test(hay)) add(hint.tag);
  }
  return tags;
}

export function toggleTravelTag(tags: string[], tag: string): string[] {
  if (tags.includes(tag)) return tags.filter((item) => item !== tag);
  if (tags.length >= 8) return tags;
  return [...tags, tag];
}

export function tagsForSave(place: PlaceTagSource): string[] {
  const chosen = normalizeTravelTags(place.travel_tags);
  return chosen.length ? chosen : suggestTravelTags(place);
}
