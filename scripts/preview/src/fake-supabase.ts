/**
 * An in-memory stand-in for the Supabase client, for the preview checker.
 *
 * Reads return the sample chosen by `?sample=` in the page URL; writes are
 * applied to the in-memory rows (so the page can re-read them) and logged on
 * `window.__writes`, which the checker counts as "the click did something".
 */
type Row = Record<string, unknown>;
const w = window as unknown as { __writes: unknown[]; __sample: string };
w.__writes = [];
const sample = new URLSearchParams(location.search).get("sample") ?? "default";
w.__sample = sample;

const D1 = "2026-10-07";
const D2 = "2026-10-08";
const ago = (m: number) => new Date(Date.now() - m * 60000).toISOString();
const r = (
  id: string,
  day: string | null,
  pos: number,
  time: string | null,
  kind: string,
  title: string,
  lat: number | null,
  lon: number | null,
  extra: Row = {},
): Row => ({
  id,
  trip_id: "t1",
  day_date: day,
  time_label: time,
  kind,
  title,
  detail: null,
  address: null,
  lat,
  lon,
  position: pos,
  updated_by: null,
  updated_at: "",
  arrived_at: null,
  left_at: null,
  planned_stay_minutes: null,
  ...extra,
});

function items(): Row[] {
  if (sample === "empty") return [];
  if (sample === "undated")
    return [
      r("u1", null, 0, null, "activity", "Somewhere nice", null, null),
      r("u2", null, 1, "Lunch", "meal", "A good lunch", null, null),
    ];
  if (sample === "long")
    return Array.from({ length: 45 }, (_, i) =>
      r(`l${i}`, D1, i, `${String(8 + Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}`, i % 5 === 0 ? "meal" : "activity", `Stop ${i + 1}`, 34.39 + i * 0.001, 132.45 + i * 0.001, i < 3 ? { arrived_at: ago(200 - i * 30), left_at: ago(190 - i * 30) } : {}),
    );
  // "stray": one stop saved with a namesake's pin far away (Osaka, ~280 km).
  const strayPin: [number, number] = sample === "stray" ? [34.6937, 135.5023] : [34.396, 132.4518];
  return [
    r("a", D1, 0, "08:36", "transport", "Arrive Hiroshima Station", 34.3977, 132.4753, { arrived_at: ago(95), left_at: ago(70) }),
    r("b", D1, 1, "09:30", "activity", "Peace Memorial Museum", 34.3915, 132.4523, { address: "1-2 Nakajimacho, Naka Ward", arrived_at: ago(40), planned_stay_minutes: 75, detail: "English audio guide #4" }),
    // "unpinned": the next stop has no pin yet, as a plan's stops often don't.
    r("c", D1, 2, "11:00", "activity", "Peace Park / Atomic Bomb Dome / Cenotaph (原爆ドーム)", sample === "unpinned" ? null : 34.3955, sample === "unpinned" ? null : 132.4536, { address: "1-10 Otemachi, Naka Ward", planned_stay_minutes: 30 }),
    // "legs": a journey saved as a stop, as plans imported before folding have.
    ...(sample === "legs" ? [r("leg", D1, 3, "11:30", "transport", "Head to Motoyasubashi Pier", null, null)] : []),
    r("d", D1, 3, "11:45", "transport", "Motoyasubashi Pier ferry", strayPin[0], strayPin[1]),
    r("e", D1, 4, "13:00", "meal", "Lunch: Kakiya", 34.2968, 132.3207, { address: "Miyajima Omotesando", planned_stay_minutes: 50 }),
    r("f", D1, 5, "14:15", "activity", "Omotesando food crawl", 34.2985, 132.3218),
    r("g", D1, 6, "15:30", "activity", "Itsukushima Shrine + Great Torii", 34.2959, 132.3197),
    r("h", D1, 7, "17:15", "transport", "Sunset ferry back to Hiroshima", null, null),
    r("i", D2, 8, "09:00", "activity", "Shukkeien Garden", 34.4003, 132.4675),
    r("j", D2, 9, "12:00", "meal", "Okonomimura", 34.3925, 132.4615),
  ];
}

// "home": Home's next-trip card — an LA trip in two days with a flight, a
// hotel and half-packed bags, and the Hiroshima trip after it.
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
const homeDb: Record<string, Row[]> = {
  trips: [
    { id: "la", title: "LA · Coastal Sun & Art", city: "Los Angeles, California", country: "United States", start_date: inDays(2), end_date: inDays(3), dates_status: "fixed", status: "upcoming", owner_id: "me", budget_enabled: false, created_at: ago(900) },
    { id: "t1", title: "JQAPALA A", city: "Hiroshima", country: "Japan", start_date: inDays(11), end_date: inDays(12), dates_status: "fixed", status: "upcoming", owner_id: "me", budget_enabled: false, created_at: ago(800), notes: "Shrine ferries, coastal okonomiyaki stalls & serene Miyajima deer." },
    { id: "t2", title: "Lisbon", city: "Lisbon", country: "Portugal", start_date: inDays(40), end_date: inDays(45), dates_status: "tentative", status: "upcoming", owner_id: "me", budget_enabled: false, created_at: ago(700) },
  ],
  trip_members: [
    { id: "m1", trip_id: "la", user_id: "me", role: "owner", display_name: "Mattie" },
    { id: "m2", trip_id: "la", user_id: "sam", role: "member", display_name: "Sam" },
    { id: "m3", trip_id: "la", user_id: "ana", role: "member", display_name: "Ana" },
  ],
  trip_todos: [
    { id: "td1", trip_id: "la", title: "Reserve the Getty timed entry", notes: null, due_on: inDays(1), done: false, done_at: null, done_by: null, assigned_to: null, position: 0 },
    { id: "td2", trip_id: "la", title: "Print boarding passes", notes: null, due_on: null, done: false, done_at: null, done_by: null, assigned_to: null, position: 1 },
  ],
  recommendations: [
    { id: "rec1", user_id: "me", name: "Old Wharf Bar", city: "Montréal", country: "Canada", address: null, category: "Cocktails", notes: null, recommended_by: "Kenji", source: null, url: null, lat: 45.5, lon: -73.56, visited: false, pin_type: "reco", created_at: ago(9000) },
  ],
  itinerary_items: [
    { id: "la1", trip_id: "la", day_date: inDays(2), time_label: "08:15", kind: "flight", title: "AC 781", detail: "YUL → LAX (Non-stop)", address: null, lat: null, lon: null, position: 0, booked: true },
    { id: "la2", trip_id: "la", day_date: inDays(2), time_label: "15:00", kind: "hotel", title: "The Line Hotel", detail: "Koreatown · Conf #LA-882", address: "3515 Wilshire Blvd", lat: null, lon: null, position: 1 },
    { id: "la3", trip_id: "la", day_date: inDays(2), time_label: "18:00", kind: "meal", title: "Dinner at Guelaguetza", detail: null, address: null, lat: null, lon: null, position: 2 },
    { id: "la4", trip_id: "la", day_date: inDays(3), time_label: "10:00", kind: "sight", title: "The Broad", detail: null, address: null, lat: null, lon: null, position: 3 },
    { id: "la5", trip_id: "la", day_date: inDays(3), time_label: "16:00", kind: "sight", title: "Venice Beach", detail: null, address: null, lat: null, lon: null, position: 4 },
    { id: "h1", trip_id: "t1", day_date: inDays(11), time_label: "07:30", kind: "flight", title: "JL 251", detail: "HND → HIJ (Morning departure)", address: null, lat: null, lon: null, position: 0, booked: true },
    { id: "h2", trip_id: "t1", day_date: inDays(11), time_label: "15:00", kind: "hotel", title: "Iwaso Ryokan & Shrine Inn", detail: "Miyajima Island", address: null, lat: null, lon: null, position: 1 },
    { id: "h3", trip_id: "t1", day_date: inDays(11), time_label: "10:00", kind: "sight", title: "Hiroshima Peace Memorial Park", detail: null, address: null, lat: null, lon: null, position: 2 },
  ],
  packing_lists: [
    { id: "pl1", trip_id: "la", name: "LA", emoji: null },
    { id: "pl2", trip_id: "t1", name: "Japan", emoji: null },
  ],
  packing_items: [
    ...Array.from({ length: 12 }, (_, i) => ({ id: `pi${i}`, list_id: "pl1", label: `Item ${i + 1}`, packed: i < 8, position: i })),
    ...Array.from({ length: 10 }, (_, i) => ({ id: `pj${i}`, list_id: "pl2", label: `Item ${i + 1}`, packed: i < 7, position: i })),
  ],
};

export const db: Record<string, Row[]> = sample === "home" || sample === "home-trips" ? homeDb : {
  itinerary_items: items(),
  recommendations: [
    { id: "rec1", user_id: "me", name: "Okonomiyaki at Nagata-ya", city: "Hiroshima", country: "Japan", address: "1-7-19 Otemachi", category: "Food", notes: null, recommended_by: "Kenji", source: null, url: null, lat: 34.3948, lon: 132.4547, visited: false, pin_type: "reco", created_at: ago(9000) },
    { id: "rec2", user_id: "me", name: "Shukkei-en tea house", city: "Hiroshima", country: "Japan", address: null, category: "Cafe", notes: null, recommended_by: null, source: null, url: null, lat: 34.4003, lon: 132.4675, visited: false, pin_type: "reco", created_at: ago(8000) },
    { id: "rec3", user_id: "me", name: "Café Olimpico", city: "Montréal", country: "Canada", address: null, category: "Cafe", notes: null, recommended_by: null, source: null, url: null, lat: 45.5229, lon: -73.6005, visited: true, pin_type: "reco", created_at: ago(7000) },
  ],
};

function q(table: string) {
  let rows = [...(db[table] ?? [])];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: unknown = null;
  const filters: [string, unknown][] = [];
  const run = () => {
    const matches = (x: Row) => filters.every(([k, v]) => k === "trip_id" || k === "user_id" || x[k] === v);
    if (op === "select") return rows.filter(matches);
    w.__writes.push({ table, op, payload, filters });
    const all = (db[table] ??= []);
    if (op === "update") for (const x of all) if (matches(x)) Object.assign(x, payload);
    if (op === "delete") db[table] = all.filter((x) => !matches(x));
    if (op === "insert") {
      const added = (Array.isArray(payload) ? payload : [payload]).map((p, i) => ({ id: `new${Date.now()}${i}`, ...(p as Row) }));
      all.push(...added);
      return added;
    }
    return [];
  };
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["select", "order", "limit", "in", "neq", "gte", "lte", "is", "not", "or", "filter", "match", "range", "ilike", "contains"]) b[m] = chain;
  b.eq = (k: string, v: unknown) => {
    filters.push([k, v]);
    if (op === "select" && k !== "trip_id" && k !== "user_id") rows = rows.filter((x) => x[k] === v);
    return b;
  };
  b.insert = (p: unknown) => ((op = "insert"), (payload = p), b);
  b.upsert = (p: unknown) => ((op = "insert"), (payload = p), b);
  b.update = (p: unknown) => ((op = "update"), (payload = p), b);
  b.delete = () => ((op = "delete"), b);
  b.single = () => Promise.resolve({ data: run()[0] ?? null, error: null });
  b.maybeSingle = () => Promise.resolve({ data: run()[0] ?? null, error: null });
  b.then = (res: (v: unknown) => unknown, rej: (e: unknown) => unknown) =>
    Promise.resolve().then(() => {
      const data = run();
      return { data, error: null, count: data.length };
    }).then(res, rej);
  return b;
}

const channel = () => {
  const c: Record<string, unknown> = {};
  c.on = () => c;
  c.subscribe = (cb?: (s: string) => void) => (cb?.("SUBSCRIBED"), c);
  c.track = async () => {};
  c.untrack = async () => {};
  c.presenceState = () => ({});
  c.send = async () => {};
  c.unsubscribe = async () => {};
  return c;
};

export const supabase = {
  from: q,
  channel,
  removeChannel: async () => {},
  rpc: async () => ({ data: null, error: null }),
  auth: {
    getUser: async () => ({ data: { user: { id: "me" } }, error: null }),
    getSession: async () => ({ data: { session: { user: { id: "me" } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
  storage: {
    from: () => ({ createSignedUrl: async () => ({ data: null }), list: async () => ({ data: [] }), upload: async () => ({ data: null, error: null }) }),
  },
};
