import { daysSince, formatMetres, haversine, isLatLon, type LatLon } from "./geo.ts";

export type PlaceForCompare = {
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  kind: string;
  notes: string | null;
  lat: number | null;
  lon: number | null;
  recommendedBy: string | null;
  dateAdded: string | null;
  source: string | null;
  alreadyBeen: boolean;
};

export type PairwiseFact = {
  a: string;
  b: string;
  metres: number;
};

export type PlaceFact = {
  name: string;
  daysSinceSaved: number | null;
  recommendedBy: string | null;
  source: string | null;
  alreadyBeen: boolean;
  metresFromHome: number | null;
};

export type CompareFacts = {
  places: PlaceFact[];
  pairs: PairwiseFact[];
  homeCity: string | null;
  homeGeocoded: boolean;
  month: string | null;
};

export function buildCompareFacts(
  places: PlaceForCompare[],
  home: { city: string | null; coords: LatLon | null },
  month: string | null,
  now = new Date(),
): CompareFacts {
  const withCoords = places.filter(isLatLon);

  const pairs: PairwiseFact[] = [];
  for (let i = 0; i < withCoords.length; i++) {
    for (let j = i + 1; j < withCoords.length; j++) {
      const a = withCoords[i]!;
      const b = withCoords[j]!;
      pairs.push({
        a: a.name,
        b: b.name,
        metres: Math.round(haversine(a, b)),
      });
    }
  }

  return {
    homeCity: home.city,
    homeGeocoded: home.coords != null,
    month,
    pairs,
    places: places.map((place) => ({
      name: place.name,
      daysSinceSaved: place.dateAdded ? daysSince(place.dateAdded, now) : null,
      recommendedBy: place.recommendedBy,
      source: place.source,
      alreadyBeen: place.alreadyBeen,
      metresFromHome: home.coords && isLatLon(place) ? Math.round(haversine(home.coords, place)) : null,
    })),
  };
}

export function factsPrompt(facts: CompareFacts): string {
  const lines: string[] = [
    "Computed facts — use these numbers. Do not invent or override a distance or date. If a fact is missing, do not guess a number for it.",
  ];

  if (facts.month) lines.push(`Traveller would go around ${facts.month}.`);

  for (const pair of facts.pairs) {
    lines.push(`${pair.a} is ${formatMetres(pair.metres)} from ${pair.b} (straight-line).`);
  }

  for (const place of facts.places) {
    const bits: string[] = [place.name];
    if (place.daysSinceSaved != null) {
      bits.push(
        place.daysSinceSaved === 0 ? "saved today" : `saved ${place.daysSinceSaved} days ago`,
      );
    }
    if (place.recommendedBy) bits.push(`saved by ${place.recommendedBy}`);
    if (place.source) bits.push(`source: ${place.source}`);
    bits.push(place.alreadyBeen ? "already been" : "not visited yet");
    if (place.metresFromHome != null && facts.homeCity) {
      bits.push(`${formatMetres(place.metresFromHome)} from home (${facts.homeCity})`);
    }
    lines.push(bits.join(" · "));
  }

  if (facts.homeCity && !facts.homeGeocoded) {
    lines.push(`Home city is ${facts.homeCity}, but it could not be located — omit distance from home.`);
  }

  if (!facts.pairs.length) {
    lines.push("No coordinates were available, so distances between places are unknown — omit them.");
  }

  return lines.join("\n");
}
