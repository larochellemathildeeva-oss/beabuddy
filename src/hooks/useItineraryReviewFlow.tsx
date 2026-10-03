import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ReviewChangesSheet } from "@/components/day/ReviewChangesSheet";
import type { ItineraryRow } from "@/hooks/useTrips";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ConsequenceResult, ScheduleStop } from "@/lib/itinerary-change";
import {
  changeSetForMoves,
  changeSetForSchedulePatch,
  checkReviewProposal,
  inverseScheduleUpdates,
  updatesForConsequence,
  type ReviewProposal,
} from "@/lib/itinerary-review";
import type { ScheduleUpdate } from "@/lib/itinerary-schedule-write";
import { splitDirectionRows } from "@/lib/timeline-directions";
import type { StopMove } from "@/lib/stop-move";
import type { TravelChoice } from "@/lib/travel-mode";

type CardPatch = Partial<
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
>;

type SchedulePatch = Partial<
  Pick<ItineraryRow, "day_date" | "time_label" | "planned_stay_minutes" | "time_locked">
>;

type Intent =
  | { type: "moves"; moves: StopMove[]; summary?: string }
  | { type: "patch"; stopId: string; patch: SchedulePatch; summary?: string };

type Pending = {
  intent: Intent;
  proposal: ReviewProposal;
  result: ConsequenceResult;
  baseline: Map<string, string>;
  refreshed: boolean;
};

type VersionRow = { id: string; updated_at: string };

type AtomicScheduleRpc = (
  name: "apply_itinerary_schedule",
  args: { _trip_id: string; _updates: Json; _expected_versions: Json },
) => Promise<{
  data: Json | null;
  error: { code?: string | null; message?: string | null } | null;
}>;

const SCHEDULE_KEYS = new Set<keyof CardPatch>([
  "day_date",
  "time_label",
  "planned_stay_minutes",
  "time_locked",
]);

function scheduleStops(items: readonly ItineraryRow[]): ItineraryRow[] {
  return splitDirectionRows(items).stops;
}

function schedulePatch(patch: CardPatch): SchedulePatch {
  const picked: SchedulePatch = {};
  if (Object.prototype.hasOwnProperty.call(patch, "day_date"))
    picked.day_date = patch.day_date ?? null;
  if (Object.prototype.hasOwnProperty.call(patch, "time_label")) {
    picked.time_label = patch.time_label ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "planned_stay_minutes")) {
    picked.planned_stay_minutes = patch.planned_stay_minutes ?? null;
  }
  if (Object.prototype.hasOwnProperty.call(patch, "time_locked")) {
    picked.time_locked = patch.time_locked ?? null;
  }
  return picked;
}

function nonSchedulePatch(patch: CardPatch): CardPatch {
  return Object.fromEntries(
    Object.entries(patch).filter(([key]) => !SCHEDULE_KEYS.has(key as keyof CardPatch)),
  ) as CardPatch;
}

function scheduleSignature(stop: ScheduleStop): string {
  return JSON.stringify([
    stop.day_date,
    stop.time_label,
    stop.position,
    stop.planned_stay_minutes ?? null,
    stop.time_locked ?? null,
    stop.booked ?? false,
    stop.lat ?? null,
    stop.lon ?? null,
  ]);
}

function affectedDays(proposal: ReviewProposal, result: ConsequenceResult): Set<string | null> {
  const days = new Set<string | null>();
  for (const change of proposal.changeSet.changes) {
    if (!proposal.directIds.has(change.stopId)) continue;
    if (change.type === "move") {
      days.add(change.from.dayDate);
      days.add(change.to.dayDate);
    }
  }
  for (const shift of result.shifts) {
    days.add(shift.fromDayDate);
    days.add(shift.toDayDate);
  }
  return days;
}

function baselineFor(
  stops: readonly ItineraryRow[],
  proposal: ReviewProposal,
  result: ConsequenceResult,
): Map<string, string> {
  const days = affectedDays(proposal, result);
  const direct = proposal.directIds;
  return new Map(
    stops
      .filter((stop) => direct.has(stop.id) || days.has(stop.day_date))
      .map((stop) => [stop.id, scheduleSignature(stop)] as const),
  );
}

function baselineChanged(
  baseline: ReadonlyMap<string, string>,
  stops: readonly ItineraryRow[],
): boolean {
  const current = new Map(stops.map((stop) => [stop.id, scheduleSignature(stop)] as const));
  for (const [id, signature] of baseline) {
    if (current.get(id) !== signature) return true;
  }
  return false;
}

function proposalFor(stops: readonly ItineraryRow[], intent: Intent): ReviewProposal | null {
  return intent.type === "moves"
    ? changeSetForMoves(stops, intent.moves, `manual-move-${Date.now()}`)
    : changeSetForSchedulePatch(stops, intent.stopId, intent.patch, `manual-card-${Date.now()}`);
}

async function freshTripItems(tripId: string): Promise<ItineraryRow[]> {
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("day_date", { ascending: true })
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ItineraryRow[];
}

async function committedVersions(
  tripId: string,
  ids: readonly string[],
): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("itinerary_items")
    .select("id, updated_at")
    .eq("trip_id", tripId)
    .in("id", [...ids]);
  if (error) throw error;
  const rows = (data ?? []) as VersionRow[];
  if (rows.length !== new Set(ids).size) throw new Error("One of those stops is no longer here.");
  return Object.fromEntries(rows.map((row) => [row.id, row.updated_at]));
}

function versionError(error: unknown): boolean {
  const e = error as { code?: string | null; message?: string | null } | null;
  return e?.code === "40001" || Boolean(e?.message?.includes("itinerary_version_conflict:"));
}

export function useItineraryReviewFlow({
  tripId,
  items,
  travelChoice,
  applySchedule,
  updateItem,
  reload,
  onScheduleChanged,
}: {
  tripId: string;
  items: ItineraryRow[];
  travelChoice: TravelChoice;
  applySchedule: (updates: ScheduleUpdate[]) => Promise<void>;
  updateItem: (id: string, patch: CardPatch) => Promise<void>;
  reload: () => Promise<void>;
  onScheduleChanged?: () => void;
}) {
  const stops = useMemo(() => scheduleStops(items), [items]);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const checkIntent = (intent: Intent, currentStops: ItineraryRow[]) => {
    const proposal = proposalFor(currentStops, intent);
    if (!proposal) return null;
    const result = checkReviewProposal(currentStops, proposal, { travelChoice });
    return {
      proposal,
      result,
      baseline: baselineFor(currentStops, proposal, result),
    };
  };

  const guardedUndo = async (
    inverse: ScheduleUpdate[],
    expectedVersions: Record<string, string>,
  ) => {
    if (inverse.length === 0) return;
    const ids = inverse.map((update) => update.id);
    try {
      const now = await committedVersions(tripId, ids);
      if (ids.some((id) => now[id] !== expectedVersions[id])) {
        toast.error("This trip changed since then.", {
          description: "Béa won’t overwrite someone else’s edits.",
        });
        return;
      }
      // Bound: `rpc` reads `this.rest`, so a bare `supabase.rpc` throws before
      // sending anything, and every schedule save failed as "no connection".
      const rpc = supabase.rpc.bind(supabase) as unknown as AtomicScheduleRpc;
      const { error } = await rpc("apply_itinerary_schedule", {
        _trip_id: tripId,
        _updates: inverse as unknown as Json,
        _expected_versions: expectedVersions as unknown as Json,
      });
      if (error) throw error;
      onScheduleChanged?.();
      await reload();
      toast.success("Changes undone");
    } catch (error) {
      toast.error(
        versionError(error)
          ? "This trip changed since then. Béa won’t overwrite someone else’s edits."
          : "Béa couldn’t undo that change.",
      );
    }
  };

  const saveChecked = async (
    before: ItineraryRow[],
    result: ConsequenceResult,
    summary?: string,
  ) => {
    const updates = updatesForConsequence(before, result);
    if (updates.length === 0) return;
    const inverse = inverseScheduleUpdates(before, updates);
    await applySchedule(updates);
    onScheduleChanged?.();
    const versions = await committedVersions(
      tripId,
      updates.map((update) => update.id),
    );
    const direct = result.shifts.find((shift) => !shift.downstream);
    const title =
      summary || (updates.length === 1 ? "Change saved" : `${updates.length} changes applied`);
    toast(title, {
      ...(direct?.toDayDate && direct.fromDayDate !== direct.toDayDate
        ? { description: `Moved to ${direct.toDayDate}.` }
        : {}),
      duration: 8000,
      action: {
        label: "Undo",
        onClick: () => void guardedUndo(inverse, versions),
      },
    });
  };

  const request = async (intent: Intent) => {
    const checked = checkIntent(intent, stops);
    if (!checked) return;
    if (checked.result.decision === "auto-apply") {
      await saveChecked(stops, checked.result, intent.summary);
      return;
    }
    setPending({ intent, ...checked, refreshed: false });
  };

  const moveStops = async (moves: StopMove[], summary?: string) => {
    await request({ type: "moves", moves, ...(summary ? { summary } : {}) });
  };

  const saveCard = async (id: string, patch: CardPatch) => {
    const scheduled = schedulePatch(patch);
    const rest = nonSchedulePatch(patch);
    const hasSchedule = Object.keys(scheduled).length > 0;
    const hasRest = Object.keys(rest).length > 0;

    if (!hasSchedule) {
      await updateItem(id, patch);
      return;
    }
    if (hasRest) {
      // Current cards commit fields separately. Keep mixed legacy callers on
      // the board's #222 path so a non-schedule save cannot be lost.
      await updateItem(id, patch);
      return;
    }
    await request({ type: "patch", stopId: id, patch: scheduled });
  };

  const applyReview = async () => {
    if (!pending || busy) return;
    setBusy(true);
    try {
      const fresh = scheduleStops(await freshTripItems(tripId));
      if (baselineChanged(pending.baseline, fresh)) {
        const checked = checkIntent(pending.intent, fresh);
        if (!checked) {
          setPending(null);
          toast.error("This itinerary changed while you were reviewing it.");
          return;
        }
        setPending({ intent: pending.intent, ...checked, refreshed: true });
        return;
      }
      await saveChecked(fresh, pending.result, pending.intent.summary);
      setPending(null);
    } catch (error) {
      if (versionError(error)) {
        try {
          const fresh = scheduleStops(await freshTripItems(tripId));
          const checked = checkIntent(pending.intent, fresh);
          if (checked) {
            setPending({ intent: pending.intent, ...checked, refreshed: true });
            return;
          }
        } catch {
          // Fall through to the normal save error below.
        }
      }
      toast.error("That change didn’t save.", {
        description: "Béa kept the latest itinerary.",
      });
    } finally {
      setBusy(false);
    }
  };

  const reviewSheet = (
    <ReviewChangesSheet
      open={Boolean(pending)}
      result={pending?.result ?? null}
      changeSet={pending?.proposal.changeSet ?? null}
      directIds={pending?.proposal.directIds ?? new Set<string>()}
      stops={stops}
      busy={busy}
      refreshed={pending?.refreshed ?? false}
      onApply={() => void applyReview()}
      onClose={() => {
        if (!busy) setPending(null);
      }}
    />
  );

  return {
    moveStops,
    saveCard,
    reviewSheet,
    reviewOpen: Boolean(pending),
  };
}
