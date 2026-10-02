import { Sheet } from "@/components/Sheet";
import { Clock, MapPin } from "@/components/icons";
import type {
  ChangeSet,
  ConsequenceResult,
  ProposedChange,
  ScheduleStop,
} from "@/lib/itinerary-change";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { stayLabel } from "@/lib/planned-stay";

type NamedStop = ScheduleStop & { title: string };

function stopName(stops: readonly NamedStop[], id: string): string {
  return stops.find((stop) => stop.id === id)?.title ?? "This stop";
}

function dayLabel(day: string | null): string {
  return day ? formatTimelineDayLabel(day) : "No date";
}

function changeLine(change: ProposedChange, stops: readonly NamedStop[]): {
  title: string;
  before?: string;
  after?: string;
} | null {
  if (change.type === "insert" || change.type === "delete" || change.type === "place") return null;
  const title = stopName(stops, change.stopId);
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
  const dayChanged = change.from.dayDate !== change.to.dayDate;
  if (dayChanged) {
    return {
      title,
      before: dayLabel(change.from.dayDate),
      after: dayLabel(change.to.dayDate),
    };
  }
  if (change.to.preferredTime !== undefined) {
    const current = stops.find((stop) => stop.id === change.stopId)?.time_label ?? null;
    return {
      title,
      before: current ?? "No set time",
      after: change.to.preferredTime ?? "No set time",
    };
  }
  return { title, after: "Moves to a new place in the day" };
}

export function ReviewChangesSheet({
  open,
  result,
  changeSet,
  stops,
  busy = false,
  refreshed = false,
  onApply,
  onClose,
}: {
  open: boolean;
  result: ConsequenceResult | null;
  changeSet: ChangeSet | null;
  stops: readonly NamedStop[];
  busy?: boolean;
  refreshed?: boolean;
  onApply: () => void;
  onClose: () => void;
}) {
  if (!result || !changeSet) return null;

  const direct = changeSet.changes
    .map((change) => changeLine(change, stops))
    .filter((line): line is NonNullable<typeof line> => Boolean(line));
  const downstream = result.shifts.filter((shift) => shift.downstream);
  const conflicts = result.reachabilityConflicts;

  return (
    <Sheet
      open={open}
      onClose={onClose}
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
                <div key={`${line.title}-${index}`} className="rounded-xl border border-border bg-card px-3 py-2.5">
                  <p className="text-[14px] font-semibold text-foreground">{line.title}</p>
                  {line.before && line.after ? (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">
                      <span className="line-through">{line.before}</span>
                      <span aria-hidden> → </span>
                      <span className="font-semibold text-foreground">{line.after}</span>
                    </p>
                  ) : line.after ? (
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{line.after}</p>
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
              {downstream.map((shift) => (
                <div key={shift.stopId} className="flex items-start gap-2 rounded-xl bg-elevated px-3 py-2.5">
                  <Clock className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-foreground">
                      {stopName(stops, shift.stopId)}
                    </p>
                    <p className="text-[12.5px] text-muted-foreground">
                      {shift.fromTime ?? "No set time"} → {shift.toTime ?? "No set time"}
                      {shift.deltaMinutes != null
                        ? ` · ${shift.deltaMinutes > 0 ? "+" : ""}${shift.deltaMinutes} min`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {result.fixedConstraints.length > 0 && (
          <section className="rounded-xl border border-primary/25 bg-primary-soft px-3 py-2.5">
            <p className="text-[13.5px] font-semibold text-foreground">Fixed times stay put</p>
            <div className="mt-1 space-y-0.5 text-[12.5px] text-muted-foreground">
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
                  <div key={`${conflict.fromStopId}-${conflict.toStopId}`} className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                    <p className="text-[12.5px] leading-snug text-foreground/80">
                      {stopName(stops, conflict.fromStopId)} → {stopName(stops, conflict.toStopId)}: {conflict.estimated ? "likely " : ""}
                      about {short} min short.
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {result.uncertainTravel && (
          <p className="rounded-xl bg-elevated px-3 py-2.5 text-[12.5px] text-muted-foreground">
            Béa couldn’t check every travel gap. Review the times before you apply this.
          </p>
        )}

        <div className="grid gap-2 pt-1">
          <button
            type="button"
            disabled={busy || result.decision === "blocked"}
            onClick={onApply}
            className="min-h-11 rounded-xl bg-primary px-4 text-[14.5px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply changes"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-11 rounded-xl border border-border bg-card px-4 text-[14px] font-semibold text-foreground disabled:opacity-50"
          >
            Keep current itinerary
          </button>
        </div>
      </div>
    </Sheet>
  );
}
