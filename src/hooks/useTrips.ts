import { recoverableInsert } from "@/lib/recoverable-insert";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pinCityStops } from "@/lib/city-locate";
import type { Json } from "@/integrations/supabase/types";
import { chronologicalPositions, chronologicalSlot, insertAfter } from "@/lib/timeline-order";
import { clockMinutes } from "@/lib/companion";
import { isMissingColumn } from "@/lib/bookings";
import { insideNote, readInside, type InsideEntry } from "@/lib/inside-list";
import {
  datesStatusOrDefault,
  isMissingDatesStatusColumn,
  type DatesStatus,
} from "@/lib/trip-dates";
import type { NewStop } from "@/hooks/useTripStops";
import { directionSource, directionTitleKey } from "@/lib/timeline-directions";
import { homeStopFollow } from "@/lib/trip-cities";
import { generateInviteCode, inviteExpiresAt } from "@/lib/trip-invite";
import { lastLoaded, rememberLoaded, screenGeneration } from "@/lib/screen-cache";
import { readOfflineTrip, readOfflineTrips, saveOfflineTrip } from "@/lib/offline-trip";
import { ownTrips } from "@/lib/own-trips";
import { reconcileItinerarySnapshot } from "@/lib/itinerary-concurrency";
import { baseVersionsFor } from "@/lib/itinerary-concurrency";
import {
  fieldsTheRpcDropped,
  isItineraryVersionConflict,
  isMissingScheduleRpc,
  onlyOtherFieldsChanged,
  mergeCommittedRows,
  scheduleUpdatesForPatch,
  scheduleWritePlan,
  type SchedulePatch,
  type ScheduleUpdate,
} from "@/lib/itinerary-schedule-write";

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
  id?: string;
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

/**
 * The trip's first city, when it is the copy of the trip's own, follows an
 * edit to the trip's city or dates. The trip itself is saved either way.
 */
async function followHomeStop(
  id: string,
  before: Parameters<typeof homeStopFollow>[0],
  patch: Parameters<typeof homeStopFollow>[1],
): Promise<void> {
  try {
    const { data: stops } = await supabase
      .from("trip_stops")
      .select("id, kind, city, country, arrive_on, depart_on, position")
      .eq("trip_id", id);
    const follow = homeStopFollow(before, patch, stops ?? []);
    if (!follow) return;
    const { error } = await supabase.from("trip_stops").update(follow.patch).eq("id", follow.id);
    if (error) throw error;
  } catch (e) {
    console.warn("[trips] first city did not follow the trip", e);
  }
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
  /**
   * Traveller override for time semantics. null/undefined derives the default:
   * booked + clock starts Fixed, another clock starts Flexible, no clock is Sequence-only.
   */
  time_locked?: boolean | null;
  /**
   * The stop this one is inside (the Cenotaph in the park), and what to see
   * inside this one. Absent until the nesting migration is applied.
   */
  parent_id?: string | null;
  inside?: InsideEntry[];
  /**
   * Why the stop's place is worth a second look, from the import (see
   * pin-check.ts). Absent until the pin_check migration is applied.
   */
  pin_check?: string | null;
};

const ITINERARY_COLUMNS =
  "id, trip_id, day_date, time_label, kind, title, detail, address, lat, lon, position, updated_by, updated_at, arrived_at, left_at, planned_stay_minutes";
const BOOKING_COLUMN_NAMES = ["booked", "booking_ref", "booking_details"];
const NESTING_COLUMN_NAMES = ["parent_id", "inside"];
const PIN_CHECK_COLUMN_NAMES = ["pin_check"];
const TIME_LOCK_COLUMN_NAMES = ["time_locked"];
/** Columns that arrive with migrations applied by hand, asked for only while they answer. */
const OPTIONAL_COLUMN_GROUPS = [
  BOOKING_COLUMN_NAMES,
  NESTING_COLUMN_NAMES,
  PIN_CHECK_COLUMN_NAMES,
  TIME_LOCK_COLUMN_NAMES,
];

/**
 * A trip's timeline rows, or null when the read failed (no signal, an expired
 * token). Optional columns arrive with migrations applied by hand; until one
 * runs, asking for its columns fails the whole read, so it is asked again
 * without the unavailable group.
 */
async function selectTripItems(tripId: string): Promise<{
  items: ItineraryRow[];
  nesting: boolean;
  pinCheck: boolean;
  timeLock: boolean;
} | null> {
  const query = (columns: string) =>
    supabase
      .from("itinerary_items")
      .select(columns)
      .eq("trip_id", tripId)
      .order("day_date", { ascending: true })
      .order("position", { ascending: true });
  let groups = OPTIONAL_COLUMN_GROUPS;
  let { data, error } = await query([ITINERARY_COLUMNS, ...groups.flat()].join(", "));
  for (let tries = 0; error && tries < OPTIONAL_COLUMN_GROUPS.length; tries++) {
    const missing = groups.find((group) => isMissingColumn(error, group));
    if (!missing) break;
    groups = groups.filter((group) => group !== missing);
    ({ data, error } = await query([ITINERARY_COLUMNS, ...groups.flat()].join(", ")));
  }
  if (error) return null;
  return {
    nesting: groups.includes(NESTING_COLUMN_NAMES),
    pinCheck: groups.includes(PIN_CHECK_COLUMN_NAMES),
    timeLock: groups.includes(TIME_LOCK_COLUMN_NAMES),
    items: ((data ?? []) as unknown as (ItineraryRow & { inside?: unknown })[]).map((row) =>
      "inside" in row ? { ...row, inside: readInside(row.inside) } : row,
    ),
  };
}

/**
 * Write a trip's offline copy (its plan, people and timeline) the way the
 * trip page does, without opening it: after sign-in brings kept directions
 * back from the account, so the trip opens with no signal straight away.
 * Returns the timeline it kept, or null when it could not.
 */
export async function keepTripPlanOffline(
  uid: string,
  tripId: string,
): Promise<ItineraryRow[] | null> {
  try {
    const trip = (await selectTrips()).find((row) => row.id === tripId);
    if (!trip) return null;
    const { data: m, error: memberError } = await supabase
      .from("trip_members")
      .select("id, trip_id, user_id, role, display_name")
      .eq("trip_id", tripId);
    if (memberError) return null;
    const read = await selectTripItems(tripId);
    if (!read || read.items.length === 0) return null;
    saveOfflineTrip(localStorage, {
      uid,
      savedAt: new Date().toISOString(),
      trip,
      members: (m ?? []) as MemberRow[],
      items: read.items,
    });
    return read.items;
  } catch {
    return null;
  }
}

type TripsSnapshot = { uid: string; trips: TripRow[]; members: MemberRow[] };

export function useTrips() {
  // Home and Trips both open on the list they last showed, then refresh it.
  const [last] = useState(() => lastLoaded<TripsSnapshot>("trips"));
  const [uid, setUid] = useState<string | null>(last?.uid ?? null);
  const [trips, setTrips] = useState<TripRow[]>(last?.trips ?? []);
  const [members, setMembers] = useState<MemberRow[]>(last?.members ?? []);
  const [loading, setLoading] = useState(!last);

  const load = useCallback(async () => {
    const since = screenGeneration();
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setUid(user?.id ?? null);
    if (!user) {
      setTrips([]);
      setMembers([]);
      setLoading(false);
      return;
    }
    let rows: TripRow[];
    let memberRows: MemberRow[];
    try {
      rows = await selectTrips();
      const { data: m, error: memberError } = await supabase
        .from("trip_members")
        .select("id, trip_id, user_id, role, display_name");
      if (memberError) throw memberError;
      memberRows = (m ?? []) as MemberRow[];
    } catch {
      // No signal: the trips kept on this phone, if any, rather than an
      // endless "Opening…". What is already on screen stays.
      const kept = readOfflineTrips<TripRow, MemberRow, ItineraryRow>(localStorage, user.id);
      setTrips((cur) => (cur.length ? cur : kept.map((k) => k.trip)));
      setMembers((cur) => (cur.length ? cur : kept.flatMap((k) => k.members)));
      setLoading(false);
      return;
    }
    ({ trips: rows, members: memberRows } = ownTrips(rows, memberRows, user.id));
    // Together, so a card never draws with its trip but without its people.
    setTrips(rows);
    setMembers(memberRows);
    setLoading(false);
    rememberLoaded<TripsSnapshot>(
      "trips",
      { uid: user.id, trips: rows, members: memberRows },
      since,
    );
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
      recovery?: { ownerId: string; tripId: string; stopIds: string[] };
      city?: string;
      country?: string;
      start_date?: string;
      end_date?: string;
      dates_status?: DatesStatus;
      budget_enabled?: boolean;
      /** A trip to several cities: each one, in order, as a trip stop. */
      stops?: NewStop[];
    }) => {
      if (t.recovery && t.recovery.stopIds.length !== (t.stops?.length ?? 0))
        throw new Error("The saved trip needs its original cities.");
      const ownerId = await liveUserId(uid);
      if (t.recovery && t.recovery.ownerId !== ownerId)
        throw new Error("Sign in to the account that started this trip.");
      const row = {
        ...(t.recovery ? { id: t.recovery.tripId } : {}),
        owner_id: ownerId,
        title: t.title,
        city: t.city || null,
        country: t.country || null,
        start_date: t.start_date || null,
        end_date: t.end_date || null,
        dates_status: t.dates_status ?? "tentative",
        budget_enabled: t.budget_enabled ?? false,
      };
      let created: { id: string };
      if (t.recovery) {
        const stableRow = { ...row, id: t.recovery.tripId };
        await recoverableInsert(
          [stableRow],
          async () => {
            const result = await supabase
              .from("trips")
              .select("id")
              .eq("id", stableRow.id)
              .eq("owner_id", ownerId);
            if (result.error) throw result.error;
            return result.data;
          },
          async () => {
            await insertTrip(stableRow);
          },
        );
        created = { id: stableRow.id };
      } else {
        created = await insertTrip(row);
      }
      if (t.stops?.length) {
        const stopRows = t.stops.map((stop, position) => ({
          trip_id: created.id,
          kind: stop.kind ?? "destination",
          city: stop.city,
          country: stop.country || null,
          lat: stop.lat ?? null,
          lon: stop.lon ?? null,
          arrive_on: stop.arrive_on || null,
          depart_on: stop.depart_on || null,
          position,
          created_by: ownerId,
        }));
        let saved:
          | {
              id: string;
              city: string;
              country: string | null;
              lat: number | null;
              lon: number | null;
            }[]
          | null = null;
        let error: { message: string } | null = null;
        if (t.recovery) {
          const ids = t.recovery.stopIds;
          if (ids.length !== stopRows.length)
            throw new Error("The saved trip needs its original cities.");
          await recoverableInsert(
            stopRows.map((row, i) => ({ ...row, id: ids[i]! })),
            async () => {
              const result = await supabase
                .from("trip_stops")
                .select("id")
                .eq("trip_id", created.id)
                .in("id", ids);
              if (result.error) throw result.error;
              return result.data;
            },
            async (missing) => {
              const result = await supabase
                .from("trip_stops")
                .insert(missing)
                .select("id, city, country, lat, lon");
              if (result.error) throw result.error;
              saved = result.data;
            },
          );
        } else {
          const result = await supabase
            .from("trip_stops")
            .insert(stopRows)
            .select("id, city, country, lat, lon");
          saved = result.data;
          error = result.error;
        }
        // A city typed rather than picked is found on the map by its name,
        // in the background: the trip opens without waiting for it.
        if (saved) void pinCityStops(saved);
        // The trip is made either way, so open it and say what is missing
        // rather than report the whole trip as failed.
        if (error)
          toast.error(
            "The trip is made, but its cities didn't save. Add them in Settings → Cities on this trip.",
          );
      }
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
      const movesPlace = (["city", "country", "start_date", "end_date"] as const).some(
        (k) => k in clean,
      );
      const before = movesPlace
        ? (
            await supabase
              .from("trips")
              .select("city, country, start_date, end_date")
              .eq("id", id)
              .maybeSingle()
          ).data
        : null;
      await updateTripRow(id, clean);
      if (before) await followHomeStop(id, before, clean);
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

type PendingSchedule = {
  /** Every row any save in this run touches, kept local against realtime. */
  touchedIds: Set<string>;
  baseVersions: Record<string, string>;
  /** The confirmed board before the first save of the run. */
  before: ItineraryRow[];
  /** Saves of this run not finished yet. */
  inFlight: number;
};

type AtomicScheduleError = { code?: string | null; message?: string | null };

type AtomicScheduleRpc = (
  name: "apply_itinerary_schedule",
  args: { _trip_id: string; _updates: Json; _expected_versions: Json },
) => Promise<{ data: Json | null; error: AtomicScheduleError | null }>;

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
  const itemsRef = useRef<ItineraryRow[]>([]);
  const pendingScheduleRef = useRef<PendingSchedule | null>(null);
  /** Schedule saves go one at a time, each checked against the one before. */
  const scheduleChainRef = useRef<Promise<unknown>>(Promise.resolve());
  /** Moves on when a save fails, so the saves queued behind it are dropped. */
  const scheduleRunRef = useRef(0);
  /** Whether the nesting columns answered the last read. */
  const nestingReady = useRef(true);
  /** Whether the pin_check column answered the last read. */
  const pinCheckReady = useRef(true);
  /** Whether the time_locked column answered the last read. */
  const timeLockReady = useRef(true);

  /**
   * Refresh the trip's rows.
   *
   * A failed read is not an empty trip. This used to destructure `data` alone
   * and write `data ?? []`, so any hiccup — a dropped connection, an expired
   * token mid-request — replaced a full timeline with nothing, silently. That
   * is what "my directions got erased after leaving and coming back" was: the
   * rows were still in the database, and this had blanked the view.
   *
   * While an atomic schedule ChangeSet is still saving, realtime may deliver
   * its own snapshot before the RPC resolves. Untouched rows may update, but a
   * touched row keeps the optimistic local value until the write succeeds or
   * fails, so collaboration never makes the card snap back under the finger.
   */
  const load = useCallback(async () => {
    if (!tripId) return;
    const read = await selectTripItems(tripId);
    if (!read) {
      // No signal on a trip kept offline: its plan as last saved on this
      // phone, and only while nothing better is on screen.
      if (me.id) {
        const kept = readOfflineTrip<TripRow, MemberRow, ItineraryRow>(localStorage, tripId, me.id);
        if (kept)
          setItems((cur) => {
            if (cur.length) return cur;
            itemsRef.current = kept.items;
            return kept.items;
          });
      }
      return;
    }
    nestingReady.current = read.nesting;
    pinCheckReady.current = read.pinCheck;
    timeLockReady.current = read.timeLock;
    const pending = pendingScheduleRef.current;
    if (pending) {
      const reconciled = reconcileItinerarySnapshot(
        itemsRef.current,
        read.items,
        pending.touchedIds,
        pending.baseVersions,
      );
      itemsRef.current = reconciled.rows;
      setItems(reconciled.rows);
    } else {
      itemsRef.current = read.items;
      setItems(read.items);
    }
    const { data: inv, error: invError } = await supabase
      .from("trip_invites")
      .select("code, email, accepted_at, expires_at, revoked_at, use_count, max_uses")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: false });
    if (invError) return;
    setInvites(inv ?? []);
  }, [tripId, me.id]);

  useEffect(() => {
    itemsRef.current = [];
    pendingScheduleRef.current = null;
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

  /**
   * Move rows down to make room, one write each; positions have no uniqueness
   * rule, the same as "+ Add stop between". Not a transaction: a write that
   * fails part way reloads the trip, so the screen shows the order actually
   * saved rather than the one hoped for, and the error still reaches the form.
   */
  const shiftPositions = useCallback(
    async (shifts: { id: string; position: number }[], authorId: string | null) => {
      for (const shift of shifts) {
        const { error } = await supabase
          .from("itinerary_items")
          .update({ position: shift.position, ...(authorId ? { updated_by: authorId } : {}) })
          .eq("id", shift.id);
        if (error) {
          await load();
          throw error;
        }
      }
    },
    [load],
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
      // In its place by day and time, not at the end of the trip: a stop
      // added at 14:00 goes between 12:30 and 16:00. Only positions move to
      // make room; every other stop keeps its time.
      const { position, shifts } = chronologicalSlot(
        items,
        { day_date: item.day_date || null, time_label: item.time_label || null },
        clockMinutes,
      );
      await shiftPositions(shifts, authorId);
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
        // The id comes back so the form can offer a day and a time for the
        // thing that was just added, instead of asking for them up front.
        .select("id")
        .single();
      if (error) throw error;
      await load();
      return data?.id as string | undefined;
    },
    [me.id, items, load, shiftPositions],
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
        /** What to see inside this stop. */
        inside?: InsideEntry[];
        /** The addition this one is inside, by its place in this list. */
        parent_index?: number;
        /** Why its place is worth a second look (pin-check.ts). */
        pin_check?: string | null;
        /**
         * Exactly where in its day, when the caller has numbered the day
         * itself ("Change a day"). Used only when every addition has one.
         */
        position?: number;
      }>,
    ) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (additions.length === 0) return;
      const authorId = await liveUserId(me.id);

      // Nesting needs ids before the rows exist, so a stop can name the one
      // it is inside in the same insert. Without the nesting columns the
      // inside list goes into the note, as "Inside: …", and the link is let go.
      const anyNesting = additions.some(
        (item) => (item.inside?.length ?? 0) > 0 || item.parent_index != null,
      );
      const ids = additions.map(() => crypto.randomUUID());
      const nestingFor = (item: (typeof additions)[number], withNesting: boolean) => {
        const inside = item.inside ?? [];
        if (withNesting) {
          const parent =
            item.parent_index != null && item.parent_index >= 0
              ? ids[item.parent_index]
              : undefined;
          return {
            ...(inside.length ? { inside: inside as unknown as Json } : {}),
            ...(parent ? { parent_id: parent } : {}),
          };
        }
        const note = insideNote(inside);
        return note ? { detail: [item.detail, note].filter(Boolean).join(" · ") } : {};
      };

      // The booked column only exists once its migration is applied by hand,
      // so it is sent only when something is booked, and a save that fails
      // for want of it is made again without it — the stops matter more than
      // the mark.
      const anyBooked = additions.some((item) => item.booked === true);
      // Into a trip that already has stops, each goes in by its day and time,
      // as a stop added by hand does: a hotel asked for on day 1 at 15:00 was
      // saved after the last stop of the trip. Into an empty trip, in order.
      const placed = additions.every((item) => item.position != null)
        ? { positions: additions.map((item) => item.position!), shifts: [] }
        : items.length > 0
          ? chronologicalPositions(items, additions, clockMinutes)
          : { positions: additions.map((_, index) => index), shifts: [] };
      await shiftPositions(placed.shifts, authorId);
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
        position: placed.positions[index]!,
        created_by: authorId,
        updated_by: authorId,
      });
      // Like the others, sent only while its column answers: a note to check
      // a pin is never worth losing the stops over.
      const anyPinCheck = additions.some((item) => item.pin_check);
      const insertRows = (withBooked: boolean, withNesting: boolean, withPinCheck: boolean) =>
        supabase
          .from("itinerary_items")
          .insert(
            additions.map((item, index) => ({
              ...(withBooked ? { booked: item.booked === true } : {}),
              ...rowFor(item, index),
              ...(anyNesting ? { id: ids[index]! } : {}),
              ...nestingFor(item, withNesting),
              ...(withPinCheck ? { pin_check: item.pin_check || null } : {}),
            })),
          )
          // The ids come back so a bulk save can be undone in one go rather
          // than one Remove tap per row.
          .select("id");
      let withBooked = anyBooked;
      let withNesting = anyNesting && nestingReady.current;
      let withPinCheck = anyPinCheck && pinCheckReady.current;
      let { data, error } = await insertRows(withBooked, withNesting, withPinCheck);
      for (let tries = 0; error && tries < 3; tries++) {
        if (withBooked && isMissingColumn(error, ["booked"])) withBooked = false;
        else if (withNesting && isMissingColumn(error, NESTING_COLUMN_NAMES)) withNesting = false;
        else if (withPinCheck && isMissingColumn(error, PIN_CHECK_COLUMN_NAMES))
          withPinCheck = false;
        else break;
        ({ data, error } = await insertRows(withBooked, withNesting, withPinCheck));
      }
      if (error) throw error;
      await load();
      return (data ?? []).map((row) => row.id);
    },
    [tripId, me.id, items, load, shiftPositions],
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
      // Matched by day, title and, for a walk or drive, the stop it leaves
      // from — not title alone: "Walk to Hotel" comes back every evening, and
      // a title-only match moved one row from day to day while every other
      // day's walk home was never saved. The mode is left out of the match, so
      // a walk asked again by transit replaces the walk.
      const keyOf = (row: { day_date?: string | null; title: string; detail?: string | null }) =>
        `${row.day_date ?? ""}|${directionTitleKey(row.title)}|${directionSource(row.detail).toLowerCase()}`;
      const existingByKey = new Map(items.map((row) => [keyOf(row), row]));
      const inserts: typeof additions = [];
      const queued = new Set<string>();
      for (const item of additions) {
        const key = keyOf(item);
        // A row saved before sources were kept is claimed once, and updated
        // in place, rather than left beside the new one.
        const legacyKey = keyOf({ ...item, detail: null });
        const hitKey = existingByKey.has(key)
          ? key
          : existingByKey.has(legacyKey)
            ? legacyKey
            : null;
        const hit = hitKey ? existingByKey.get(hitKey) : undefined;
        if (hitKey) existingByKey.delete(hitKey);
        if (!hit) {
          // The same walk twice in one batch is saved once.
          if (!queued.has(key)) inserts.push(item);
          queued.add(key);
          continue;
        }
        const { error } = await supabase
          .from("itinerary_items")
          .update({
            title: item.title,
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
        // In by day and time, like any other addition: a walk between two
        // stops belongs between them, not after the last day.
        const placed = chronologicalPositions(items, inserts, clockMinutes);
        await shiftPositions(placed.shifts, authorId);
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
            position: placed.positions[index]!,
            created_by: authorId,
            updated_by: authorId,
          })),
        );
        if (error) throw error;
      }
      await load();
    },
    [tripId, me.id, items, load, shiftPositions],
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
   * Write schedule geometry as one optimistic, version-checked transaction.
   * Existing callers still pass day/time/position; Phase 2 also allows
   * duration and the explicit time lock to travel through this same path.
   *
   * The board is read from `itemsRef`, never from this render's `items`: Undo
   * and the toast buttons hold a copy of this function from before the save
   * they undo, and its `items` would carry the versions that save replaced.
   * Saves are queued, so two quick taps on one stop are checked one after the
   * other; each is shown at once. A failed save puts the confirmed board back
   * and drops the saves queued behind it, which were built on top of it.
   */
  const applySchedule = useCallback(
    async (updates: ScheduleUpdate[]) => {
      const id = tripIdRef.current;
      if (!id) throw new Error("Open a trip first");
      if (updates.length === 0) return;
      const authorId = await liveUserId(me.id);

      const shown = scheduleWritePlan(itemsRef.current, updates);
      if (!shown) return;
      const run = scheduleRunRef.current;
      const pending: PendingSchedule = pendingScheduleRef.current ?? {
        touchedIds: new Set(),
        baseVersions: {},
        before: shown.before,
        inFlight: 0,
      };
      for (const touched of shown.touchedIds) {
        pending.touchedIds.add(touched);
        if (!(touched in pending.baseVersions) && shown.baseVersions[touched]) {
          pending.baseVersions[touched] = shown.baseVersions[touched]!;
        }
      }
      pending.inFlight += 1;
      pendingScheduleRef.current = pending;
      itemsRef.current = shown.optimistic;
      setItems(shown.optimistic);

      // Bound: `rpc` reads `this.rest`, so a bare `supabase.rpc` throws before
      // sending anything, and every schedule save failed as "no connection".
      const rpc = supabase.rpc.bind(supabase) as unknown as AtomicScheduleRpc;
      const send = async () => {
        if (scheduleRunRef.current !== run) {
          throw Object.assign(new Error("itinerary_version_conflict: an earlier save failed"), {
            code: "40001",
          });
        }
        // Versions as they stand now: a save queued ahead of this one has
        // already moved them.
        const call = () =>
          rpc("apply_itinerary_schedule", {
            _trip_id: id,
            _updates: shown.updates as unknown as Json,
            _expected_versions: baseVersionsFor(
              itemsRef.current,
              shown.touchedIds,
            ) as unknown as Json,
          });
        let { data, error } = await call();
        if (error && isItineraryVersionConflict(error)) {
          // The traveller's own save of another field (a title on blur, the
          // auto-pin, a booking) also moves the version. When the server's
          // schedule is still the one this save was built on, take its
          // versions and send once more; otherwise it is a real clash.
          const { data: fresh } = await supabase
            .from("itinerary_items")
            .select("*")
            .eq("trip_id", id)
            .in("id", [...shown.touchedIds]);
          const rows = (fresh ?? []) as unknown as Record<string, unknown>[];
          if (
            rows.length &&
            onlyOtherFieldsChanged(
              shown.before as unknown as Record<string, unknown>[],
              rows,
              shown.touchedIds,
            )
          ) {
            itemsRef.current = mergeCommittedRows(
              itemsRef.current,
              rows.map((row) => ({ id: row["id"], updated_at: row["updated_at"] })),
            );
            ({ data, error } = await call());
          }
        }
        if (error && isMissingScheduleRpc(error)) {
          // The migration is applied by hand. Until it is, save a row at a
          // time, as before, with no version check.
          console.warn("apply_itinerary_schedule is missing; saving schedule row by row");
          for (const row of shown.updates) {
            const { id: rowId, ...fields } = row;
            const { error: rowError } = await supabase
              .from("itinerary_items")
              // time_locked is not in the generated types until its migration.
              .update({ ...fields, updated_by: authorId } as never)
              .eq("id", rowId)
              .eq("trip_id", id);
            if (rowError) throw rowError;
          }
          return;
        }
        if (error) throw error;
        itemsRef.current = mergeCommittedRows(itemsRef.current, data);
        setItems(itemsRef.current);

        // The Phase 1 function writes only day, time and position and says
        // nothing of the rest. Save duration (and the lock, where its column
        // exists) as a plain row, only if nobody changed the row since the
        // function's own write, and keep the version this write makes.
        let lockUnavailable = false;
        for (const row of fieldsTheRpcDropped(shown.updates, data)) {
          const { id: rowId, ...fields } = row;
          if ("time_locked" in fields && !timeLockReady.current) {
            delete fields.time_locked;
            lockUnavailable = true;
          }
          if (Object.keys(fields).length === 0) continue;
          const version = itemsRef.current.find((item) => item.id === rowId)?.updated_at;
          const { data: saved, error: rowError } = await supabase
            .from("itinerary_items")
            // time_locked is not in the generated types until its migration.
            .update({ ...fields, updated_by: authorId } as never)
            .eq("id", rowId)
            .eq("trip_id", id)
            .eq("updated_at", version ?? "")
            .select("id, updated_at");
          if (rowError || !saved?.length) {
            // Day, time and position are already saved; say so rather than
            // presenting the whole edit as undone.
            throw Object.assign(new Error("Only part of that change saved."), {
              cause: rowError ?? undefined,
              code: "ITINERARY_PARTLY_SAVED",
            });
          }
          itemsRef.current = mergeCommittedRows(itemsRef.current, saved);
          setItems(itemsRef.current);
        }
        if (lockUnavailable) {
          console.warn("time_locked column missing: apply 20261002190000_itinerary_time_lock.sql");
          throw Object.assign(new Error("Fixed and Flexible aren't set up yet."), {
            code: "TIME_LOCK_UNAVAILABLE",
          });
        }
      };
      const sent = scheduleChainRef.current.then(send);
      scheduleChainRef.current = sent.catch(() => undefined);

      try {
        await sent;
      } catch (error) {
        // Only while this run is still the board's: not after the trip changed.
        if (scheduleRunRef.current === run && pendingScheduleRef.current === pending) {
          scheduleRunRef.current += 1;
          itemsRef.current = pending.before;
          setItems(pending.before);
        }
        // Keep a recognisable message for Phase 3's Review UI while preserving
        // the original RPC error for existing callers and diagnostics.
        if (isItineraryVersionConflict(error as AtomicScheduleError)) {
          throw Object.assign(new Error("The itinerary changed while you were editing."), {
            cause: error,
            code: "ITINERARY_VERSION_CONFLICT",
          });
        }
        throw error;
      } finally {
        pending.inFlight -= 1;
        if (pending.inFlight === 0 && pendingScheduleRef.current === pending) {
          pendingScheduleRef.current = null;
          await load();
        }
      }
    },
    [me.id, load],
  );

  /**
   * Update one card without making schedule fields a second write path.
   *
   * Day, time, duration and the Fixed/Flexible override all use the same
   * optimistic/version-checked RPC as drag, Move to… and Béa edits. When a
   * day or time change changes where the row belongs, every displaced
   * position is part of that same transaction. Everything else on the card
   * keeps the ordinary row update path.
   */
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
          | "time_locked"
          | "booked"
          | "booking_ref"
          | "booking_details"
          | "parent_id"
          | "inside"
          | "pin_check"
        >
      >,
    ) => {
      const { inside, day_date, time_label, planned_stay_minutes, time_locked, ...rest } = patch;
      const owns = (key: keyof typeof patch) => Object.prototype.hasOwnProperty.call(patch, key);
      const changesSchedule =
        owns("day_date") ||
        owns("time_label") ||
        owns("planned_stay_minutes") ||
        owns("time_locked");
      const current = itemsRef.current.find((item) => item.id === id);

      if (changesSchedule) {
        const schedule: SchedulePatch = {};
        if (owns("day_date")) schedule.day_date = day_date ?? null;
        if (owns("time_label")) schedule.time_label = time_label ?? null;
        if (owns("planned_stay_minutes")) {
          schedule.planned_stay_minutes = planned_stay_minutes ?? null;
        }
        if (owns("time_locked")) schedule.time_locked = time_locked ?? null;
        const updates = scheduleUpdatesForPatch(itemsRef.current, id, schedule);
        if (!updates) throw new Error("That stop is no longer in the itinerary.");
        await applySchedule(updates);
      }

      // Schedule-only edits are done. A mixed patch is still allowed for
      // callers that update another field at the same time, but schedule
      // geometry never leaks back into this ordinary row write.
      if (Object.keys(rest).length === 0 && inside === undefined) return;

      // A place set by hand is the traveller's own: whatever Béa was unsure
      // of about the old pin no longer applies.
      const clearsCheck =
        pinCheckReady.current && Boolean(current?.pin_check) && ("lat" in rest || "lon" in rest);
      const write = (withCheck: boolean) =>
        supabase
          .from("itinerary_items")
          .update({
            ...rest,
            ...(inside ? { inside: inside as unknown as Json } : {}),
            ...(withCheck ? { pin_check: null } : {}),
            updated_by: me.id,
          })
          .eq("id", id);
      let { error } = await write(clearsCheck);
      if (error && clearsCheck && isMissingColumn(error, PIN_CHECK_COLUMN_NAMES)) {
        ({ error } = await write(false));
      }
      if (error) throw error;
      await load();
    },
    [me.id, load, applySchedule],
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
    removeItem,
    setEditing,
    reload: load,
  };
}
