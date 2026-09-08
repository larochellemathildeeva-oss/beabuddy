import type { Pin, PinType } from "../data/atlas.ts";

/** Marks rows inserted by "Load sample data" so we don't double-seed. */
export const DEMO_SOURCE = "demo-seed";

export type DemoPlace = {
  label: string;
  lat: number;
  lon: number;
};

/** Presets for Opportunities when GPS isn't available (conference rooms, projectors). */
export const DEMO_PLACES: readonly DemoPlace[] = [
  { label: "Lisbon", lat: 38.7223, lon: -9.1393 },
  { label: "Paris", lat: 48.8566, lon: 2.3522 },
  { label: "Toronto", lat: 43.6532, lon: -79.3832 },
  { label: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { label: "New York", lat: 40.7128, lon: -74.006 },
  { label: "Barcelona", lat: 41.3874, lon: 2.1686 },
] as const;

type SeedReco = {
  name: string;
  city: string;
  country: string;
  lat: number;
  lon: number;
  pin_type: PinType;
  category?: string;
  notes?: string;
  recommended_by?: string;
  visited?: boolean;
  travel_tags?: string[];
};

type SeedNote = { city: string; country: string; note: string };

type SeedStop = {
  day_offset: number;
  time_label: string;
  kind: string;
  title: string;
  detail?: string;
  lat?: number;
  lon?: number;
};

type SeedTrip = {
  title: string;
  city: string;
  country: string;
  /** Days from today for start_date (negative = past). */
  start_offset: number;
  nights: number;
  status: "upcoming" | "past";
  notes?: string;
  stops: SeedStop[];
};

/**
 * A dense Lisbon cluster so Near works from a room with "I'm in Lisbon",
 * plus cities across Europe / Asia / North America for the globe and stats.
 */
export const DEMO_RECOS: readonly SeedReco[] = [
  // Visited cities (globe + travel stats)
  { name: "Lisbon", city: "Lisbon", country: "Portugal", lat: 38.7223, lon: -9.1393, pin_type: "visited", category: "City" },
  { name: "Porto", city: "Porto", country: "Portugal", lat: 41.1579, lon: -8.6291, pin_type: "visited", category: "City" },
  { name: "Paris", city: "Paris", country: "France", lat: 48.8566, lon: 2.3522, pin_type: "visited", category: "City" },
  { name: "Lyon", city: "Lyon", country: "France", lat: 45.764, lon: 4.8357, pin_type: "visited", category: "City" },
  { name: "Tokyo", city: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, pin_type: "visited", category: "City" },
  { name: "Kyoto", city: "Kyoto", country: "Japan", lat: 35.0116, lon: 135.7681, pin_type: "visited", category: "City" },
  { name: "Toronto", city: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, pin_type: "visited", category: "City" },
  { name: "Montreal", city: "Montreal", country: "Canada", lat: 45.5017, lon: -73.5673, pin_type: "visited", category: "City" },
  { name: "Barcelona", city: "Barcelona", country: "Spain", lat: 41.3874, lon: 2.1686, pin_type: "visited", category: "City" },
  { name: "New York", city: "New York", country: "United States", lat: 40.7128, lon: -74.006, pin_type: "visited", category: "City" },

  // Lisbon — dense for Opportunities demos
  {
    name: "Time Out Market",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7071,
    lon: -9.1458,
    pin_type: "reco",
    category: "Food hall",
    notes: "Grab a pasteis and sit upstairs at sunset.",
    recommended_by: "Sofia",
    travel_tags: ["Restaurants", "Markets"],
  },
  {
    name: "LX Factory",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7035,
    lon: -9.1788,
    pin_type: "reco",
    category: "Neighbourhood",
    notes: "Bookshops, rooftop bars, Sunday market.",
    recommended_by: "Miguel",
    travel_tags: ["Shopping", "Local experiences"],
  },
  {
    name: "Pasteis de Belém",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.6976,
    lon: -9.2034,
    pin_type: "reco",
    category: "Café",
    notes: "The original — go early or take away.",
    recommended_by: "Ana",
    travel_tags: ["Coffee shops", "Restaurants"],
  },
  {
    name: "MAAT",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.696,
    lon: -9.1935,
    pin_type: "reco",
    category: "Museum",
    recommended_by: "Guidebook",
    travel_tags: ["Museums", "Architecture"],
  },
  {
    name: "Miradouro da Senhora do Monte",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7191,
    lon: -9.1328,
    pin_type: "nexttime",
    category: "Viewpoint",
    notes: "Missed the sunset last trip — next time.",
    travel_tags: ["Photography", "Local experiences"],
  },
  {
    name: "Oceanário de Lisboa",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7804,
    lon: -9.093,
    pin_type: "wishlist",
    category: "Attraction",
    notes: "Kids loved the idea — still haven't gone.",
    travel_tags: ["Wildlife", "Local experiences"],
  },
  {
    name: "Café A Brasileira",
    city: "Lisbon",
    country: "Portugal",
    lat: 38.7107,
    lon: -9.1424,
    pin_type: "reco",
    category: "Café",
    visited: true,
    notes: "Touristy but the statue photo is mandatory.",
    recommended_by: "You",
    travel_tags: ["Coffee shops"],
  },

  // Paris
  {
    name: "Café de Flore",
    city: "Paris",
    country: "France",
    lat: 48.8541,
    lon: 2.3325,
    pin_type: "reco",
    category: "Café",
    recommended_by: "Claire",
    travel_tags: ["Coffee shops", "Restaurants"],
  },
  {
    name: "Musée d'Orsay",
    city: "Paris",
    country: "France",
    lat: 48.86,
    lon: 2.3266,
    pin_type: "wishlist",
    category: "Museum",
    notes: "Skip the Louvre queue; do Orsay instead.",
    travel_tags: ["Museums", "Art galleries"],
  },
  {
    name: "Canal Saint-Martin walk",
    city: "Paris",
    country: "France",
    lat: 48.8708,
    lon: 2.3658,
    pin_type: "nexttime",
    category: "Walk",
    notes: "Picnic by the locks on a Sunday.",
    travel_tags: ["Local experiences"],
  },

  // Tokyo
  {
    name: "TeamLab Planets",
    city: "Tokyo",
    country: "Japan",
    lat: 35.649,
    lon: 139.787,
    pin_type: "wishlist",
    category: "Museum",
    notes: "Book weeks ahead.",
    travel_tags: ["Art galleries", "Photography"],
  },
  {
    name: "Shimokitazawa record shops",
    city: "Tokyo",
    country: "Japan",
    lat: 35.6614,
    lon: 139.6678,
    pin_type: "reco",
    category: "Neighbourhood",
    recommended_by: "Ken",
    travel_tags: ["Shopping", "Live music"],
  },
  {
    name: "Tsukiji outer market breakfast",
    city: "Tokyo",
    country: "Japan",
    lat: 35.6654,
    lon: 139.7707,
    pin_type: "nexttime",
    category: "Food",
    notes: "Tamagoyaki stand before 9am.",
    travel_tags: ["Restaurants", "Markets"],
  },

  // Toronto / NYC / Barcelona
  {
    name: "Kensington Market",
    city: "Toronto",
    country: "Canada",
    lat: 43.6545,
    lon: -79.4005,
    pin_type: "reco",
    category: "Neighbourhood",
    recommended_by: "Alex",
    travel_tags: ["Markets", "Local experiences"],
  },
  {
    name: "ROM after dark",
    city: "Toronto",
    country: "Canada",
    lat: 43.6677,
    lon: -79.3948,
    pin_type: "wishlist",
    category: "Museum",
    travel_tags: ["Museums"],
  },
  {
    name: "The Cloisters",
    city: "New York",
    country: "United States",
    lat: 40.8649,
    lon: -73.9319,
    pin_type: "wishlist",
    category: "Museum",
    notes: "Quiet medieval galleries uptown.",
    travel_tags: ["Museums", "History"],
  },
  {
    name: "Bar Marsella",
    city: "Barcelona",
    country: "Spain",
    lat: 41.3795,
    lon: 2.1701,
    pin_type: "reco",
    category: "Bar",
    recommended_by: "Jordi",
    travel_tags: ["Nightlife", "Local experiences"],
  },
  {
    name: "Park Güell early entry",
    city: "Barcelona",
    country: "Spain",
    lat: 41.4145,
    lon: 2.1527,
    pin_type: "nexttime",
    category: "Park",
    notes: "Before the tour buses.",
    travel_tags: ["Architecture", "Photography"],
  },
] as const;

export const DEMO_NOTES: readonly SeedNote[] = [
  {
    city: "Lisbon",
    country: "Portugal",
    note: "Next time: tram 28 at dawn, before it fills with tourists.",
  },
  {
    city: "Tokyo",
    country: "Japan",
    note: "Stay in Shimokitazawa one night — quieter than Shibuya.",
  },
  {
    city: "Paris",
    country: "France",
    note: "Buy museum pass on day one; Orsay before lunch.",
  },
] as const;

export const DEMO_TRIPS: readonly SeedTrip[] = [
  {
    title: "Lisbon long weekend",
    city: "Lisbon",
    country: "Portugal",
    start_offset: -40,
    nights: 3,
    status: "past",
    notes: "Sunny, crowded trams, perfect pasteis.",
    stops: [
      {
        day_offset: 0,
        time_label: "10:00",
        kind: "Plan",
        title: "Alfama wander",
        detail: "Start at Sé, end at Senhora do Monte.",
        lat: 38.7126,
        lon: -9.1332,
      },
      {
        day_offset: 0,
        time_label: "13:00",
        kind: "Food",
        title: "Lunch at Time Out Market",
        lat: 38.7071,
        lon: -9.1458,
      },
      {
        day_offset: 1,
        time_label: "09:30",
        kind: "Plan",
        title: "Belém morning",
        detail: "Tower + pasteis, then MAAT.",
        lat: 38.6976,
        lon: -9.2034,
      },
      {
        day_offset: 2,
        time_label: "11:00",
        kind: "Plan",
        title: "LX Factory",
        lat: 38.7035,
        lon: -9.1788,
      },
    ],
  },
  {
    title: "Paris in spring",
    city: "Paris",
    country: "France",
    start_offset: 21,
    nights: 4,
    status: "upcoming",
    notes: "Tentative — waiting on flights.",
    stops: [
      {
        day_offset: 0,
        time_label: "Morning",
        kind: "Plan",
        title: "Arrive CDG → Marais hotel",
      },
      {
        day_offset: 1,
        time_label: "10:00",
        kind: "Plan",
        title: "Musée d'Orsay",
        lat: 48.86,
        lon: 2.3266,
      },
      {
        day_offset: 1,
        time_label: "16:00",
        kind: "Food",
        title: "Café de Flore",
        lat: 48.8541,
        lon: 2.3325,
      },
      {
        day_offset: 2,
        time_label: "Afternoon",
        kind: "Plan",
        title: "Canal Saint-Martin picnic",
        lat: 48.8708,
        lon: 2.3658,
      },
    ],
  },
  {
    title: "Tokyo cherry season",
    city: "Tokyo",
    country: "Japan",
    start_offset: 90,
    nights: 6,
    status: "upcoming",
    stops: [
      {
        day_offset: 0,
        time_label: "Evening",
        kind: "Plan",
        title: "Shimokitazawa walk",
        lat: 35.6614,
        lon: 139.6678,
      },
      {
        day_offset: 2,
        time_label: "09:00",
        kind: "Food",
        title: "Tsukiji outer market",
        lat: 35.6654,
        lon: 139.7707,
      },
      {
        day_offset: 3,
        time_label: "14:00",
        kind: "Plan",
        title: "TeamLab Planets",
        lat: 35.649,
        lon: 139.787,
      },
    ],
  },
] as const;

/** Static pins for the signed-out landing globe (no DB). */
export function demoGlobePins(): Pin[] {
  return DEMO_RECOS.filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon)).map((r, i) => ({
    id: `demo-${i}`,
    type: r.pin_type,
    name: r.name,
    city: r.city,
    country: r.country,
    lat: r.lat,
    lon: r.lon,
    ...(r.category ? { category: r.category } : {}),
    ...(r.notes ? { notes: r.notes } : {}),
    ...(r.recommended_by ? { recommendedBy: r.recommended_by } : {}),
    ...(r.visited ? { visited: true } : {}),
    ...(r.travel_tags ? { travelTags: [...r.travel_tags] } : {}),
  }));
}

/**
 * A trip is only ours to delete when it carries the seed marker AND has a title
 * we actually seed. Title alone would delete a real trip that happens to be
 * called "Paris in spring", and trip children cascade on delete.
 */
export function isDemoTrip(trip: { title: string; notes?: string | null }): boolean {
  if (!(trip.notes ?? "").includes(`[${DEMO_SOURCE}]`)) return false;
  return DEMO_TRIPS.some((t) => t.title === trip.title);
}

function isoDate(offsetDays: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function demoTripNotes(notes?: string): string {
  const body = (notes ?? "").trim();
  return body ? `${body}\n\n[${DEMO_SOURCE}]` : `[${DEMO_SOURCE}]`;
}

export type DemoSeedResult =
  | { ok: true; recos: number; notes: number; trips: number }
  | { ok: false; reason: "already" | "signed-out" | "error" | "empty"; message: string };

export type DemoClearResult =
  | { ok: true; recos: number; notes: number; trips: number }
  | { ok: false; reason: "signed-out" | "empty" | "error"; message: string };

/**
 * Inserts sample travel data for the signed-in user. Safe to call from Profile
 * or the empty Home CTA. Does not wipe existing rows — refuses if demo seed
 * was already loaded.
 */
export async function loadDemoSeed(): Promise<DemoSeedResult> {
  const { supabase } = await import("../integrations/supabase/client.ts");
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) {
    return { ok: false, reason: "signed-out", message: "Sign in first." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("recommendations")
    .select("id")
    .eq("user_id", uid)
    .eq("source", DEMO_SOURCE)
    .limit(1);
  if (existingError) {
    return { ok: false, reason: "error", message: existingError.message };
  }
  if (existing && existing.length > 0) {
    return {
      ok: false,
      reason: "already",
      message: "Sample data is already on this account.",
    };
  }

  const recoRows = DEMO_RECOS.map((r) => ({
    user_id: uid,
    name: r.name,
    city: r.city,
    country: r.country,
    lat: r.lat,
    lon: r.lon,
    pin_type: r.pin_type,
    category: r.category ?? null,
    notes: r.notes ?? null,
    recommended_by: r.recommended_by ?? null,
    source: DEMO_SOURCE,
    visited: r.visited ?? false,
    travel_tags: r.travel_tags ?? [],
  }));

  const { error: recoError } = await supabase.from("recommendations").insert(recoRows);
  if (recoError) {
    // Live DB may not have travel_tags yet — retry without.
    if (/travel_tags/i.test(recoError.message)) {
      const withoutTags = recoRows.map(({ travel_tags: _t, ...row }) => row);
      const retry = await supabase.from("recommendations").insert(withoutTags);
      if (retry.error) {
        return { ok: false, reason: "error", message: retry.error.message };
      }
    } else {
      return { ok: false, reason: "error", message: recoError.message };
    }
  }

  const noteRows = DEMO_NOTES.map((n) => ({
    user_id: uid,
    city: n.city,
    country: n.country,
    note: n.note,
  }));
  const { error: noteError } = await supabase.from("future_notes").insert(noteRows);
  if (noteError) {
    return { ok: false, reason: "error", message: noteError.message };
  }

  let tripsMade = 0;
  for (const trip of DEMO_TRIPS) {
    const start = isoDate(trip.start_offset);
    const end = isoDate(trip.start_offset + trip.nights);
    const tripNotes = demoTripNotes(trip.notes);
    const insert = await supabase
      .from("trips")
      .insert({
        owner_id: uid,
        title: trip.title,
        city: trip.city,
        country: trip.country,
        start_date: start,
        end_date: end,
        status: trip.status,
        notes: tripNotes,
        dates_status: trip.status === "upcoming" ? "tentative" : "confirmed",
      })
      .select("id")
      .single();

    let tripId = insert.data?.id as string | undefined;
    if (insert.error) {
      if (/dates_status/i.test(insert.error.message)) {
        const retry = await supabase
          .from("trips")
          .insert({
            owner_id: uid,
            title: trip.title,
            city: trip.city,
            country: trip.country,
            start_date: start,
            end_date: end,
            status: trip.status,
            notes: tripNotes,
          })
          .select("id")
          .single();
        if (retry.error || !retry.data) {
          return { ok: false, reason: "error", message: retry.error?.message ?? "Trip insert failed" };
        }
        tripId = retry.data.id;
      } else {
        return { ok: false, reason: "error", message: insert.error.message };
      }
    }
    if (!tripId) {
      return { ok: false, reason: "error", message: "Trip insert returned no id" };
    }

    const items = trip.stops.map((s, i) => ({
      trip_id: tripId,
      day_date: isoDate(trip.start_offset + s.day_offset),
      time_label: s.time_label,
      kind: s.kind,
      title: s.title,
      detail: s.detail ?? null,
      lat: s.lat ?? null,
      lon: s.lon ?? null,
      position: i,
      created_by: uid,
      updated_by: uid,
    }));
    const { error: itemError } = await supabase.from("itinerary_items").insert(items);
    if (itemError) {
      return { ok: false, reason: "error", message: itemError.message };
    }
    tripsMade += 1;
  }

  // Only fill blanks. Overwriting a real traveller's name and home city to
  // "Demo Traveller"/"Lisbon" is not recoverable from clearDemoSeed.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, home_city")
    .eq("id", uid)
    .maybeSingle();
  const fill: { id: string; display_name?: string; home_city?: string } = { id: uid };
  if (!profile?.display_name?.trim()) fill.display_name = "Demo Traveller";
  if (!profile?.home_city?.trim()) fill.home_city = "Lisbon, Portugal";
  if (Object.keys(fill).length > 1) await supabase.from("profiles").upsert(fill);

  return {
    ok: true,
    recos: DEMO_RECOS.length,
    notes: DEMO_NOTES.length,
    trips: tripsMade,
  };
}

/**
 * Removes sample data for the signed-in user: recommendations tagged
 * `demo-seed`, matching Future Me notes, and the three sample trips
 * (timeline rows cascade). Leaves anything the user added themselves.
 */
export async function clearDemoSeed(): Promise<DemoClearResult> {
  const { supabase } = await import("../integrations/supabase/client.ts");
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) {
    return { ok: false, reason: "signed-out", message: "Sign in first." };
  }

  const { data: recoRows, error: recoSelectError } = await supabase
    .from("recommendations")
    .select("id")
    .eq("user_id", uid)
    .eq("source", DEMO_SOURCE);
  if (recoSelectError) {
    return { ok: false, reason: "error", message: recoSelectError.message };
  }

  const demoNoteTexts = DEMO_NOTES.map((n) => n.note);
  const { data: noteRows, error: noteSelectError } = await supabase
    .from("future_notes")
    .select("id, note")
    .eq("user_id", uid)
    .in("note", demoNoteTexts);
  if (noteSelectError) {
    return { ok: false, reason: "error", message: noteSelectError.message };
  }

  const demoTitles = DEMO_TRIPS.map((t) => t.title);
  const { data: tripRows, error: tripSelectError } = await supabase
    .from("trips")
    .select("id, title, notes")
    .eq("owner_id", uid)
    .in("title", demoTitles);
  if (tripSelectError) {
    return { ok: false, reason: "error", message: tripSelectError.message };
  }

  const tripIds = (tripRows ?? []).filter(isDemoTrip).map((t) => t.id);

  const recoCount = recoRows?.length ?? 0;
  const noteCount = noteRows?.length ?? 0;
  const tripCount = tripIds.length;

  if (recoCount === 0 && noteCount === 0 && tripCount === 0) {
    return {
      ok: false,
      reason: "empty",
      message: "No sample data found on this account.",
    };
  }

  if (recoCount > 0) {
    const { error } = await supabase
      .from("recommendations")
      .delete()
      .eq("user_id", uid)
      .eq("source", DEMO_SOURCE);
    if (error) return { ok: false, reason: "error", message: error.message };
  }

  if (noteCount > 0) {
    const ids = (noteRows ?? []).map((n) => n.id);
    const { error } = await supabase.from("future_notes").delete().in("id", ids);
    if (error) return { ok: false, reason: "error", message: error.message };
  }

  if (tripCount > 0) {
    const { error } = await supabase.from("trips").delete().in("id", tripIds);
    if (error) return { ok: false, reason: "error", message: error.message };
  }

  // Removing sample must also drop the Home "Load sample" prompt — otherwise
  // an empty vault immediately asks them to load what they just cleared.
  const { dismissSampleCta } = await import("./auto-seed.ts");
  const { safeStorage } = await import("./tour-state.ts");
  dismissSampleCta(safeStorage(), uid);

  return { ok: true, recos: recoCount, notes: noteCount, trips: tripCount };
}
