/**
 * Preview-only sample rows (dev harness, never shipped to src/). The fake
 * Supabase client below serves them so the REAL hooks and route files run
 * unchanged. Dates are relative to today so each Home state is reachable.
 * Pick with the page URL: ?home=upcoming|ontrip|none &trip=alps|italy|japan
 */
const q = new URLSearchParams(location.search);
export const HOME = (q.get("home") ?? "upcoming") as
  "upcoming" | "ontrip" | "none";
const TRIP = (q.get("trip") ?? "alps") as "alps" | "italy" | "japan";
const SCREEN = q.get("screen") ?? "home";

export const USER = {
  id: "u-preview",
  email: "preview@bea.local",
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: { display_name: "Mathilde" },
  created_at: "2025-01-01T00:00:00Z",
};

const day = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

type Stop = [city: string, country: string, lat: number, lon: number];
const ROUTES: Record<string, { title: string; stops: Stop[] }> = {
  alps: {
    title: "Alps Road Trip",
    stops: [
      ["Lake Como", "Italy", 45.99, 9.26],
      ["St. Moritz", "Switzerland", 46.5, 9.84],
      ["Innsbruck", "Austria", 47.27, 11.39],
      ["Salzburg", "Austria", 47.81, 13.05],
      ["Munich", "Germany", 48.14, 11.58],
    ],
  },
  italy: {
    title: "Coastal Italy",
    stops: [
      ["Amalfi", "Italy", 40.63, 14.6],
      ["Rome", "Italy", 41.9, 12.5],
      ["Florence", "Italy", 43.77, 11.26],
      ["Cinque Terre", "Italy", 44.13, 9.71],
      ["Bologna", "Italy", 44.49, 11.34],
    ],
  },
  japan: {
    title: "Japan Explorer",
    stops: [
      ["Osaka", "Japan", 34.69, 135.5],
      ["Nara", "Japan", 34.68, 135.8],
      ["Kyoto", "Japan", 35.01, 135.77],
      ["Hakone", "Japan", 35.23, 139.11],
      ["Tokyo", "Japan", 35.68, 139.69],
    ],
  },
};

const trips: Record<string, unknown>[] = [];
const stops: Record<string, unknown>[] = [];
const items: Record<string, unknown>[] = [];
const members: Record<string, unknown>[] = [];

function addTrip(
  id: string,
  title: string,
  start: number,
  end: number,
  route: Stop[],
  extra = {},
) {
  trips.push({
    id,
    owner_id: USER.id,
    title,
    city: route[0]?.[0] ?? null,
    country: route[0]?.[1] ?? null,
    start_date: day(start),
    end_date: day(end),
    dates_status: "set",
    status: "planning",
    budget: null,
    budget_enabled: false,
    notes: null,
    ...extra,
  });
  const per = Math.max(
    1,
    Math.floor((end - start + 1) / Math.max(1, route.length)),
  );
  route.forEach(([city, country, lat, lon], i) => {
    stops.push({
      id: `${id}-s${i}`,
      trip_id: id,
      kind: "city",
      city,
      country,
      place_name: null,
      address: null,
      lat,
      lon,
      arrive_on: day(start + i * per),
      depart_on: day(i === route.length - 1 ? end : start + (i + 1) * per - 1),
      notes: null,
      position: i,
    });
  });
  members.push({
    id: `${id}-m0`,
    trip_id: id,
    user_id: USER.id,
    role: "owner",
    display_name: "Mathilde",
  });
}

function friends(id: string, names: string[]) {
  names.forEach((n, i) =>
    members.push({
      id: `${id}-f${i}`,
      trip_id: id,
      user_id: `u-${n}`,
      role: "editor",
      display_name: n,
    }),
  );
}

const main = ROUTES[TRIP]!;
if (SCREEN === "trips") {
  addTrip("t-rome", "Rome & Florence", 40, 52, [
    ["Rome", "Italy", 41.9, 12.5],
    ["Florence", "Italy", 43.77, 11.26],
  ]);
  friends("t-rome", ["Julien", "Sofia", "Amélie"]);
  addTrip("t-iceland", "Iceland Road Trip", 120, 127, [
    ["Reykjavík", "Iceland", 64.15, -21.94],
    ["Vík", "Iceland", 63.42, -19.01],
    ["Höfn", "Iceland", 64.25, -15.21],
  ]);
  friends("t-iceland", ["Julien"]);
  addTrip("t-ny", "New York", 300, 305, [
    ["New York", "United States", 40.71, -74.0],
  ]);
  friends("t-ny", ["Sofia"]);
  addTrip("t-paris", "Paris weekend", -60, -57, [
    ["Paris", "France", 48.86, 2.35],
  ]);
  addTrip("t-japan", "Japan Explorer", -240, -228, ROUTES.japan!.stops);
  addTrip(
    "t-draft",
    "Portugal someday",
    0,
    0,
    [["Lisbon", "Portugal", 38.72, -9.14]],
    {
      start_date: null,
      end_date: null,
      dates_status: "unknown",
    },
  );
} else if (HOME === "upcoming") {
  addTrip("t-main", main.title, 9, 17, main.stops);
  friends("t-main", ["Julien", "Sofia"]);
  addTrip("t-ny", "New York", 120, 125, [
    ["New York", "United States", 40.71, -74.0],
  ]);
  addTrip("t-paris", "Paris weekend", -60, -57, [
    ["Paris", "France", 48.86, 2.35],
  ]);
} else if (HOME === "ontrip") {
  // Day 3 of 7, in the third town (the references' "3 / 5"), arrived by a Companion tap.
  addTrip("t-main", main.title, -2, 4, main.stops);
  friends("t-main", ["Julien", "Sofia"]);
  const s = stops.filter((r) => r.trip_id === "t-main");
  const here = s[2]!;
  const next = s[3]!;
  const item = (
    id: string,
    date: string,
    time: string,
    kind: string,
    title: string,
    detail: string,
    extra = {},
  ) => ({
    id,
    trip_id: "t-main",
    day_date: date,
    time_label: time,
    kind,
    title,
    detail,
    address: null,
    lat: null,
    lon: null,
    position: items.length,
    updated_by: null,
    arrived_at: null,
    left_at: null,
    ...extra,
  });
  const arrived = new Date(Date.now() - 50 * 60000).toISOString();
  items.push(
    item(
      "i1",
      day(0),
      "10:00",
      "activity",
      here.city as string,
      "Old town stroll, the river and an early lunch.",
      {
        arrived_at: arrived,
      },
    ),
    item(
      "i2",
      day(0),
      "19:30",
      "food",
      "Dinner by the river",
      "A table kept for two, local dishes.",
    ),
    item(
      "i3",
      next.arrive_on as string,
      "14:30",
      "activity",
      next.city as string,
      "Scenic drive, then the old town.",
    ),
  );
} else {
  addTrip("t-paris", "Paris weekend", -60, -57, [
    ["Paris", "France", 48.86, 2.35],
  ]);
  addTrip("t-japan", "Japan Explorer", -240, -228, ROUTES.japan!.stops);
}

const recos = (
  [
    ["Café Sacher", "Innsbruck", "Austria", 47.268, 11.393],
    ["Hofgarten", "Innsbruck", "Austria", 47.27, 11.397],
    ["Viktualienmarkt", "Munich", "Germany", 48.135, 11.576],
    ["Villa del Balbianello", "Lake Como", "Italy", 45.966, 9.202],
    ["Trattoria da Gemma", "Florence", "Italy", 43.77, 11.25],
    ["Fushimi Inari", "Kyoto", "Japan", 34.967, 135.773],
    ["Arashiyama Bamboo Grove", "Kyoto", "Japan", 35.017, 135.672],
    ["Tsukiji Outer Market", "Tokyo", "Japan", 35.665, 139.77],
    ["Sky Lagoon", "Reykjavík", "Iceland", 64.116, -21.94],
    ["Pastéis de Belém", "Lisbon", "Portugal", 38.697, -9.203],
    ["Nyhavn", "Copenhagen", "Denmark", 55.68, 12.59],
  ] as [string, string, string, number, number][]
).map(([name, city, country, lat, lon], i) => ({
  id: `r${i}`,
  name,
  city,
  country,
  address: null,
  category: i % 2 ? "sight" : "food",
  notes: null,
  recommended_by: null,
  source: null,
  url: null,
  lat,
  lon,
  visited: false,
  pin_type: null,
  created_at: "2026-05-01T00:00:00Z",
  travel_tags: null,
}));

export const TABLES: Record<string, Record<string, unknown>[]> = {
  trips,
  trip_stops: stops,
  itinerary_items: items,
  trip_members: members,
  recommendations: recos,
  profiles: [{ id: USER.id, display_name: "Mathilde", home_city: "Montréal" }],
  legal_consents: [
    { consent_type: "terms", document_version: "x" },
    { consent_type: "privacy", document_version: "x" },
  ],
};
