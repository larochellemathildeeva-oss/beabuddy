// Real places, where they are, and how far off still counts as found.
// `mode`: "recs-here" = Recs with location on (at = the city centre),
// "recs" = Recs with no location, "destination" = a trip's destination field.
const MTL = { lat: 45.5017, lon: -73.5673 };
const TYO = { lat: 35.6812, lon: 139.7671 };
const HIJ = { lat: 34.3963, lon: 132.4596 };
const MIY = { lat: 34.2975, lon: 132.3219 };

export const CASES = [
  { query: "Olive et Gourmando", at: MTL, want: { lat: 45.5016, lon: -73.555 }, km: 1.5 },
  { query: "Schwartz's", at: MTL, want: { lat: 45.5165, lon: -73.5779 }, km: 1.5 },
  { query: "St-Viateur Bagel", at: MTL, want: { lat: 45.5227, lon: -73.6026 }, km: 1.5 },
  { query: "Fairmount Bagel", at: MTL, want: { lat: 45.5227, lon: -73.5981 }, km: 1.5 },
  { query: "Café Olimpico", at: MTL, want: { lat: 45.523, lon: -73.6024 }, km: 1.5 },
  { query: "BeaverTails", at: MTL, want: { lat: 45.5065, lon: -73.552 }, km: 2 },
  { query: "subway", at: MTL, near: true, km: 2.5 },
  { query: "coffee", at: MTL, near: true, km: 2.5 },
  { query: "Ichiran Shibuya", at: TYO, want: { lat: 35.661, lon: 139.701 }, km: 1.5 },
  { query: "Tsukiji Outer Market", at: TYO, want: { lat: 35.665, lon: 139.77 }, km: 1.5 },
  { query: "Senso-ji", at: TYO, want: { lat: 35.7148, lon: 139.7967 }, km: 1.5 },
  { query: "teamLab Planets", at: TYO, want: { lat: 35.649, lon: 139.789 }, km: 1.5 },
  { query: "Okonomimura", at: HIJ, want: { lat: 34.3925, lon: 132.4615 }, km: 1.5 },
  { query: "Peace Memorial Museum", at: HIJ, want: { lat: 34.3915, lon: 132.4523 }, km: 1.5 },
  { query: "Itsukushima Shrine", at: MIY, want: { lat: 34.2959, lon: 132.3198 }, km: 1.5 },
  { query: "Kakiya", at: MIY, want: { lat: 34.297, lon: 132.321 }, km: 1.5 },
  { query: "Kyoto", mode: "destination", want: { lat: 35.0116, lon: 135.7681 }, km: 40 },
  { query: "Japan", mode: "destination", want: { lat: 36.2, lon: 138.25 }, km: 300 },
  { query: "Jap", mode: "destination", want: { lat: 36.2, lon: 138.25 }, km: 300 },
  { query: "Hiroshima", mode: "destination", want: { lat: 34.3963, lon: 132.4596 }, km: 40 },
];
