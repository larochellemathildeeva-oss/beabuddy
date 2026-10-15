import { Sheet } from "@/components/Sheet";
import { ArrowRight, Check, Clock, MapPin } from "@/components/icons";
import type { ConsequenceResult } from "@/lib/itinerary-change";
import type { ReviewChangeSet } from "@/lib/itinerary-review";
import {
  blockedReason,
  formatShortMinutes,
  formatShiftMinutes,
  reviewLines,
  stopName,
  type NamedStop,
} from "@/lib/review-lines";

export function ReviewChangesSheet({
  open,
  result,
  changeSet,
  directIds,
  stops,
  busy = false,
  refreshed = false,
  onApply,
  onClose,
}: {
  open: boolean;
  result: ConsequenceResult | null;
  changeSet: ReviewChangeSet | null;
  /** The stops the traveller acted on; rows that only made room are not listed. */
  directIds: ReadonlySet<string>;
  stops: readonly NamedStop[];
  busy?: boolean;
  refreshed?: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!result || !changeSet) return null;

  const direct = reviewLines(changeSet, directIds, stops);
  const downstream = result.shifts.filter((shift) => shift.downstream);
  const conflicts = result.reachabilityConflicts;
  const blocked = result.decision === "blocked";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Review changes"
      hint={
        refreshed
          ? "The itinerary changed. Béa checked this again."
          : `${direct.length} ${direct.length === 1 ? "change" : "changes"} to check`
      }
      crumb="Keep editing"
      dismissible={!busy}
      showClose={!busy}
      above
      page
      tone={2}
    >
      <div className="space-y-3">
        <section className="fe-summary">
          <p className="text-[14px] font-semibold">Unsaved draft</p>
          <p className="mt-1 text-[14px]">Your current itinerary is unchanged until you save.</p>
        </section>

        {direct.map((line, index) => (
          <section key={`${line.title}-${index}`} className="fe-card">
            <h2 className="text-[18px] font-semibold leading-tight">{line.title}</h2>
            {line.before && line.after ? (
              <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div>
                  <p className="fe-label !mb-0.5">Before</p>
                  <p className="text-[14px] font-semibold">{line.before}</p>
                </div>
                <ArrowRight className="size-4" aria-hidden />
                <div>
                  <p className="fe-label !mb-0.5">After</p>
                  <p className="text-[14px] font-semibold">{line.after}</p>
                </div>
              </div>
            ) : line.after ? (
              <p className="mt-2 text-[14px]">{line.after}</p>
            ) : null}
          </section>
        ))}

        {downstream.length > 0 && (
          <section className="fe-card">
            <h2 className="text-[18px] font-semibold leading-tight">Moves with it</h2>
            <div className="mt-2 space-y-2">
              {downstream.map((shift) => (
                <div key={shift.stopId} className="flex items-start gap-2">
                  <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">{stopName(stops, shift.stopId)}</p>
                    <p className="text-[14px] text-muted-foreground">
                      {shift.fromTime ?? "No set time"} → {shift.estimated ? "~" : ""}
                      {shift.toTime ?? "No set time"}
                      {shift.deltaMinutes != null
                        ? ` · ${formatShiftMinutes(shift.deltaMinutes)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.fixedConstraints.length > 0 && (
          <section className="fe-card">
            <h2 className="text-[18px] font-semibold leading-tight">Fixed times stay put</h2>
            <div className="mt-2 space-y-1 text-[14px]">
              {result.fixedConstraints.map((fixed) => (
                <p key={fixed.stopId}>
                  {stopName(stops, fixed.stopId)} stays fixed at {fixed.time}.
                </p>
              ))}
            </div>
          </section>
        )}

        {conflicts.length > 0 ? (
          <section className="fe-card !border-destructive/40">
            <h2 className="text-[16px] font-semibold text-destructive">Timing needs attention</h2>
            <div className="mt-2 space-y-2">
              {conflicts.map((conflict) => {
                const short = Math.max(0, conflict.requiredMinutes - conflict.availableMinutes);
                return (
                  <div
                    key={`${conflict.fromStopId}-${conflict.toStopId}`}
                    className="flex items-start gap-2"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <p className="text-[14px] leading-snug">
                      {stopName(stops, conflict.fromStopId)} → {stopName(stops, conflict.toStopId)}:{" "}
                      {conflict.estimated ? "~" : "about "}
                      {formatShortMinutes(short)} short.
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : (
          <section className="fe-summary">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <Check className="size-4" aria-hidden /> No overlapping times
            </p>
            <p className="mt-1 text-[14px]">
              {result.uncertainTravel
                ? "Béa couldn’t check every travel gap. Review the times before you save."
                : "Every stop still fits its travel time."}
            </p>
          </section>
        )}

        {conflicts.length > 0 && result.uncertainTravel && (
          <p className="text-[14px] text-muted-foreground">
            Béa couldn’t check every travel gap. Review the times before you save.
          </p>
        )}

        {blocked && (
          <p
            id="review-apply-blocked"
            role="status"
            className="fe-card !border-destructive/40 text-[14px]"
          >
            {blockedReason(result)}
          </p>
        )}
        <button
          type="button"
          disabled={busy || blocked}
          aria-describedby={blocked ? "review-apply-blocked" : undefined}
          onClick={onApply}
          className="fe-btn fe-btn-primary"
        >
          {busy ? "Saving…" : "Save changes"}
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="fe-btn">
            Keep editing
          </button>
          <button type="button" disabled={busy} onClick={onClose} className="fe-btn">
            Cancel changes
          </button>
        </div>
      </div>
    </Sheet>
  );
}
