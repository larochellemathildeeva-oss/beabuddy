import { useRef, useState } from "react";
import { toast } from "sonner";
import type { ConsequenceResult, ScheduleStop, TravelLeg } from "@/lib/itinerary-change";
import {
  checkReviewProposal,
  inverseScheduleUpdates,
  updatesForConsequence,
  type ReviewProposal,
} from "@/lib/itinerary-review";
import type { ScheduleUpdate } from "@/lib/itinerary-schedule-write";
import type { TravelChoice } from "@/lib/travel-mode";

export type ReviewRow = ScheduleStop & { title: string };

/**
 * Which rows a proposal was built over: the stops alone (drag, Move to…,
 * which renumber stops only) or every row (a card edit, which renumbers the
 * whole trip the way `updateItem` does, saved walks included).
 */
type Scope = "stops" | "all";

type Pending = {
  scope: Scope;
  proposal: ReviewProposal;
  result: ConsequenceResult;
  /** What Apply writes, as it was checked. */
  updates: ScheduleUpdate[];
  refreshed: boolean;
  /** The rest of a mixed card edit (a title typed with a time), saved after. */
  after?: () => Promise<void>;
};

/**
 * Every manual schedule change goes through the consequence engine first.
 * Safe ones come back as the rows to write now; anything else opens Review,
 * and Apply checks it again against the itinerary as it is by then.
 */
export function useScheduleReview(input: {
  stops: readonly ReviewRow[];
  all: readonly ReviewRow[];
  travelChoice: TravelChoice;
  travelLegs: readonly TravelLeg[];
  applySchedule: (updates: ScheduleUpdate[]) => Promise<void>;
  onSaved: () => void;
  errorText: (error: unknown) => string;
}) {
  const latest = useRef(input);
  latest.current = input;
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const check = (scope: Scope, proposal: ReviewProposal) => {
    const { stops, all, travelChoice, travelLegs } = latest.current;
    const rows = scope === "stops" ? stops : all;
    const stopIds = new Set(stops.map((stop) => stop.id));
    const result = checkReviewProposal(rows, proposal, {
      travelChoice,
      travelLegs,
      ...(scope === "all"
        ? { travelRowIds: new Set(all.filter((row) => !stopIds.has(row.id)).map((row) => row.id)) }
        : {}),
    });
    const updates = result.decision === "blocked" ? [] : updatesForConsequence(rows, result);
    return { rows, result, updates };
  };

  /**
   * The rows to write now and how to put them back, or null when the change
   * needs the traveller's say and Review has opened instead.
   */
  const review = (
    scope: Scope,
    proposal: ReviewProposal,
    after?: () => Promise<void>,
  ): { updates: ScheduleUpdate[]; previous: ScheduleUpdate[] } | null => {
    const { rows, result, updates } = check(scope, proposal);
    if (result.decision === "auto-apply") {
      return { updates, previous: inverseScheduleUpdates(rows, updates) };
    }
    setPending({ scope, proposal, result, updates, refreshed: false, ...(after ? { after } : {}) });
    return null;
  };

  const apply = async () => {
    if (!pending || busy) return;
    // Someone may have changed the plan while the sheet was open: check
    // again, and show the new answer rather than write the old one.
    const again = check(pending.scope, pending.proposal);
    if (
      again.result.decision === "blocked" ||
      JSON.stringify(again.updates) !== JSON.stringify(pending.updates)
    ) {
      setPending({ ...pending, result: again.result, updates: again.updates, refreshed: true });
      return;
    }
    const previous = inverseScheduleUpdates(again.rows, again.updates);
    const { applySchedule, onSaved, errorText } = latest.current;
    setBusy(true);
    try {
      await applySchedule(again.updates);
      await pending.after?.();
      onSaved();
      setPending(null);
      toast("Changes applied", {
        duration: 8000,
        action: {
          label: "Undo",
          onClick: () =>
            void latest.current.applySchedule(previous).then(
              () => toast.success("Back where it was"),
              () => toast.error("Couldn't undo that. Check your connection."),
            ),
        },
      });
    } catch (error) {
      setPending(null);
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return {
    review,
    sheet: {
      open: pending != null,
      result: pending?.result ?? null,
      changeSet: pending?.proposal.changeSet ?? null,
      directIds: pending?.proposal.directIds ?? new Set<string>(),
      stops: input.all,
      busy,
      refreshed: pending?.refreshed ?? false,
      onApply: () => void apply(),
      onClose: () => {
        if (!busy) setPending(null);
      },
    },
  };
}
