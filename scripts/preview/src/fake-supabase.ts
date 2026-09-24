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
    r("c", D1, 2, "11:00", "activity", "Peace Park / Atomic Bomb Dome / Cenotaph (原爆ドーム)", 34.3955, 132.4536, { address: "1-10 Otemachi, Naka Ward", planned_stay_minutes: 30 }),
    r("d", D1, 3, "11:45", "transport", "Motoyasubashi Pier ferry", strayPin[0], strayPin[1]),
    r("e", D1, 4, "13:00", "meal", "Lunch: Kakiya", 34.2968, 132.3207, { address: "Miyajima Omotesando", planned_stay_minutes: 50 }),
    r("f", D1, 5, "14:15", "activity", "Omotesando food crawl", 34.2985, 132.3218),
    r("g", D1, 6, "15:30", "activity", "Itsukushima Shrine + Great Torii", 34.2959, 132.3197),
    r("h", D1, 7, "17:15", "transport", "Sunset ferry back to Hiroshima", null, null),
    r("i", D2, 8, "09:00", "activity", "Shukkeien Garden", 34.4003, 132.4675),
    r("j", D2, 9, "12:00", "meal", "Okonomimura", 34.3925, 132.4615),
  ];
}

export const db: Record<string, Row[]> = {
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
