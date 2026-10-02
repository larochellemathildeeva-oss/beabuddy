import { Sheet } from "@/components/Sheet";
import { Clock, MapPin } from "@/components/icons";
import { timeModeFor, type ConsequenceResult, type ScheduleStop } from "@/lib/itinerary-change";
import type { ReviewProposal, ScheduleReviewChange } from "@/lib/itinerary-review";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { stayLabel } from "@/lib/planned-stay";

type NamedStop = ScheduleStop & { title: string };

type ChangeLine = {
  title: string;
  before?: string;
  after?: string;
};

const minuteNumber = new Intl.NumberFormat();

function stopName(stops: readonly NamedStop[], id: string): string {
  return stops.find((stop) => stop.id === id)?.title ?? "This stop";
}

function dayLabel(day: string | null): string {
  return day ? formatTimelineDayLabel(day) : "No date";
}

function dayAndTime(day: string | null, time: string | null | undefined): string {
  return [dayLabel(day), time || null].filter(Boolean).join(" · ");
}

function modeLabel(stop: NamedStop, locked: boolean | null): string {
  const mode = timeModeFor({ ...stop, time_locked: locked });
  return mode === "fixed" ? "Fixed" : mode === "flexible" ? "Flexible" : "Sequence only";
}

function changeLine(change: ScheduleReviewChange, stops: readonly NamedStop[]): ChangeLine {
  const stop = stops.find((row) => row.id === change.stopId);
  const title = stop?.title ?? "This stop";

  if (change.type === "duration") {
    return {
      title,
      before: change.fromMinutes == null ? "No duration" : stayLabel(change.fromMinutes),
      after: change.toMinutes == null ? "No duration" : stayLabel(change.toMinutes),
    };
  }

  if (change.type === "retime") {
    return {
      title,
      before: change.fromTime ?? "No set time",
      after: change.toTime ?? "No set time",
    };
  }

  if (change.type === "time-lock") {
    return {
      title,
      before: stop ? modeLabel(stop, change.fromLocked) : "Previous time behavior",
      after: stop ? modeLabel(stop, change.toLocked) : "New time behavior",
    };
  }

  const dayChanged = change.from.dayDate !== change.to.dayDate;
  const timeChanged = change.to.preferredTime !== undefined;
  if (dayChanged) {
    const beforeTime = stop?.time_label ?? null;
    const afterTime = timeChanged ? change.to.preferredTime : beforeTime;
    return {
      title,
      before: dayAndTime(change.from.dayDate, beforeTime),
      after: dayAndTime(change.to.dayDate, afterTime),
    };
  }
  if (timeChanged) {
    return {
      title,
      before: stop?.time_label ?? "No set time",
      after: change.to.preferredTime ?? "No set time",
    };
  }
  return { title, after: "Moves to a new place in the day" };
}

export function ReviewChangesSheet({
  open,
  result,
  proposal,
  stops,
  busy = false,
  refreshed = false,
  onApply,
  onClose,
}: {
  open: boolean;
  result: ConsequenceResult | null;
  proposal: ReviewProposal | null;
  stops: readonly NamedStop[];
  busy?: boolean;
  refreshed?: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!result || !proposal) return null;

  const direct = proposal.changeSet.changes
    .filter((change) => proposal.directIds.has(change.stopId))
    .map((change) => changeLine(change, stops));
  const downstream = result.shifts.filter((shift) => shift.downstream);
  const conflicts = result.reachabilityConflicts;
  const blocked = result.decision === "blocked";
  const guardedClose = () => {
    if (!busy) onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={guardedClose}
      title="Review changes"
      hint={
        refreshed
          ? "The itinerary changed. Béa checked this again."
          : "Béa checked what moves with this."
      }
      dismissible={!busy}
      above
    >
      <div className="space-y-4">
        {direct.length > 0 && (
          <section>
            <p className="label-caps mb-1.5">Your change</p>
            <div className="space-y-1.5">
              {direct.map((line, index) => (
                <div
                  key={`${line.title}-${index}`}
                  className="rounded-xl border border-border bg-card px-3 py-2.5"
                >
                  <p className="text-[14px] font-semibold text-foreground">{line.title}</p>
                  {line.before && line.after ? (
                    <p className="mt-0.5 text-[13px] text-foreground/80">
                      <span className="line-through">{line.before}</span>
                      <span aria-hidden> → </span>
                      <span className="font-semibold text-foreground">{line.after}</span>
                    </p>
                  ) : line.after ? (
                    <p className="mt-0.5 text-[13px] text-foreground/80">{line.after}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        )}

        {downstream.length > 0 && (
          <section>
            <p className="label-caps mb-1.5">Moves with it</p>
            <div className="space-y-1.5">
              {downstream.map((shift) => {
                const delta = shift.deltaMinutes;
                const deltaLabel =
                  delta == null
                    ? ""
                    : ` · ${delta > 0 ? "+" : delta < 0 ? "−" : ""}${minuteNumber.format(
                        Math.abs(delta),
                      )} min`;
                return (
                  <div
                    key={shift.stopId}
                    className="flex items-start gap-2 rounded-xl bg-elevated px-3 py-2.5"
                  >
                    <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-semibold text-foreground">
                        {stopName(stops, shift.stopId)}
                      </p>
                      <p className="text-[12.5px] text-foreground">
                        {shift.fromTime ?? "No set time"} → {shift.toTime ?? "No set time"}
                        {deltaLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.fixedConstraints.length > 0 && (
          <section className="rounded-xl border border-primary/25 bg-primary-soft px-3 py-2.5">
            <p className="text-[13.5px] font-semibold text-foreground">Fixed times stay put</p>
            <div className="mt-1 space-y-0.5 text-[12.5px] text-foreground/80">
              {result.fixedConstraints.map((fixed) => (
                <p key={fixed.stopId}>
                  {stopName(stops, fixed.stopId)} stays fixed at {fixed.time}.
                </p>
              ))}
            </div>
          </section>
        )}

        {conflicts.length > 0 && (
          <section className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5">
            <p className="text-[13.5px] font-semibold text-destructive">Timing needs attention</p>
            <div className="mt-1.5 space-y-2">
              {conflicts.map((conflict) => {
                const short = Math.max(0, conflict.requiredMinutes - conflict.availableMinutes);
                return (
                  <div
                    key={`${conflict.fromStopId}-${conflict.toStopId}`}
                    className="flex items-start gap-2"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <p className="text-[12.5px] leading-snug text-foreground">
                      {stopName(stops, conflict.fromStopId)} → {stopName(stops, conflict.toStopId)}:{" "}
                      {conflict.estimated ? "likely " : ""}about{" "}
                      {minuteNumber.format(short)} min short.
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.uncertainTravel && (
          <p className="rounded-xl bg-elevated px-3 py-2.5 text-[12.5px] text-foreground">
            Béa couldn’t check every travel gap. Review the times before you apply this.
          </p>
        )}

        {blocked && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-[12.5px] text-foreground">
            This change can’t be applied yet. Keep the current itinerary and try a different move.
          </p>
        )}

        <div className="grid gap-2 pt-1">
          <button
            type="button"
            disabled={busy || blocked}
            onClick={onApply}
            className="min-h-11 rounded-xl bg-primary px-4 text-[14.5px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply changes"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={guardedClose}
            className="min-h-11 rounded-xl border border-border bg-card px-4 text-[14px] font-semibold text-foreground disabled:opacity-50"
          >
            Keep current itinerary
          </button>
        </div>
      </div>
    </Sheet>
  );
}
