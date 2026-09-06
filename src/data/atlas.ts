export type PinType = "visited" | "nexttime" | "wishlist" | "reco";

export type Pin = {
  id: string;
  type: PinType;
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  category?: string;
  notes?: string;
  dateVisited?: string;
  dateAdded?: string;
  rating?: number;
  wouldReturn?: boolean;
  priority?: "High" | "Medium" | "Low";
  recommendedBy?: string;
  source?: string;
  /** Reco row marked visited — not the same as pin type "visited". */
  visited?: boolean;
  distanceM?: number;
};

export type CityMemory = {
  slug: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  visits: number;
  days: number;
  photos: number;
  lastTrip: string;
};

/** Interest chips offered on the profile screen — options, not saved data. */
export const preferenceOptions = [
  "Coffee shops",
  "Museums",
  "Local experiences",
  "Hiking",
  "Restaurants",
  "Beaches",
];

/**
 * Deeper preference tags grouped by theme. Selections are stored in the same
 * `profiles.preferences` array as the simple interest chips.
 */
export const preferenceGroups: { title: string; hint: string; tags: string[] }[] = [
  {
    title: "What you travel for",
    hint: "The reason you go.",
    tags: [
      "Coffee shops",
      "Museums",
      "Local experiences",
      "Hiking",
      "Restaurants",
      "Beaches",
      "Nightlife",
      "Live music",
      "Architecture",
      "Markets",
      "Shopping",
      "Wildlife",
      "Photography",
      "History",
      "Art galleries",
      "Wellness & spa",
    ],
  },
  {
    title: "Your pace",
    hint: "How full a day should feel.",
    tags: ["Slow mornings", "Packed days", "One thing a day", "Spontaneous", "Planned to the hour"],
  },
  {
    title: "Food & drink",
    hint: "So Béa suggests places you'd actually eat at.",
    tags: [
      "Street food",
      "Fine dining",
      "Vegetarian",
      "Vegan",
      "Gluten free",
      "Halal",
      "Kosher",
      "Seafood",
      "Natural wine",
      "Craft beer",
      "No alcohol",
      "Bakeries",
    ],
  },
  {
    title: "Where you stay",
    hint: "The kind of place you book.",
    tags: ["Boutique hotels", "Hostels", "Apartments", "Family stays", "Camping", "Resorts", "Central", "Quiet streets"],
  },
  {
    title: "Budget",
    hint: "How much you like to spend.",
    tags: ["Shoestring", "Comfortable", "Treat yourself", "Splurge on food", "Splurge on stays"],
  },
  {
    title: "Who you travel with",
    hint: "Changes what Béa recommends.",
    tags: ["Solo", "Partner", "Friends", "Kids", "Family", "Work"],
  },
  {
    title: "Getting around",
    hint: "How you like to move.",
    tags: ["Walk everywhere", "Public transport", "Rent a car", "Cycling", "Trains over planes", "Step-free access"],
  },
  {
    title: "Climate",
    hint: "The weather you're happiest in.",
    tags: ["Hot & sunny", "Mild", "Cold & snowy", "Avoid humidity", "Shoulder season"],
  },
];


export const pinLabel: Record<PinType, string> = {
  visited: "Visited",
  nexttime: "Next time",
  wishlist: "Wishlist",
  reco: "Recommendation",
};

export const pinColorClass: Record<PinType, string> = {
  visited: "bg-visited",
  nexttime: "bg-nexttime",
  wishlist: "bg-wishlist",
  reco: "bg-reco",
};

export const pinTextClass: Record<PinType, string> = {
  visited: "text-visited",
  nexttime: "text-nexttime",
  wishlist: "text-wishlist",
  reco: "text-reco",
};

export function formatDistance(m?: number) {
  if (m == null) return "";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
}
