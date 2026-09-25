import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { insertAfter, neighbourInDay, nextPosition } from "@/lib/timeline-order";
import { isMissingColumn } from "@/lib/bookings";
import {
  datesStatusOrDefault,
  isMissingDatesStatusColumn,
  type DatesStatus,
} from "@/lib/trip-dates";
import { generateInviteCode, inviteExpiresAt } from "@/lib/trip-invite";

/** Cached after the first select/insert: the live DB may not have this column yet. */
let datesStatusColumnAvailable: boolean | null = null;

const TRIP_COLS =
  "id, owner_id, title, city, country, start_date, end_date, status, budget, budget_enabled, notes";
const TRIP_COLS_WITH_DATES_STATUS = `${TRIP_COLS}, dates_status`;

function markDatesStatusUnavailable(error: { message?: string; code?: string } | null | undefined) {
  if (isMissingDatesStatusColumn(error)) {
    datesStatusColumnAvailable = false;
    return true;
  }
  return false;
}

type TripQueryRow = TripRow & { dates_status?: string | null };

function asTripRow(row: TripQueryRow): TripRow {
  return {
    ...row,
    dates_status: datesStatusOrDefault(row.dates_status),
  };
}

async function selectTrips(): Promise<TripRow[]> {
  if (datesStatusColumnAvailable !== false) {
    const first = await supabase
      .from("trips")
      .select(TRIP_COLS_WITH_DATES_STATUS)
      .order("start_date", { ascending: false });
    if (!first.error) {
      datesStatusColumnAvailable = true;
      return ((first.data ?? []) as TripQueryRow[]).map(asTripRow);
    }
    if (!markDatesStatusUnavailable(first.error)) throw first.error;
  }
  const retry = await supabase
    .from("trips")
    .select(TRIP_COLS)
    .order("start_date", { ascending: false });
  if (retry.error) throw retry.error;
  return ((retry.data ?? []) as TripQueryRow[]).map(asTripRow);
}

async function insertTrip(row: {
  owner_id: string;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_status: DatesStatus;
  budget_enabled: boolean;
}): Promise<{ id: string }> {
  const withStatus = { ...row };
  if (datesStatusColumnAvailable !== false) {
    const first = await supabase.from("trips").insert(withStatus).select("id").single();
    if (!first.error && first.data) {
      datesStatusColumnAvailable = true;
      return first.data as { id: string };
    }
    if (!markDatesStatusUnavailable(first.error)) throw first.error;
  }
  const { dates_status: _datesStatus, ...withoutStatus } = withStatus;
  const retry = await supabase.from("trips").insert(withoutStatus).select("id").single();
  if (retry.error) throw retry.error;
  return retry.data as { id: string };
}

type TripPatch = Partial<
  Pick<
    TripRow,
    | "title"
    | "city"
    | "country"
    | "start_date"
    | "end_date"
    | "dates_status"
    | "status"
    | "budget_enabled"
    | "notes"
  >
>;

async function updateTripRow(id: string, patch: TripPatch): Promise<void> {
  const withStatus = { ...patch };
  if (datesStatusColumnAvailable === false && withStatus.dates_status !== undefined) {
    delete withStatus.dates_status;
  }
  const first = await supabase.from("trips").update(withStatus).eq("id", id);
  if (!first.error) return;
  if (!markDatesStatusUnavailable(first.error) || patch.dates_status === undefined)
    throw first.error;
  const { dates_status: _datesStatus, ...withoutStatus } = patch;
  const retry = await supabase.from("trips").update(withoutStatus).eq("id", id);
  if (retry.error) throw retry.error;
}

async function liveUserId(fallback?: string | null): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id ?? fallback ?? null;
  if (!id) throw new Error("Sign in first");
  return id;
}

export type TripRow = {
  id: string;
  owner_id: string;
  title: string;
  city: string | null;
  country: string | null;
  start_date: string | null;
  end_date: string | null;
  dates_status: DatesStatus;
  status: string;
  budget: string | null;
  budget_enabled: boolean;
  notes: string | null;
};

export type MemberRow = {
  id: string;
  trip_id: string;
  user_id: string;
  role: string;
  display_name: string | null;
};

export type ItineraryRow = {
  id: string;
  trip_id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  detail: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  position: number;
  updated_by: string | null;
  updated_at: string;
  /** Tapped "I'm here" — the companion view's record of the day. */
  arrived_at: string | null;
  left_at: string | null;
  planned_stay_minutes: number | null;
  /** Absent until the bookings migration is applied; read as "not booked". */
  booked?: boolean;
  booking_ref?: string | null;
  booking_details?: string | null;
};

const ITINERARY_COLUMNS =
  "id, trip_id, day_date, time_label, kind, title, detail, address, lat, lon, position, updated_by, updated_at, arrived_at, left_at, planned_stay_minutes";
const BOOKING_COLUMN_NAMES = ["booked", "booking_ref", "booking_details"];
const BOOKING_COLUMNS = BOOKING_COLUMN_NAMES.join(", ");

export function useTrips() {
  const [uid, setUid] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setUid(user?.id ?? null);
    if (!user) {
      setTrips([]);
      setMembers([]);
      setLoading(false);
      return;
    }
    const rows = await selectTrips();
    setTrips(rows);
    const { data: m } = await supabase
      .from("trip_members")
      .select("id, trip_id, user_id, role, display_name");
    setMembers((m ?? []) as MemberRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel("trips-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "trips" }, () => void load())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_members" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [uid, load]);

  const createTrip = useCallback(
    async (t: {
      title: string;
      city?: string;
      country?: string;
      start_date?: string;
      end_date?: string;
      dates_status?: DatesStatus;
      budget_enabled?: boolean;
    }) => {
      const ownerId = await liveUserId(uid);
      const row = {
        owner_id: ownerId,
        title: t.title,
        city: t.city || null,
        country: t.country || null,
        start_date: t.start_date || null,
        end_date: t.end_date || null,
        dates_status: t.dates_status ?? "tentative",
        budget_enabled: t.budget_enabled ?? false,
      };
      const created = await insertTrip(row);
      await load();
      return created.id;
    },
    [uid, load],
  );

  const updateTrip = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          TripRow,
          | "title"
          | "city"
          | "country"
          | "start_date"
          | "end_date"
          | "dates_status"
          | "status"
          | "budget_enabled"
          | "notes"
        >
      >,
    ) => {
      const clean = Object.fromEntries(
        Object.entries(patch).map(([k, v]) => [k, v === "" ? null : v]),
      ) as typeof patch;
      await updateTripRow(id, clean);
      await load();
    },
    [load],
  );

  const deleteTrip = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("trips").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const inviteToTrip = useCallback(
    async (tripId: string, email?: string) => {
      const inviterId = await liveUserId(uid);
      // Retire any still-open codes for this trip so only one active share exists.
      await supabase
        .from("trip_invites")
        .update({ revoked_at: new Date().toISOString() })
        .eq("trip_id", tripId)
        .is("revoked_at", null);
      const code = generateInviteCode();
      const { error } = await supabase.from("trip_invites").insert({
        trip_id: tripId,
        code,
        email: email || null,
        invited_by: inviterId,
        expires_at: inviteExpiresAt(),
        max_uses: 1,
        use_count: 0,
      });
      if (error) throw error;
      return code;
    },
    [uid],
  );

  const revokeTripInvite = useCallback(async (tripId: string, code: string) => {
    const { error } = await supabase
      .from("trip_invites")
      .update({ revoked_at: new Date().toISOString() })
      .eq("trip_id", tripId)
      .eq("code", code)
      .is("revoked_at", null);
    if (error) throw error;
  }, []);

  const joinTrip = useCallback(
    async (code: string, displayName?: string) => {
      const { data, error } = await supabase.rpc("accept_trip_invite", {
        _code: code,
        ...(displayName ? { _display_name: displayName } : {}),
      });
      if (error) throw error;
      await load();
      return data as unknown as string;
    },
    [load],
  );

  /** Non-owner leaves; owner with companions must remove them or delete the trip. */
  const leaveTrip = useCallback(
    async (tripId: string) => {
      const userId = await liveUserId(uid);
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) throw new Error("Trip not found");
      if (trip.owner_id === userId) {
        const others = members.filter((m) => m.trip_id === tripId && m.user_id !== userId);
        if (others.length > 0) {
          throw new Error("You're the trip owner. Remove the others first, or delete the trip.");
        }
        await deleteTrip(tripId);
        return;
      }
      const { error } = await supabase
        .from("trip_members")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", userId);
      if (error) throw error;
      await load();
    },
    [uid, trips, members, deleteTrip, load],
  );

  /** Owner removes another member. */
  const removeTripMember = useCallback(
    async (tripId: string, memberUserId: string) => {
      const userId = await liveUserId(uid);
      const trip = trips.find((t) => t.id === tripId);
      if (!trip) throw new Error("Trip not found");
      if (trip.owner_id !== userId) throw new Error("Only the trip owner can remove people");
      if (memberUserId === userId) throw new Error("Use leave or delete the trip instead");
      const { error } = await supabase
        .from("trip_members")
        .delete()
        .eq("trip_id", tripId)
        .eq("user_id", memberUserId);
      if (error) throw error;
      await load();
    },
    [uid, trips, load],
  );

  return {
    uid,
    trips,
    members,
    loading,
    signedIn: !!uid,
    createTrip,
    updateTrip,
    deleteTrip,
    inviteToTrip,
    revokeTripInvite,
    joinTrip,
    leaveTrip,
    removeTripMember,
    reload: load,
  };
}

export type Presence = { userId: string; name: string; editing: string | null };

export function useTripBoard(tripId: string | null, me: { id: string | null; name: string }) {
  const [items, setItems] = useState<ItineraryRow[]>([]);
  const [invites, setInvites] = useState<
    {
      code: string;
      email: string | null;
      accepted_at: string | null;
      expires_at: string | null;
      revoked_at: string | null;
      use_count: number;
      max_uses: number;
    }[]
  >([]);
  const [present, setPresent] = useState<Presence[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const tripIdRef = useRef(tripId);
  tripIdRef.current = tripId;

  /**
   * Refresh the trip's rows.
   *
   * A failed read is not an empty trip. This used to destructure `data` alone
   * and write `data ?? []`, so any hiccup — a dropped connection, an expired
   * token mid-request — replaced a full timeline with nothing, silently. That
   * is what "my directions got erased after leaving and coming back" was: the
   * rows were still in the database, and this had blanked the view.
   *
   * Every path here reloads through this one function, including the realtime
   * subscription that fires right after a batch of legs is added, so the
   * window for it was wide. Keeping what we already have is always better
   * than showing an empty trip we cannot vouch for.
   */
  const load = useCallback(async () => {
    if (!tripId) return;
    const query = (columns: string) =>
      supabase
        .from("itinerary_items")
        .select(columns)
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("position", { ascending: true });
    let { data, error } = await query(`${ITINERARY_COLUMNS}, ${BOOKING_COLUMNS}`);
    // The booking columns arrive with a migration applied by hand. Until it
    // runs, asking for them fails the whole read, and a failed read keeps
    // an empty trip on screen — so ask again without them.
    if (error && isMissingColumn(error, BOOKING_COLUMN_NAMES)) {
      ({ data, error } = await query(ITINERARY_COLUMNS));
    }
    if (error) return;
    setItems((data ?? []) as unknown as ItineraryRow[]);
    const { data: inv, error: invError } = await supabase
      .from("trip_invites")
      .select("code, email, accepted_at, expires_at, revoked_at, use_count, max_uses")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    if (invError) return;
    setInvites(inv ?? []);
  }, [tripId]);

  useEffect(() => {
    setItems([]);
    setPresent([]);
    void load();
  }, [load]);

  useEffect(() => {
    if (!tripId || !me.id) return;
    // Row changes stay on a public channel: postgres_changes payloads are already
    // filtered by RLS on itinerary_items, which requires trip membership.
    const dataChannel = supabase.channel(`trip:${tripId}`);
    dataChannel
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "itinerary_items",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void load(),
      )
      .subscribe();

    // Presence is client-supplied and fanned out to everyone on the topic, so it
    // needs its own gate. `private: true` is what makes Realtime consult the RLS
    // policies in 20260906120000_gate_trip_presence_topics.sql — without it the
    // topic is public and anyone holding the trip UUID can join it.
    const presenceChannel = supabase.channel(`trip-presence:${tripId}`, {
      config: { private: true, presence: { key: me.id } },
    });
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState<Presence>();
        const list: Presence[] = [];
        for (const key of Object.keys(state)) {
          const first = state[key]?.[0];
          if (first) list.push(first);
        }
        setPresent(list);
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void presenceChannel.track({ userId: me.id, name: me.name, editing: null });
        }
      });
    channelRef.current = presenceChannel;
    return () => {
      channelRef.current = null;
      void supabase.removeChannel(dataChannel);
      void supabase.removeChannel(presenceChannel);
    };
  }, [tripId, me.id, me.name, load]);

  const setEditing = useCallback(
    (label: string | null) => {
      const ch = channelRef.current;
      if (!ch || !me.id) return;
      void ch.track({ userId: me.id, name: me.name, editing: label });
    },
    [me.id, me.name],
  );

  const addItem = useCallback(
    async (item: {
      day_date?: string;
      time_label?: string;
      kind: string;
      title: string;
      detail?: string;
      address?: string;
      lat?: number;
      lon?: number;
    }) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      const authorId = await liveUserId(me.id);
      const { data, error } = await supabase
        .from("itinerary_items")
        .insert({
          trip_id: id,
          day_date: item.day_date || null,
          time_label: item.time_label || null,
          kind: item.kind,
          title: item.title,
          detail: item.detail || null,
          address: item.address || null,
          lat: item.lat ?? null,
          lon: item.lon ?? null,
          position: nextPosition(items),
          created_by: authorId,
          updated_by: authorId,
        })
        // The id comes back so the form can offer a day and a time for the
        // thing that was just added, instead of asking for them up front.
        .select("id")
        .single();
      if (error) throw error;
      await load();
      return data?.id as string | undefined;
    },
    [tripId, me.id, items.length, load],
  );

  /**
   * Add a row straight after another, for "+ Add stop between".
   *
   * Rows after the anchor move down one place first, then the new row takes
   * the gap. Positions have no uniqueness rule, so a reader who reloads
   * mid-way sees at worst two rows sharing a place for a moment, never a
   * failure.
   */
  const insertItemAfter = useCallback(
    async (
      afterId: string,
      item: {
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
      },
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      const authorId = await liveUserId(me.id);
      const { position, shifts } = insertAfter(items, afterId);
      for (const shift of shifts) {
        const { error } = await supabase
          .from("itinerary_items")
          .update({ position: shift.position, updated_by: authorId })
          .eq("id", shift.id);
        if (error) throw error;
      }
      const { data, error } = await supabase
        .from("itinerary_items")
        .insert({
          trip_id: id,
          day_date: item.day_date || null,
          time_label: item.time_label || null,
          kind: item.kind,
          title: item.title,
          detail: item.detail || null,
          address: item.address || null,
          lat: item.lat ?? null,
          lon: item.lon ?? null,
          position,
          created_by: authorId,
          updated_by: authorId,
        })
        .select("id")
        .single();
      if (error) throw error;
      await load();
      return data?.id as string | undefined;
    },
    [items, me.id, load],
  );

  const addItems = useCallback(
    async (
      additions: Array<{
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
        planned_stay_minutes?: number;
        /** Booked in the plan it came from. */
        booked?: boolean;
      }>,
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (additions.length === 0) return;
      const authorId = await liveUserId(me.id);

      // The booked column only exists once its migration is applied by hand,
      // so it is sent only when something is booked, and a save that fails
      // for want of it is made again without it — the stops matter more than
      // the mark.
      const anyBooked = additions.some((item) => item.booked === true);
      const rowFor = (item: (typeof additions)[number], index: number) => ({
        trip_id: id,
        day_date: item.day_date || null,
        time_label: item.time_label || null,
        kind: item.kind,
        title: item.title,
        detail: item.detail || null,
        address: item.address || null,
        lat: item.lat ?? null,
        lon: item.lon ?? null,
        planned_stay_minutes: item.planned_stay_minutes ?? null,
        position: nextPosition(items) + index,
        created_by: authorId,
        updated_by: authorId,
      });
      const insertRows = (withBooked: boolean) =>
        supabase
          .from("itinerary_items")
          .insert(
            additions.map((item, index) => ({
              ...(withBooked ? { booked: item.booked === true } : {}),
              ...rowFor(item, index),
            })),
          )
          // The ids come back so a bulk save can be undone in one go rather
          // than one Remove tap per row.
          .select("id");
      let { data, error } = await insertRows(anyBooked);
      if (error && anyBooked && isMissingColumn(error, ["booked"])) {
        ({ data, error } = await insertRows(false));
      }
      if (error) throw error;
      await load();
      return (data ?? []).map((row) => row.id);
    },
    [tripId, me.id, items.length, load],
  );

  /** Take a whole batch back out — the undo half of addItems. */
  const removeItems = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase.from("itinerary_items").delete().in("id", ids);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const upsertItems = useCallback(
    async (
      additions: Array<{
        day_date?: string;
        time_label?: string;
        kind: string;
        title: string;
        detail?: string;
        address?: string;
        lat?: number;
        lon?: number;
      }>,
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (additions.length === 0) return;
      const authorId = await liveUserId(me.id);
      const existingByTitle = new Map(items.map((row) => [row.title.trim().toLowerCase(), row]));
      const inserts: typeof additions = [];
      for (const item of additions) {
        const hit = existingByTitle.get(item.title.trim().toLowerCase());
        if (!hit) {
          inserts.push(item);
          continue;
        }
        const { error } = await supabase
          .from("itinerary_items")
          .update({
            detail: item.detail ?? hit.detail,
            address: item.address ?? hit.address,
            lat: item.lat ?? hit.lat,
            lon: item.lon ?? hit.lon,
            day_date: item.day_date || hit.day_date,
            time_label: item.time_label || hit.time_label,
            kind: item.kind,
            updated_by: authorId,
          })
          .eq("id", hit.id)
          .eq("trip_id", id);
        if (error) throw error;
      }
      if (inserts.length > 0) {
        const { error } = await supabase.from("itinerary_items").insert(
          inserts.map((item, index) => ({
            trip_id: id,
            day_date: item.day_date || null,
            time_label: item.time_label || null,
            kind: item.kind,
            title: item.title,
            detail: item.detail || null,
            address: item.address || null,
            lat: item.lat ?? null,
            lon: item.lon ?? null,
            position: nextPosition(items) + index,
            created_by: authorId,
            updated_by: authorId,
          })),
        );
        if (error) throw error;
      }
      await load();
    },
    [tripId, me.id, items, load],
  );

  const updateItem = useCallback(
    async (
      id: string,
      patch: Partial<
        Pick<
          ItineraryRow,
          | "title"
          | "detail"
          | "time_label"
          | "kind"
          | "day_date"
          | "address"
          | "lat"
          | "lon"
          | "planned_stay_minutes"
          | "booked"
          | "booking_ref"
          | "booking_details"
        >
      >,
    ) => {
      const { error } = await supabase
        .from("itinerary_items")
        .update({ ...patch, updated_by: me.id })
        .eq("id", id);
      if (error) throw error;
      await load();
    },
    [me.id, load],
  );

  /**
   * Record arriving at or leaving stops, several rows in one gesture.
   *
   * Arriving somewhere closes the stop you were at, and the database refuses
   * a departure before an arrival, so the writes are applied in the order
   * given and the board reloads once at the end rather than flickering
   * through each.
   */
  const setProgress = useCallback(
    async (
      writes: {
        id: string;
        patch: Partial<Pick<ItineraryRow, "arrived_at" | "left_at">>;
      }[],
    ) => {
      try {
        for (const { id, patch } of writes) {
          const { error } = await supabase
            .from("itinerary_items")
            .update({ ...patch, updated_by: me.id })
            .eq("id", id);
          if (error) throw error;
        }
      } finally {
        await load();
      }
    },
    [me.id, load],
  );

  /**
   * Move a saved entry up or down within its day.
   *
   * A straight swap of positions, the same way trip_stops does it. Crossing a
   * day boundary is deliberately not possible here: rows sort by day first, so
   * the swap would not move anything you can see. Changing the day is its own
   * control.
   */
  const moveItem = useCallback(
    async (id: string, direction: -1 | 1) => {
      const tripId2 = tripIdRef.current;
      if (!tripId2) throw new Error("Open a trip first");
      const current = items.find((item) => item.id === id);
      const swapWith = neighbourInDay(items, id, direction);
      if (!current || !swapWith) return;
      const authorId = await liveUserId(me.id);
      await Promise.all([
        supabase
          .from("itinerary_items")
          .update({ position: swapWith.position, updated_by: authorId })
          .eq("id", current.id)
          .eq("trip_id", tripId2),
        supabase
          .from("itinerary_items")
          .update({ position: current.position, updated_by: authorId })
          .eq("id", swapWith.id)
          .eq("trip_id", tripId2),
      ]);
      await load();
    },
    [items, me.id, load],
  );

  const applySchedule = useCallback(
    async (
      updates: Array<{
        id: string;
        day_date: string | null;
        time_label: string | null;
        position: number;
      }>,
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (updates.length === 0) return;
      const authorId = await liveUserId(me.id);
      const known = new Set(items.map((item) => item.id));
      for (const row of updates) {
        if (!known.has(row.id)) continue;
        const { error } = await supabase
          .from("itinerary_items")
          .update({
            day_date: row.day_date,
            time_label: row.time_label,
            position: row.position,
            updated_by: authorId,
          })
          .eq("id", row.id)
          .eq("trip_id", id);
        if (error) throw error;
      }
      await load();
    },
    [me.id, items, load],
  );

  const removeItem = useCallback(
    async (id: string) => {
      // Must throw: the undo toast only makes sense if the row really went,
      // and re-inserting after a failed delete leaves two copies.
      const { error } = await supabase.from("itinerary_items").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  return {
    items,
    invites,
    present,
    addItem,
    addItems,
    removeItems,
    upsertItems,
    applySchedule,
    updateItem,
    setProgress,
    insertItemAfter,
    moveItem,
    removeItem,
    setEditing,
    reload: load,
  };
}
