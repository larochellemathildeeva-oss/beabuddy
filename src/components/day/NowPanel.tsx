import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Footprints, MapPin } from "lucide-react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { timeForRail } from "@/lib/timeline-kind";
import {
  arrivalWrites,
  clockMinutes,
  companionState,
  leaveBy,
  leavingWrite,
  legBetween,
  liveLegKey,
  needsLiveLeg,
  stayLine,
  undoArrivalWrite,
  type LeaveBy,
} from "@/lib/companion";
import { parseStayChoice, stayChoices, stayLabel } from "@/lib/planned-stay";

type Write = { id: string; patch: Partial<Pick<ItineraryRow, "arrived_at" | "left_at">> };

/**
 * Where you are in the day, what is next, and when to set off for it.
 *
 * Moves only when you tap. "I'm here" on arrival, "Leaving" on the way out;
 * nothing advances because the clock says it should have. The one number
 * worked out for you is "Leave by", and it is shown only when both halves of
 * it are real: a clock time on the next stop and a routed leg to it — from
 * directions saved on the phone, or else routed here for that one journey.
 */
export function NowPanel({
  dayStops,
  tripStops,
  legs,
  onProgress,
  onPlanStay,
}: {
  /** The chosen day's stops, in order, without Walk / Drive rows. */
  dayStops: ItineraryRow[];
  /** The whole trip's stops in the same shape, which saved legs index into. */
  tripStops: ItineraryRow[];
  /** Saved directions, only when they still describe this timeline. */
  legs: RouteLeg[] | null;
  onProgress: (writes: Write[]) => Promise<void>;
  /** Set or clear how long the plan allows at a stop. */
  onPlanStay: (id: string, minutes: number | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useMinuteClock();

  const state = companionState(dayStops);
  const { phase, current, previous, next } = state;

  const act = async (write: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await write();
    } catch {
      setError("That didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const from = phase === "at" ? current : phase === "between" ? previous : null;
  const savedLeg = from && next ? legBetween(tripStops, legs, from.id, next.id) : null;
  const live = useLiveLeg(savedLeg, from, next);
  const leave = next ? leaveBy(next.time_label, savedLeg ?? live.leg) : null;
  // The one case worth explaining: the next stop has a time to aim for, but
  // an end of the journey is not on the map, so there is nothing to route.
  const offMap =
    from &&
    next &&
    !savedLeg &&
    !needsLiveLeg(null, from, next) &&
    clockMinutes(next.time_label) != null
      ? ([from, next].find((s) => s.lat == null || s.lon == null) ?? null)
      : null;

  const later = next ? dayStops.slice(dayStops.indexOf(next) + 1).filter((s) => !s.arrived_at) : [];

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] font-semibold text-muted-foreground">
        {state.reached} of {state.total} {state.total === 1 ? "stop" : "stops"} reached
      </p>

      {phase === "at" && current && (
        <section className="card-soft space-y-3 p-4" aria-labelledby="now-here">
          <p className="label-caps text-muted-foreground">You're at</p>
          <h2 id="now-here" className="font-display text-[24px] leading-tight">
            {current.title}
          </h2>
          <StayLine stop={current} now={now} />
          <label className="flex items-center gap-2 text-[13px] text-muted-foreground">
            Plan to stay
            <select
              value={current.planned_stay_minutes ?? ""}
              disabled={busy}
              onChange={(e) => {
                const minutes = parseStayChoice(e.target.value);
                void act(() => onPlanStay(current.id, minutes));
              }}
              className="min-h-11 rounded-xl border border-border bg-card px-3 text-[13.5px] text-foreground"
            >
              <option value="">Not set</option>
              {stayChoices(current.planned_stay_minutes).map((minutes) => (
                <option key={minutes} value={minutes}>
                  {stayLabel(minutes)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([leavingWrite(current, new Date())]))}
              className="inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              Leaving
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([undoArrivalWrite(current)]))}
              className="inline-flex min-h-11 items-center rounded-xl border border-border px-4 text-[13.5px] font-semibold text-muted-foreground disabled:opacity-60"
            >
              Not here yet
            </button>
          </div>
        </section>
      )}

      {phase === "between" && previous && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-elevated px-3 py-2">
          <p className="text-[13px] text-muted-foreground">
            Left <span className="font-semibold text-foreground">{previous.title}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() => onProgress([{ id: previous.id, patch: { left_at: null } }]))
            }
            className="min-h-11 px-2 text-[12.5px] font-semibold text-muted-foreground underline underline-offset-2 disabled:opacity-60"
          >
            Still there
          </button>
        </div>
      )}

      {next && (
        <section
          className={`space-y-3 p-4 ${phase === "at" ? "rounded-2xl border border-border/70 bg-card" : "card-soft"}`}
          aria-labelledby="now-next"
        >
          <p className="label-caps text-muted-foreground">
            {phase === "between" ? "On the way to" : phase === "at" ? "Up next" : "First up"}
          </p>
          <div className="flex items-baseline justify-between gap-3">
            <h2
              id="now-next"
              className={`font-display leading-tight ${phase === "at" ? "text-[20px]" : "text-[24px]"}`}
            >
              {next.title}
            </h2>
            {timeForRail(next.time_label) && (
              <span className="shrink-0 text-[14px] font-bold tabular-nums text-primary">
                {timeForRail(next.time_label)}
              </span>
            )}
          </div>
          {next.address?.trim() && (
            <p className="text-[13px] text-muted-foreground">{next.address}</p>
          )}
          <LeaveByLine leave={leave} dueLabel={timeForRail(next.time_label)} />
          {live.loading && (
            <p className="text-[12.5px] text-muted-foreground">Working out the journey…</p>
          )}
          {offMap && (
            <p className="text-[12.5px] text-muted-foreground">
              {offMap.title} isn't on the map yet, so there's no time to leave by. Add its address
              on the full trip page.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() => onProgress(arrivalWrites(dayStops, next.id, new Date())))
              }
              className={`inline-flex min-h-11 items-center rounded-xl px-4 text-[14.5px] font-semibold disabled:opacity-60 ${
                phase === "at" ? "border border-border" : "bg-primary text-primary-foreground"
              }`}
            >
              I'm here
            </button>
            <a
              href={mapsPlaceUrl(next.title, { lat: next.lat, lon: next.lon })}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-[13.5px] font-semibold"
            >
              <MapPin className="size-3.5" aria-hidden />
              Open in maps
            </a>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="card-soft space-y-2 p-4">
          <p className="font-display text-[22px] leading-snug">That's the day.</p>
          <p className="text-[14px] text-muted-foreground">
            {state.reached === state.total
              ? "Every stop reached."
              : `${state.reached} of ${state.total} stops reached — the rest were skipped along the way.`}
          </p>
        </section>
      )}

      {later.length > 0 && (
        <div className="space-y-1.5">
          <p className="label-caps text-muted-foreground">Later</p>
          <ul className="space-y-1">
            {later.map((stop) => (
              <li key={stop.id} className="flex items-baseline gap-3 text-[13.5px]">
                <span className="w-11 shrink-0 font-semibold tabular-nums text-muted-foreground">
                  {timeForRail(stop.time_label) || "–"}
                </span>
                <span className="min-w-0 break-words">{stop.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function LeaveByLine({ leave, dueLabel }: { leave: LeaveBy | null; dueLabel: string }) {
  if (!leave) return null;
  if (leave.kind === "same-spot") {
    return <p className="text-[13.5px] text-muted-foreground">Same place — no need to move.</p>;
  }
  const how = leave.mode === "walking" ? "walk" : "drive";
  return (
    <p className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-[14px]">
      <Footprints className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-bold">Leave by {leave.at}</span>
        <span className="text-muted-foreground">
          {" "}
          · {leave.travelMinutes} min {how} for {dueLabel}
        </span>
      </span>
    </p>
  );
}

function StayLine({ stop, now }: { stop: ItineraryRow; now: Date | null }) {
  // Nothing on the server render: the time there depends on this clock.
  const line = now ? stayLine(stop, now) : null;
  return line ? <p className="text-[13.5px] text-muted-foreground">{line}</p> : null;
}

/**
 * Route the one journey Now is about, when nothing saved covers it.
 *
 * One request per journey per session: the answer is kept by the two stops
 * and where they are, so re-renders and tab switches do not ask again, and
 * a stop that moves is routed afresh. A failure leaves no leg, and with no
 * leg there is no "Leave by" — the view goes quiet rather than guessing.
 */
const liveLegs = new Map<string, RouteLeg | null>();

function useLiveLeg(
  savedLeg: RouteLeg | null,
  from: ItineraryRow | null,
  to: ItineraryRow | null,
): { leg: RouteLeg | null; loading: boolean } {
  const route = useServerFn(buildRoutes);
  const wanted = from && to && needsLiveLeg(savedLeg, from, to) ? liveLegKey(from, to) : null;
  const [, rerender] = useState(0);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted || !from || !to || liveLegs.has(wanted)) return;
    let cancelled = false;
    setLoadingKey(wanted);
    route({
      data: {
        stops: [
          { title: from.title, lat: from.lat, lon: from.lon },
          { title: to.title, lat: to.lat, lon: to.lon },
        ],
      },
    })
      .then((result) => {
        liveLegs.set(wanted, (result as { legs: RouteLeg[] }).legs[0] ?? null);
      })
      .catch(() => {
        // Remembered as "no leg" so a failing router is not asked on every
        // render; a reload tries again.
        liveLegs.set(wanted, null);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingKey(null);
        rerender((n) => n + 1);
      });
    return () => {
      cancelled = true;
    };
  }, [wanted]); // eslint-disable-line react-hooks/exhaustive-deps -- `wanted` stands for both stops

  return {
    leg: wanted ? (liveLegs.get(wanted) ?? null) : null,
    loading: wanted != null && loadingKey === wanted && !liveLegs.has(wanted),
  };
}

/** The current time, refreshed each minute; null until mounted. */
function useMinuteClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}
