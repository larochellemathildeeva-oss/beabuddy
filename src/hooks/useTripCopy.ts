import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { isMissingColumn } from "@/lib/bookings";
import { isMissingDatesStatusColumn } from "@/lib/trip-dates";
import {
  copyDayItems,
  dayOffset,
  duplicateStops,
  duplicateTripItems,
  shiftDay,
  type CopiedItem,
  type SourceItem,
  type SourceStop,
} from "@/lib/trip-duplicate";

const NESTING = ["parent_id", "inside"];

async function uid(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Sign in first");
  return data.user.id;
}

/**
 * Insert copied rows. The nesting columns arrive with a migration applied by
 * hand, so a save that fails for want of them is made again without them:
 * the stops matter more than which one is inside which.
 */
async function insertCopies(tripId: string, rows: CopiedItem[], author: string): Promise<void> {
  if (!rows.length) return;
  const build = (withNesting: boolean) =>
    rows.map(({ parent_id, inside, ...row }) => ({
      ...row,
      trip_id: tripId,
      created_by: author,
      updated_by: author,
      ...(withNesting && parent_id ? { parent_id } : {}),
      ...(withNesting && inside?.length ? { inside: inside as unknown as Json } : {}),
    }));
  const anyNesting = rows.some((r) => r.parent_id || r.inside?.length);
  let { error } = await supabase.from("itinerary_items").insert(build(anyNesting));
  if (error && anyNesting && isMissingColumn(error, NESTING)) {
    ({ error } = await supabase.from("itinerary_items").insert(build(false)));
  }
  if (error) throw error;
}

/** Duplicate a trip onto new dates, and copy one day onto another trip's day. */
export function useTripCopy() {
  const duplicateTrip = useCallback(
    async ({
      trip,
      items,
      stops,
      title,
      startDate,
    }: {
      trip: {
        city: string | null;
        country: string | null;
        start_date: string | null;
        end_date: string | null;
        budget_enabled: boolean;
      };
      items: readonly SourceItem[];
      stops: readonly SourceStop[];
      title: string;
      /** The new first day; null keeps the copy undated. */
      startDate: string | null;
    }): Promise<string> => {
      const author = await uid();
      const offset = dayOffset(trip.start_date, startDate) ?? 0;
      const start = startDate ?? null;
      const end = startDate && trip.end_date ? shiftDay(trip.end_date, offset) : start;
      const row = {
        owner_id: author,
        title: title.trim() || "Trip",
        city: trip.city,
        country: trip.country,
        start_date: start,
        end_date: end,
        budget_enabled: trip.budget_enabled,
      };
      let created = await supabase
        .from("trips")
        .insert({ ...row, dates_status: "tentative" })
        .select("id")
        .single();
      if (created.error && isMissingDatesStatusColumn(created.error)) {
        created = await supabase.from("trips").insert(row).select("id").single();
      }
      if (created.error || !created.data) throw created.error ?? new Error("The copy didn't save.");
      const id = (created.data as { id: string }).id;

      if (stops.length) {
        const { error } = await supabase.from("trip_stops").insert(
          duplicateStops(stops, offset).map((stop) => ({
            ...stop,
            trip_id: id,
            created_by: author,
          })),
        );
        if (error) throw error;
      }
      await insertCopies(
        id,
        duplicateTripItems(items, offset, () => crypto.randomUUID()),
        author,
      );
      return id;
    },
    [],
  );

  const copyDay = useCallback(
    async ({
      items,
      sourceDay,
      targetTripId,
      targetDay,
    }: {
      items: readonly SourceItem[];
      sourceDay: string;
      targetTripId: string;
      targetDay: string;
    }): Promise<number> => {
      const author = await uid();
      const { data } = await supabase
        .from("itinerary_items")
        .select("position")
        .eq("trip_id", targetTripId)
        .order("position", { ascending: false })
        .limit(1);
      const first = ((data?.[0] as { position?: number } | undefined)?.position ?? -1) + 1;
      const rows = copyDayItems(items, sourceDay, targetDay, () => crypto.randomUUID(), first);
      await insertCopies(targetTripId, rows, author);
      return rows.length;
    },
    [],
  );

  return { duplicateTrip, copyDay };
}
