import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
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
    "title" | "city" | "country" | "start_date" | "end_date" | "dates_status" | "status" | "budget_enabled" | "notes"
  >
>;

async function updateTripRow(id: string, patch: TripPatch): Promise<void> {
  const withStatus = { ...patch };
  if (datesStatusColumnAvailable === false && withStatus.dates_status !== undefined) {
    delete withStatus.dates_status;
  }
  const first = await supabase.from("trips").update(withStatus).eq("id", id);
  if (!first.error) return;
  if (!markDatesStatusUnavailable(first.error) || patch.dates_status === undefined) throw first.error;
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
};

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

  const load = useCallback(async () => {
    if (!tripId) return;
    const { data } = await supabase
      .from("itinerary_items")
      .select(
        "id, trip_id, day_date, time_label, kind, title, detail, address, lat, lon, position, updated_by, updated_at",
      )
      .eq("trip_id", tripId)
      .order("day_date", { ascending: true })
      .order("position", { ascending: true });
    setItems((data ?? []) as ItineraryRow[]);
    const { data: inv } = await supabase
      .from("trip_invites")
      .select("code, email, accepted_at, expires_at, revoked_at, use_count, max_uses")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
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
      const { error } = await supabase.from("itinerary_items").insert({
        trip_id: id,
        day_date: item.day_date || null,
        time_label: item.time_label || null,
        kind: item.kind,
        title: item.title,
        detail: item.detail || null,
        address: item.address || null,
        lat: item.lat ?? null,
        lon: item.lon ?? null,
        position: items.length,
        created_by: authorId,
        updated_by: authorId,
      });
      if (error) throw error;
      await load();
    },
    [tripId, me.id, items.length, load],
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
      }>,
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (additions.length === 0) return;
      const authorId = await liveUserId(me.id);

      const { error } = await supabase.from("itinerary_items").insert(
        additions.map((item, index) => ({
          trip_id: id,
          day_date: item.day_date || null,
          time_label: item.time_label || null,
          kind: item.kind,
          title: item.title,
          detail: item.detail || null,
          address: item.address || null,
          lat: item.lat ?? null,
          lon: item.lon ?? null,
          position: items.length + index,
          created_by: authorId,
          updated_by: authorId,
        })),
      );
      if (error) throw error;
      await load();
    },
    [tripId, me.id, items.length, load],
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
            position: items.length + index,
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
          "title" | "detail" | "time_label" | "kind" | "day_date" | "address" | "lat" | "lon"
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
      await supabase.from("itinerary_items").delete().eq("id", id);
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
    upsertItems,
    applySchedule,
    updateItem,
    removeItem,
    setEditing,
    reload: load,
  };
}
