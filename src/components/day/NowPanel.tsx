import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Clock, CloudRain, MapPin } from "lucide-react";
import { PlaceFacts } from "@/components/PlaceFacts";
import type { ItineraryRow } from "@/hooks/useTrips";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { lookupRain } from "@/lib/weather.functions";
import { rainLine, rainNotice, WEATHER_ATTRIBUTION, type RainForecast } from "@/lib/weather";
import {
  arrivalWrites,
  clockMinutes,
  companionState,
  leaveBy,
  leaveCountdown,
  leavingWrite,
  legBetween,
  liveLegKey,
  needsLiveLeg,
  stayLine,
  undoArrivalWrite,
  type LeaveBy,
} from "@/lib/companion";

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
  area,
  onProgress,
}: {
  /** The chosen day's stops, in order, without Walk / Drive rows. */
  dayStops: ItineraryRow[];
  /** The whole trip's stops in the same shape, which saved legs index into. */
  tripStops: ItineraryRow[];
  /** Saved directions, only when they still describe this timeline. */
  legs: RouteLeg[] | null;
  /** The trip's area, so a stop without a pin can be looked up to time the journey. */
  area?: string | undefined;
  onProgress: (writes: Write[]) => Promise<void>;
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
  // A saved leg counts only when it carries a time; one saved as "open in
  // Maps" would otherwise stop Now from working the journey out itself.
  const saved = from && next ? legBetween(tripStops, legs, from.id, next.id) : null;
  const savedLeg = saved && (saved.duration > 0 || saved.sameSpot) ? saved : null;
  const live = useLiveLeg(savedLeg, from, next, area);
  const leg = savedLeg ?? live.leg;
  const leave = next ? leaveBy(next.time_label, leg) : null;
  // The one case worth explaining: the next stop has a time to aim for, but
  // an end of the journey could not be found on the map, so nothing to time.
  const offMap =
    from && next && !live.loading && !leave && clockMinutes(next.time_label) != null
      ? leg?.unknownSpot
        ? leg.fromLat == null
          ? from
          : next
        : !needsLiveLeg(
              savedLeg,
              from,
              next,
              Boolean(area) || [from, next].some((s) => s.lat != null && s.lon != null),
            ) && !savedLeg
          ? ([from, next].find((s) => s.lat == null || s.lon == null) ?? null)
          : null
      : null;

  // The countdown only means something on today's plan, once the clock is known.
  const isToday = Boolean(now && next?.day_date === toLocalISODate(now));
  const countdown = isToday && now && leave?.kind === "time" ? leaveCountdown(leave.at, now) : null;
  const leaveLine = next ? (
    <LeaveByLine
      leave={leave}
      dueLabel={timeForRail(next.time_label)}
      countdown={countdown}
      tone={phase === "at" ? "dark" : "light"}
    />
  ) : null;

  const later = next ? dayStops.slice(dayStops.indexOf(next) + 1).filter((s) => !s.arrived_at) : [];
  const [showAllLater, setShowAllLater] = useState(false);
  const laterShown = showAllLater ? later : later.slice(0, LATER_PREVIEW);

  return (
    <div className="space-y-3">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {state.reached} of {state.total} {state.total === 1 ? "stop" : "stops"} reached
      </p>

      {phase !== "done" && <RainAhead stops={dayStops} now={now} />}

      {phase === "at" && current && (
        // The prototype's dark "Current stop" card.
        <section
          className="space-y-2.5 rounded-2xl border border-foreground/80 bg-gradient-to-br from-foreground via-foreground/95 to-foreground p-4 text-background shadow-md sm:p-5"
          aria-labelledby="now-here"
        >
          <div className="flex items-center gap-2">
            <span className="relative flex size-2" aria-hidden>
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[oklch(0.78_0.1_45)] sm:text-xs">
              Current stop
            </span>
            {timeForRail(current.time_label) && (
              <span className="rounded bg-background/10 px-2 py-0.5 font-mono text-xs font-semibold tabular-nums text-background/85 sm:text-sm">
                {timeForRail(current.time_label)}
              </span>
            )}
          </div>
          <h2
            id="now-here"
            className="font-display text-base font-bold leading-snug break-words sm:text-lg md:text-xl"
          >
            {current.title}
          </h2>
          {current.address?.trim() && (
            <p className="-mt-1.5 text-xs text-background/65 sm:text-sm">{current.address}</p>
          )}
          <StayLine stop={current} now={now} tone="dark" />
          {/* When to set off belongs where you are standing, not on the next card. */}
          {leaveLine && <div className="flex">{leaveLine}</div>}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([leavingWrite(current, new Date())]))}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 sm:text-sm bg-primary text-primary-foreground"
            >
              Leaving
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([undoArrivalWrite(current)]))}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 sm:text-sm border border-background/25 text-background/80"
            >
              Not here yet
            </button>
          </div>
        </section>
      )}

      {phase === "between" && previous && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-elevated px-3 py-1.5">
          <p className="text-xs text-muted-foreground">
            Left <span className="font-semibold text-foreground">{previous.title}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() => onProgress([{ id: previous.id, patch: { left_at: null } }]))
            }
            className="px-2 py-1 text-xs font-semibold text-muted-foreground underline underline-offset-2 disabled:opacity-60"
          >
            Still there
          </button>
        </div>
      )}

      {next && (
        <section
          className="space-y-2.5 rounded-2xl border border-border bg-card p-3.5 shadow-2xs sm:p-4"
          aria-labelledby="now-next"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
              <ArrowRight className="size-3.5 text-primary" aria-hidden />
              {phase === "between" ? "On the way to" : phase === "at" ? "Up next stop" : "First up"}
            </p>
            {phase !== "at" && leaveLine}
          </div>
          <div>
            {timeForRail(next.time_label) && (
              <span className="font-mono text-xs font-bold tabular-nums text-primary sm:text-sm">
                {timeForRail(next.time_label)}
              </span>
            )}
            <h2
              id="now-next"
              className="mt-0.5 break-words font-sans text-sm font-bold leading-snug sm:text-base md:text-lg"
            >
              {next.title}
            </h2>
            {next.address?.trim() && (
              <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{next.address}</p>
            )}
            <div className="mt-1.5">
              <PlaceFacts
                name={next.title}
                lat={next.lat}
                lon={next.lon}
                day={next.day_date}
                time={next.time_label}
                auto
              />
            </div>
          </div>
          {live.loading && (
            <p className="text-xs text-muted-foreground">Working out the journey…</p>
          )}
          {offMap && (
            <p className="text-xs text-muted-foreground">
              {offMap.title} isn't on the map yet, so there's no time to leave by. Add its address
              in the Timeline Editor.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() => onProgress(arrivalWrites(dayStops, next.id, new Date())))
              }
              className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 sm:text-sm ${
                phase === "at"
                  ? "border border-border bg-elevated"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              I'm here
            </button>
            <a
              href={mapsPlaceUrl(next.title, { lat: next.lat, lon: next.lon }, next.address)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 sm:text-sm border border-border bg-elevated"
            >
              <MapPin className="size-3.5" aria-hidden />
              Open in maps
            </a>
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="space-y-1.5 rounded-2xl border border-border bg-card p-3.5 shadow-2xs sm:p-4">
          <p className="font-display text-base font-bold leading-snug sm:text-lg">
            That's the day.
          </p>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {state.reached === state.total
              ? "Every stop reached."
              : `${state.reached} of ${state.total} stops reached — the rest were skipped along the way.`}
          </p>
        </section>
      )}

      {later.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
            Later
          </p>
          <ul className="space-y-1">
            {laterShown.map((stop) => (
              <li key={stop.id} className="flex items-baseline gap-3 text-xs sm:text-sm">
                <span className="w-11 shrink-0 font-mono font-semibold tabular-nums text-muted-foreground">
                  {timeForRail(stop.time_label) || "–"}
                </span>
                <span className="min-w-0 break-words">{stop.title}</span>
              </li>
            ))}
          </ul>
          {later.length > LATER_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllLater((v) => !v)}
              aria-expanded={showAllLater}
              className="py-1 text-xs font-semibold text-primary underline underline-offset-2"
            >
              {showAllLater ? "Show fewer" : `Show all ${later.length}`}
            </button>
          )}
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

function LeaveByLine({
  leave,
  dueLabel,
  countdown = null,
  tone = "light",
}: {
  leave: LeaveBy | null;
  dueLabel: string;
  /** Minutes left when leaving is ten minutes away or less; null otherwise. */
  countdown?: number | null;
  tone?: "light" | "dark";
}) {
  const chip =
    tone === "dark" ? "border-primary/40 bg-primary/20" : "border-primary/25 bg-primary/10";
  const aside = tone === "dark" ? "text-background/70" : "text-muted-foreground";
  if (leave?.kind === "time") {
    const how = leave.mode === "walking" ? "walk" : "drive";
    // The last ten minutes: the chip fills in, so a glance is enough.
    const urgent = countdown != null;
    const label = !urgent
      ? `Leave by ${leave.at}`
      : countdown <= 0
        ? "Time to leave"
        : `Leave in ${countdown} min`;
    return (
      <p
        role={urgent ? "status" : undefined}
        className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-2xs sm:px-3 sm:text-sm ${
          urgent ? "border-primary bg-primary text-primary-foreground" : chip
        }`}
      >
        <Clock
          className={`size-3 shrink-0 ${urgent ? "text-primary-foreground" : "text-primary"}`}
          aria-hidden
        />
        <span className={`font-bold ${urgent ? "" : "text-primary"}`}>{label}</span>
        <span className={`text-[10px] sm:text-xs ${urgent ? "text-primary-foreground/85" : aside}`}>
          ({leave.estimated ? "~" : ""}
          {leave.travelMinutes} min {how}
          <span className="sr-only"> for {dueLabel}</span>)
        </span>
      </p>
    );
  }
  // No journey to time — not measured, or pinned to the same spot — but the
  // next stop still has a time to be there by, which is what the chip is for.
  if (!dueLabel) return null;
  return (
    <p
      className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs shadow-2xs sm:px-3 sm:text-sm ${chip}`}
    >
      <Clock className="size-3 shrink-0 text-primary" aria-hidden />
      <span className="font-bold text-primary">Be there by {dueLabel}</span>
      {leave?.kind === "same-spot" && (
        <span className={`text-[10px] sm:text-xs ${aside}`}>(same spot)</span>
      )}
    </p>
  );
}

function StayLine({
  stop,
  now,
  tone = "light",
}: {
  stop: ItineraryRow;
  now: Date | null;
  tone?: "light" | "dark";
}) {
  // Nothing on the server render: the time there depends on this clock.
  const line = now ? stayLine(stop, now) : null;
  return line ? (
    <p
      className={`text-xs sm:text-sm ${tone === "dark" ? "text-background/75" : "text-muted-foreground"}`}
    >
      {line}
    </p>
  ) : null;
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
  area: string | undefined,
): { leg: RouteLeg | null; loading: boolean } {
  const route = useServerFn(buildRoutes);
  // Where to look up an end without a pin: around the end that has one —
  // a day in Hiroshima on a trip set to Kyoto — else in the trip's area.
  const pinned = [from, to].find(
    (s): s is ItineraryRow & { lat: number; lon: number } =>
      s != null && s.lat != null && s.lon != null && (s.lat !== 0 || s.lon !== 0),
  );
  const canLookUp = Boolean(area) || Boolean(pinned);
  const wanted =
    from && to && needsLiveLeg(savedLeg, from, to, canLookUp) ? liveLegKey(from, to) : null;
  const [, rerender] = useState(0);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!wanted || !from || !to || liveLegs.has(wanted)) return;
    let cancelled = false;
    setLoadingKey(wanted);
    route({
      data: {
        stops: [
          {
            title: from.title,
            address: from.address,
            day_date: from.day_date,
            lat: from.lat,
            lon: from.lon,
          },
          { title: to.title, address: to.address, day_date: to.day_date, lat: to.lat, lon: to.lon },
        ],
        ...(pinned ? { near: { lat: pinned.lat, lon: pinned.lon } } : area ? { area } : {}),
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
/**
 * A quiet word when rain is likely later in the day, where the day is.
 *
 * The place is the first pinned stop still ahead (or the first pinned stop
 * of the day), and the forecast is asked once per place and day; the clock
 * then moves the notice on as spells pass. Offline, or with no forecast for
 * the day, it shows nothing — the plan never waits on the weather.
 */
function RainAhead({ stops, now }: { stops: ItineraryRow[]; now: Date | null }) {
  // 0,0 is a missing place, not the Gulf of Guinea.
  const pinned = (s: ItineraryRow) =>
    s.lat != null && s.lon != null && !(s.lat === 0 && s.lon === 0);
  const spot = stops.find((s) => !s.arrived_at && pinned(s)) ?? stops.find(pinned);
  const day = stops.find((s) => s.day_date)?.day_date ?? null;
  const lat = spot?.lat ?? null;
  const lon = spot?.lon ?? null;
  const ask = useServerFn(lookupRain);
  const [forecast, setForecast] = useState<RainForecast | null>(null);

  useEffect(() => {
    setForecast(null);
    if (lat == null || lon == null || !day) return;
    // A day already behind the phone's clock has no rain left to warn about.
    if (day < toLocalISODate(new Date())) return;
    let active = true;
    ask({ data: { lat, lon, day } })
      .then((f) => {
        if (active) setForecast(f);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ask, lat, lon, day]);

  const notice = forecast && day && now ? rainNotice(forecast, day, now) : null;
  if (!notice) return null;
  return (
    <p
      role="status"
      className="flex items-start gap-2 rounded-xl border border-border bg-elevated px-3 py-2 text-xs sm:text-sm"
    >
      <CloudRain className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        {rainLine(notice)}{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          title={WEATHER_ATTRIBUTION}
          className="text-[10px] text-muted-foreground underline underline-offset-2 sm:text-xs"
        >
          Open-Meteo
        </a>
      </span>
    </p>
  );
}

function useMinuteClock(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

/** The rest of a long day stays one tap away rather than filling the screen. */
const LATER_PREVIEW = 5;
