import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Clock, CloudRain, MapPin, Ticket } from "@/components/icons";
import { bookingAtHand } from "@/lib/bookings";
import { useBeaSays } from "@/components/day/bea-says";
import { BeaSays, LegIcon, StopArt, StopDisc } from "@/components/day/stop-bits";
import { legWords, measured } from "@/components/day/stop-words";
import { stayLabel } from "@/lib/planned-stay";
import { PlaceFacts } from "@/components/PlaceFacts";
import type { ItineraryRow } from "@/hooks/useTrips";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { timeForRail } from "@/lib/timeline-kind";
import { lookupRain } from "@/lib/weather.functions";
import {
  rainDayMayBeAhead,
  rainLine,
  rainNotice,
  WEATHER_ATTRIBUTION,
  type RainForecast,
} from "@/lib/weather";
import {
  arrivalWrites,
  clockMinutes,
  companionState,
  leaveBy,
  leaveCountdown,
  leavingWrite,
  legBetween,
  placeClock,
  placeClockNote,
  liveLegKey,
  needsLiveLeg,
  stayLine,
  undoArrivalWrite,
  type LeaveBy,
} from "@/lib/companion";
import type { TravelChoice } from "@/lib/travel-mode";

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
  travel = "auto",
  bookingDocs = [],
  onProgress,
  progress,
  onLook,
}: {
  /** The chosen day's stops, in order, without Walk / Drive rows. */
  dayStops: ItineraryRow[];
  /** The whole trip's stops in the same shape, which saved legs index into. */
  tripStops: ItineraryRow[];
  /** The measured leg out of each of `tripStops`, where there is one. */
  legs: readonly (RouteLeg | undefined)[] | null;
  /** The trip's area, so a stop without a pin can be looked up to time the journey. */
  area?: string | undefined;
  /** How the traveller gets around, for a journey routed here. */
  travel?: TravelChoice | undefined;
  /** Trip documents, so a confirmation filed to a stop is at hand there. */
  bookingDocs?: readonly {
    itinerary_item_id: string | null;
    reference: string | null;
    title: string;
  }[];
  onProgress: (writes: Write[]) => Promise<void>;
  /** Today's progress, drawn after the next stop as in the master. */
  progress?: ReactNode;
  /** Look at a later stop without moving Now. */
  onLook?: ((id: string) => void) | undefined;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const now = useMinuteClock();
  const forecast = useDayForecast(dayStops);
  // The plan's times are the place's; read "now" there when the forecast
  // says what the place's clock is.
  const offset = forecast?.utcOffsetSeconds ?? null;

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
  const live = useLiveLeg(savedLeg, from, next, area, travel);
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
  const isToday = Boolean(now && next?.day_date === placeClock(now, offset).day);
  const countdown =
    isToday && now && leave?.kind === "time" ? leaveCountdown(leave.at, now, 10, offset) : null;
  const clockNote = isToday && now ? placeClockNote(now, offset) : null;
  const directionsHref = next
    ? leg?.mapUrl || mapsPlaceUrl(next.title, { lat: next.lat, lon: next.lon }, next.address)
    : "";
  const leavePanel = next ? (
    <LeavePanel
      leave={leave}
      dueLabel={timeForRail(next.time_label)}
      countdown={countdown}
      leg={leg}
      href={directionsHref}
      nextTitle={next.title}
    />
  ) : null;
  const says = useBeaSays(current && phase === "at" ? current : null, next, leave);

  const later = next ? dayStops.slice(dayStops.indexOf(next) + 1).filter((s) => !s.arrived_at) : [];
  const [showAllLater, setShowAllLater] = useState(false);
  const laterShown = showAllLater ? later : later.slice(0, LATER_PREVIEW);
  const navigate = next ? (
    <a
      href={mapsPlaceUrl(next.title, { lat: next.lat, lon: next.lon }, next.address)}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex min-h-10 items-center gap-1 rounded-full px-4 text-[14px] font-semibold shadow-2xs transition-all active:scale-95 ${
        phase === "at" ? "bg-primary text-primary-foreground" : "border border-border bg-card"
      }`}
    >
      Navigate
      <ChevronRight className="size-4" aria-hidden />
      <span className="sr-only">: open {next.title} in maps</span>
    </a>
  ) : null;

  return (
    <div className="space-y-3">
      {phase !== "done" && <RainAhead stops={dayStops} forecast={forecast} now={now} />}
      {clockNote && phase !== "done" && (
        <p className="plain-card flex items-center gap-2 px-3 py-2 text-[13px]">
          <Clock className="size-3.5 shrink-0 text-primary" aria-hidden />
          {clockNote}
        </p>
      )}

      {phase === "at" && current && (
        <section className="plain-card space-y-3 p-3.5" aria-labelledby="now-here">
          <div className="flex items-start justify-between gap-2">
            <p className="flex items-center gap-2 pt-1 text-[13px] font-bold uppercase tracking-wide text-primary">
              <span className="relative flex size-3" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:animate-none" />
                <span className="relative inline-flex size-3 rounded-full bg-primary" />
              </span>
              You are here
              {timeForRail(current.time_label) && (
                <span className="font-semibold tabular-nums text-foreground">
                  {timeForRail(current.time_label)}
                </span>
              )}
            </p>
            {current.planned_stay_minutes ? (
              <p className="tile-fill-4 shrink-0 rounded-xl border border-border/60 px-2.5 py-1 text-right leading-tight">
                <span className="block text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Planned stay
                </span>
                <span className="block text-[15px] font-semibold">
                  {stayLabel(current.planned_stay_minutes)}
                </span>
              </p>
            ) : null}
          </div>
          <div className="flex items-start gap-3">
            <StopArt item={current} className="aspect-square w-[38%] max-w-[160px] rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 id="now-here" className="break-words font-display text-[25px] leading-[1.05]">
                {current.title}
              </h2>
              {current.address?.trim() && (
                <p className="mt-1.5 flex items-start gap-1 text-[13px] text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">{current.address}</span>
                </p>
              )}
              <StayLine stop={current} now={now} />
            </div>
          </div>
          <BookingAtHandCard stop={current} docs={bookingDocs} />
          {says && <BeaSays line={says} />}
          {/* When to set off belongs where you are standing, not on the next card. */}
          {leavePanel}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([leavingWrite(current, new Date())]))}
              className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 text-[14px] font-semibold text-primary-foreground shadow-2xs transition-all active:scale-95 disabled:opacity-60"
            >
              Leaving
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([undoArrivalWrite(current)]))}
              className="inline-flex min-h-10 items-center rounded-full border border-border bg-card px-4 text-[14px] font-semibold text-muted-foreground transition-all active:scale-95 disabled:opacity-60"
            >
              Not here yet
            </button>
          </div>
        </section>
      )}

      {phase === "between" && previous && (
        <div className="plain-card flex flex-wrap items-center justify-between gap-2 px-3.5 py-2">
          <p className="text-[13px] text-muted-foreground">
            Left <span className="font-semibold text-foreground">{previous.title}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() => onProgress([{ id: previous.id, patch: { left_at: null } }]))
            }
            className="min-h-9 px-2 text-[13px] font-semibold text-primary underline underline-offset-2 disabled:opacity-60"
          >
            Still there
          </button>
        </div>
      )}

      {next && (
        <section className="plain-card space-y-3 p-3.5" aria-labelledby="now-next">
          <div className="flex items-start gap-3">
            <StopArt item={next} className="h-[84px] w-[104px] rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                {phase === "between" ? "On the way to" : phase === "at" ? "Next stop" : "First up"}
                {timeForRail(next.time_label) && (
                  <span className="ml-2 font-bold tabular-nums text-primary">
                    {timeForRail(next.time_label)}
                  </span>
                )}
              </p>
              <h2
                id="now-next"
                className="mt-0.5 break-words font-display text-[22px] leading-[1.08]"
              >
                {next.title}
              </h2>
              {next.address?.trim() && (
                <p className="mt-1 flex items-start gap-1 text-[12.5px] text-muted-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="min-w-0">{next.address}</span>
                </p>
              )}
            </div>
            {phase === "at" && measured(leg) && <LegPill leg={leg} />}
          </div>
          <BookingAtHandCard stop={next} docs={bookingDocs} />
          <PlaceFacts
            name={next.title}
            lat={next.lat}
            lon={next.lon}
            day={next.day_date}
            time={next.time_label}
            auto
          />
          {phase !== "at" && leavePanel}
          {live.loading && (
            <p className="text-[12.5px] text-muted-foreground">Working out the journey…</p>
          )}
          {offMap && (
            <p className="text-[12.5px] text-muted-foreground">
              {offMap.title} isn't on the map yet, so there's no time to leave by. Add its address
              in the Timeline Editor.
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() => onProgress(arrivalWrites(dayStops, next.id, new Date())))
              }
              className={`inline-flex min-h-10 items-center rounded-full px-4 text-[14px] font-semibold shadow-2xs transition-all active:scale-95 disabled:opacity-60 ${
                phase === "at"
                  ? "border border-border bg-card"
                  : "bg-primary text-primary-foreground"
              }`}
            >
              I'm here
            </button>
            {navigate}
          </div>
        </section>
      )}

      {phase === "done" && (
        <section className="plain-card space-y-1 p-4">
          <p className="font-display text-[24px] leading-tight">That's the day.</p>
          <p className="text-[13.5px] text-muted-foreground">
            {state.reached === state.total
              ? "Every stop reached."
              : `${state.reached} of ${state.total} stops reached — the rest were skipped along the way.`}
          </p>
        </section>
      )}

      {progress}

      {later.length > 0 && (
        <section aria-labelledby="now-later">
          <p
            id="now-later"
            className="mb-2 px-0.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"
          >
            Later today
          </p>
          <ul className="plain-card divide-y divide-border overflow-hidden">
            {laterShown.map((stop) => {
              const number = dayStops.indexOf(stop) + 1;
              const row = (
                <>
                  <StopDisc number={number} />
                  <StopArt item={stop} className="size-12 rounded-xl" />
                  <span className="w-12 shrink-0 text-[14px] font-bold tabular-nums text-primary">
                    {timeForRail(stop.time_label) || "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[14.5px] leading-snug">
                      {stop.title}
                    </span>
                    {stop.planned_stay_minutes ? (
                      <span className="block text-[12px] text-muted-foreground">
                        {stayLabel(stop.planned_stay_minutes)}
                      </span>
                    ) : null}
                  </span>
                </>
              );
              return (
                <li key={stop.id}>
                  {onLook ? (
                    <button
                      type="button"
                      onClick={() => onLook(stop.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                    >
                      {row}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 px-3 py-2">{row}</div>
                  )}
                </li>
              );
            })}
          </ul>
          {later.length > LATER_PREVIEW && (
            <button
              type="button"
              onClick={() => setShowAllLater((v) => !v)}
              aria-expanded={showAllLater}
              className="mt-1 py-1 text-[13px] font-semibold text-primary underline underline-offset-2"
            >
              {showAllLater ? "Show fewer" : `Show all ${later.length}`}
            </button>
          )}
        </section>
      )}

      {error && (
        <p role="alert" className="text-[13px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * The confirmation number and booking notes, where you will need them: at
 * the door. Said only for a stop that is booked or has a document filed to it.
 */
function BookingAtHandCard({
  stop,
  docs,
}: {
  stop: ItineraryRow;
  docs: readonly { itinerary_item_id: string | null; reference: string | null; title: string }[];
}) {
  const booking = bookingAtHand(stop, docs);
  if (!booking) return null;
  return (
    <div className="tile-fill-3 flex items-start gap-2.5 rounded-2xl border border-border/60 px-3 py-2.5">
      <Ticket className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0 flex-1 text-[13.5px] leading-snug">
        <p className="font-semibold">
          Booked
          {booking.reference ? (
            <>
              {" · "}
              <span className="select-all font-mono tabular-nums">{booking.reference}</span>
            </>
          ) : null}
        </p>
        {booking.details ? (
          <p className="mt-0.5 whitespace-pre-line break-words text-muted-foreground">
            {booking.details}
          </p>
        ) : null}
        {booking.documents.length ? (
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            In Bookings: {booking.documents.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/** The walk or drive to the next stop, as a small pill. */
function LegPill({ leg }: { leg: RouteLeg }) {
  const words = legWords(leg);
  return (
    <p className="tile-fill-2 flex shrink-0 items-center gap-1.5 rounded-xl border border-border/60 px-2.5 py-1.5 leading-tight">
      <LegIcon walking={words.walking} mode={words.mode} className="size-5" />
      <span>
        <span className="block text-[14px] font-bold">{words.time}</span>
        <span className="block text-[11.5px] text-muted-foreground">{words.distance}</span>
      </span>
    </p>
  );
}

/**
 * "Leave by 09:06 | 9 min walk · 426 m | ›" — the master's soft panel, and a
 * tap on it opens the way there in maps. The time is shown only when both
 * halves are real (a clock time on the next stop and a routed leg); otherwise
 * it says when to be there by, and the journey half appears once measured.
 */
function LeavePanel({
  leave,
  dueLabel,
  countdown = null,
  leg,
  href,
  nextTitle,
}: {
  leave: LeaveBy | null;
  dueLabel: string;
  /** Minutes left when leaving is ten minutes away or less; null otherwise. */
  countdown?: number | null;
  leg: RouteLeg | null;
  href: string;
  nextTitle: string;
}) {
  const timed = leave?.kind === "time" ? leave : null;
  const urgent = timed != null && countdown != null;
  const label = timed
    ? !urgent
      ? "Leave by"
      : countdown <= 0
        ? "Time to leave"
        : `Leave in ${countdown} min`
    : dueLabel
      ? "Be there by"
      : "";
  const big = timed ? timed.at : dueLabel;
  const words = measured(leg) ? legWords(leg) : null;
  if (!big && !words) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      role={urgent ? "status" : undefined}
      aria-label={`${label} ${big}${words ? `, ${words.time} ${words.how}` : ""} to ${nextTitle} — directions in maps`}
      className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
        urgent ? "bg-primary text-primary-foreground" : "bg-primary-soft"
      }`}
    >
      {big ? (
        <span className="flex min-w-0 items-center gap-2">
          <Clock className={`size-7 shrink-0 ${urgent ? "" : "text-primary"}`} aria-hidden />
          <span className="leading-tight">
            <span className={`block text-[12.5px] ${urgent ? "" : "text-primary"}`}>{label}</span>
            <span
              className={`block text-[26px] font-bold tabular-nums leading-none ${urgent ? "" : "text-primary"}`}
            >
              {big}
            </span>
          </span>
        </span>
      ) : null}
      {big && words ? <span aria-hidden className="h-9 w-px shrink-0 bg-border" /> : null}
      {words ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <LegIcon walking={words.walking} mode={words.mode} className="size-6 shrink-0" />
          <span className="leading-tight">
            <span className="block text-[14px]">
              {words.time} {words.how}
            </span>
            <span className={`block text-[12px] ${urgent ? "" : "text-muted-foreground"}`}>
              {words.distance}
            </span>
          </span>
        </span>
      ) : (
        <span className="flex-1 text-[12.5px] text-muted-foreground">
          {leave?.kind === "same-spot" ? "Same spot" : ""}
        </span>
      )}
      <ChevronRight className={`size-5 shrink-0 ${urgent ? "" : "text-primary"}`} aria-hidden />
    </a>
  );
}

function StayLine({ stop, now }: { stop: ItineraryRow; now: Date | null }) {
  // Nothing on the server render: the time there depends on this clock.
  const line = now ? stayLine(stop, now) : null;
  return line ? (
    <p className="mt-1 text-[12.5px] font-semibold text-muted-foreground">{line}</p>
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
  travel: TravelChoice,
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
    from && to && needsLiveLeg(savedLeg, from, to, canLookUp)
      ? `${liveLegKey(from, to)}|${travel}`
      : null;
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
        travel,
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
function RainAhead({
  stops,
  forecast,
  now,
}: {
  stops: ItineraryRow[];
  forecast: RainForecast | null;
  now: Date | null;
}) {
  const day = stops.find((s) => s.day_date)?.day_date ?? null;
  const notice = forecast && day && now ? rainNotice(forecast, day, now) : null;
  if (!notice) return null;
  return (
    <p role="status" className="plain-card flex items-start gap-2 px-3 py-2 text-[13px]">
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

/**
 * The hour-by-hour forecast for the day, where the day is: the first pinned
 * stop still ahead (or the first pinned stop of the day). Asked once per
 * place and day. It carries the place's offset from UTC as well as the rain,
 * so Now can read the clock at the place.
 */
function useDayForecast(stops: ItineraryRow[]): RainForecast | null {
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
    // A day over everywhere has no rain left to warn about. Not the phone's
    // date: the stop may be in a time zone still on that day.
    if (!rainDayMayBeAhead(day, new Date())) return;
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

  return forecast;
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
