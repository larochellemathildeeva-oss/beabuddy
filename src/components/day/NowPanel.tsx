import { useEffect, useState, type ReactNode } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bed, ChevronRight, Clock, CloudRain, MapPin, Ticket } from "@/components/icons";
import { bookingAtHand, isBooked } from "@/lib/bookings";
import { remindersFor, type ReminderItem } from "@/lib/reminders";
import { EASE_PRESETS, type EasePreset } from "@/lib/day-ease";
import { parseLocalDate } from "@/lib/trip-dates";
import { useBeaSays } from "@/components/day/bea-says";
import { BeaSays, KindIcon, StopArt, StopDisc } from "@/components/day/stop-bits";
import { legWords, measured } from "@/components/day/stop-words";
import { stayLabel } from "@/lib/planned-stay";
import { PlaceFacts } from "@/components/PlaceFacts";
import { FollowAlong, FromHereLine } from "@/components/day/FollowAlong";
import { QuickPhoto, type StopPhotosProps } from "@/components/day/StopPhotos";
import type { ItineraryRow } from "@/hooks/useTrips";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { mapsDirUrl, mapsPlaceUrl } from "@/lib/direction-stops";
import { arrivalHelp, type ArrivalStop } from "@/lib/arrival-help";
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
 *
 * "Follow along", when the traveller turns it on, watches the phone's
 * position while this screen is open and offers those same taps ("Looks
 * like you're at…") with the time to the next stop from where they are. It
 * offers; the tap still decides.
 */
export function NowPanel({
  dayStops,
  tripStops,
  legs,
  area,
  travel = "auto",
  bookingDocs = [],
  reminderItems = [],
  nextDay = null,
  onEase,
  onRework,
  onProgress,
  progress,
  onLook,
  photosFor,
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
  /** Every entry on the trip, for the bookings and departures coming up. */
  reminderItems?: readonly (ReminderItem & ArrivalStop & { position: number })[];
  /** The trip's next day with stops after this one, for "Make tomorrow easier". */
  nextDay?: string | null;
  /** Run one of Optimize's one-tap requests on a day. */
  onEase?: ((preset: EasePreset, day: string, dayLabel: string) => void) | undefined;
  /** Open "Change a day" on a day, with words already typed. */
  onRework?: ((day: string, ask: string) => void) | undefined;
  onProgress: (writes: Write[]) => Promise<void>;
  /** Today's progress, drawn after the next stop as in the master. */
  progress?: ReactNode;
  /** Look at a later stop without moving Now. */
  onLook?: ((id: string) => void) | undefined;
  /** A stop's photos and adding one, for "Take photo" where you are. */
  photosFor?: ((stop: ItineraryRow) => StopPhotosProps) | undefined;
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

  const act = async (write: () => Promise<void>): Promise<boolean> => {
    setBusy(true);
    setError("");
    try {
      await write();
      return true;
    } catch {
      setError("That didn't save. Check your connection and try again.");
      return false;
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
  const reminders = now ? remindersFor(reminderItems, placeClock(now, offset)) : [];
  const thisDay = dayStops.find((s) => s.day_date)?.day_date ?? null;
  const placeDay = now ? placeClock(now, offset).day : null;
  // Once today is done, the easing is for the next day; before that, this one.
  const easeTarget = phase === "done" ? nextDay : thisDay;
  // The way in from the airport or station, on a day that lands somewhere to sleep.
  const arrival = thisDay
    ? arrivalHelp(
        [...reminderItems]
          .filter((i) => i.day_date === thisDay)
          .sort((a, b) => a.position - b.position),
      )
    : null;
  const arrivalOpen = arrival && !dayStops.find((s) => s.id === arrival.stay.id)?.arrived_at;
  const easeLabel = easeTarget ? dayLabelFor(easeTarget, placeDay) : "";
  // Following along means something only on the day itself, while it lasts.
  const followable = Boolean(thisDay && placeDay && thisDay === placeDay && phase !== "done");
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

  const focus = phase === "at" ? current : phase === "done" ? null : next;
  const tail = focus
    ? dayStops.slice(dayStops.indexOf(focus) + 1).filter((stop) => !stop.arrived_at)
    : [];
  // Between stops the card already is the place you are going to.
  const rowNext = phase === "at" ? next : phase === "not-started" ? (tail[0] ?? null) : null;
  const later = tail.filter((stop) => stop !== rowNext);
  const [showAllLater, setShowAllLater] = useState(false);
  const laterShown = showAllLater ? later : later.slice(0, LATER_PREVIEW);
  const words = measured(leg) ? legWords(leg) : null;
  const journeyLine = words
    ? `${words.time} ${words.how} · ${words.distance}`
    : leave?.kind === "same-spot"
      ? "Same spot"
      : "";

  const navigateTo = (stop: ItineraryRow) => (
    <a
      href={mapsPlaceUrl(stop.title, { lat: stop.lat, lon: stop.lon }, stop.address)}
      target="_blank"
      rel="noreferrer"
      className={softBtn}
    >
      Navigate
      <ChevronRight className="size-4" aria-hidden />
      <span className="sr-only">: open {stop.title} in maps</span>
    </a>
  );

  const journeyNotes = (
    <>
      {journeyLine && !leavePanel ? (
        <p className="text-[14px] text-muted-foreground">{journeyLine}</p>
      ) : null}
      {isToday && now && next && (
        <FromHereLine
          next={next}
          travel={travel}
          nowMinutes={placeClock(now, offset).minutes}
          atAStop={phase === "at"}
        />
      )}
      {live.loading && (
        <p className="text-[14px] text-muted-foreground">Working out the journey…</p>
      )}
      {offMap && (
        <p className="text-[14px] text-muted-foreground">
          {offMap.title} isn't on the map yet, so there's no time to leave by. Add its address in
          the Timeline.
        </p>
      )}
      {phase !== "at" && leavePanel}
    </>
  );

  return (
    <div className="space-y-3">
      {reminders.length > 0 && (
        <ul role="status" aria-label="Coming up" className="space-y-1.5">
          {reminders.map((r) => (
            <li
              key={r.id}
              className={`flex items-center gap-2 rounded-2xl px-3 py-2 text-[14px] font-semibold ${
                r.when === "soon"
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary-soft text-primary"
              }`}
            >
              <Clock className="size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{r.text}</span>
            </li>
          ))}
        </ul>
      )}
      {arrival && arrivalOpen && (
        <section aria-labelledby="now-arrival" className="plain-card space-y-2 p-4">
          <p
            id="now-arrival"
            className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
          >
            <Bed className="size-4 text-primary" aria-hidden />
            Arrival
          </p>
          <p className="text-[16px] leading-snug">
            From <span className="font-semibold">{arrival.from.title}</span> to{" "}
            <span className="font-semibold">{arrival.stay.title}</span>
            {arrival.checkIn ? (
              <span className="text-muted-foreground"> · check-in from {arrival.checkIn}</span>
            ) : null}
          </p>
          {arrival.stay.address?.trim() && (
            <p className="flex items-start gap-1 text-[14px] text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="min-w-0">{arrival.stay.address}</span>
            </p>
          )}
          <a
            href={mapsDirUrl(arrival.from, arrival.stay, area ?? "", "transit")}
            target="_blank"
            rel="noreferrer"
            className={primaryBtn}
          >
            The way there, by transit
            <ChevronRight className="size-4" aria-hidden />
          </a>
        </section>
      )}
      {phase !== "done" && (
        <RainAhead
          stops={dayStops}
          forecast={forecast}
          now={now}
          {...(onRework && thisDay
            ? {
                onSwap: (from: string, until: string | null) =>
                  onRework(
                    thisDay,
                    `Rain is forecast ${until ? `from ${from} to ${until}` : `from ${from}`}: swap the outdoor stops in that time for indoor places nearby.`,
                  ),
              }
            : {})}
        />
      )}
      {clockNote && phase !== "done" && (
        <p className="plain-card flex items-center gap-2 px-3 py-2 text-[14px]">
          <Clock className="size-4 shrink-0 text-primary" aria-hidden />
          {clockNote}
        </p>
      )}

      {followable && (
        <FollowAlong
          dayStops={dayStops}
          busy={busy}
          now={now}
          onArrive={(stop) => act(() => onProgress(arrivalWrites(dayStops, stop.id, new Date())))}
          onLeave={(stop) => void act(() => onProgress([leavingWrite(stop, new Date())]))}
        />
      )}

      {phase === "at" && current && (
        <>
          <section
            className="plain-card trip-focus-card now-current p-3"
            aria-labelledby="now-here"
          >
            <div className="flex items-stretch gap-3">
              <StopArt item={current} className="h-[150px] w-[112px] rounded-[18px]" />
              <div className="min-w-0 flex-1 py-1">
                <p className="now-current-label">Current stop</p>
                <h2
                  id="now-here"
                  className="mt-1 flex items-start gap-2 break-words font-display text-[24px] leading-[1.1]"
                >
                  <span className="now-live-dot" aria-hidden />
                  <span className="min-w-0">{current.title}</span>
                </h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {current.planned_stay_minutes ? (
                    <span className="now-chip">
                      <Clock className="size-3.5" aria-hidden />
                      {stayLabel(current.planned_stay_minutes)}
                    </span>
                  ) : null}
                  <span className="now-chip">Here now</span>
                </div>
                {current.address?.trim() && (
                  <p className="mt-2 flex items-start gap-1 text-[13px] leading-snug text-muted-foreground">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0">{current.address}</span>
                  </p>
                )}
                <StayLine stop={current} now={now} />
              </div>
            </div>
            <BookingAtHandCard stop={current} docs={bookingDocs} />
          </section>
          {rowNext && (
            <StopCircles
              stops={[rowNext, ...later.slice(0, 2)]}
              nowMinutes={now ? placeClock(now, offset).minutes : null}
              onLook={onLook}
            />
          )}
          {leavePanel}
          <div className="now-tools" role="group" aria-label="This stop">
            <a
              href={directionsHref}
              target="_blank"
              rel="noreferrer"
              className="now-tool now-tool-pink"
            >
              <MapPin className="size-5" aria-hidden />
              <span>Directions</span>
              <span className="sr-only">: open {next?.title ?? current.title} in maps</span>
            </a>
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([leavingWrite(current, new Date())]))}
              className="now-tool now-tool-blue"
            >
              <ChevronRight className="size-5" aria-hidden />
              <span>Leaving</span>
            </button>
            {photosFor && (
              <span className="now-tool now-tool-yellow">
                <QuickPhoto photos={photosFor(current)} />
                <span>Photo</span>
              </span>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => void act(() => onProgress([undoArrivalWrite(current)]))}
              className="now-tool now-tool-lilac"
            >
              <Clock className="size-5" aria-hidden />
              <span>Not here yet</span>
            </button>
          </div>
          {says && (
            <section className="plain-card now-note p-3" aria-label="A note from Béa">
              <p className="now-note-title">A note from Béa</p>
              <BeaSays line={says} />
            </section>
          )}
          {rowNext && (
            <section className="plain-card p-4">
              <NextRow
                stop={rowNext}
                kicker="Next stop"
                meta={[timeForRail(rowNext.time_label), isBooked(rowNext) ? "Booked" : ""]
                  .filter(Boolean)
                  .join(" · ")}
                onLook={onLook}
              >
                {journeyNotes}
                <PlaceFacts
                  name={rowNext.title}
                  lat={rowNext.lat}
                  lon={rowNext.lon}
                  day={rowNext.day_date}
                  time={rowNext.time_label}
                  auto
                />
                <BookingAtHandCard stop={rowNext} docs={bookingDocs} />
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(() => onProgress(arrivalWrites(dayStops, rowNext.id, new Date())))
                    }
                    className={softBtn}
                  >
                    I'm here
                  </button>
                  {navigateTo(rowNext)}
                </div>
              </NextRow>
            </section>
          )}
        </>
      )}

      {phase === "between" && previous && (
        <div className="plain-card flex flex-wrap items-center justify-between gap-2 px-4 py-2">
          <p className="text-[16px] text-muted-foreground">
            Left <span className="font-semibold text-foreground">{previous.title}</span>
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() => onProgress([{ id: previous.id, patch: { left_at: null } }]))
            }
            className={linkBtn}
          >
            Still there
          </button>
        </div>
      )}

      {focus && phase !== "at" && phase !== "done" && (
        <section className="plain-card trip-focus-card space-y-3 p-4" aria-labelledby="now-next">
          <StopKicker
            live={phase === "between"}
            label={phase === "between" ? "On the way to" : "First up"}
            aside={timeForRail(focus.time_label)}
          />
          <div className="flex items-start gap-3">
            <StopArt item={focus} className="h-[104px] w-[78px] rounded-2xl" />
            <div className="min-w-0 flex-1">
              <h2 id="now-next" className="break-words font-display text-[28px] leading-[1.1]">
                {focus.title}
              </h2>
              {focus.address?.trim() && (
                <p className="mt-1.5 flex items-start gap-1 text-[14px] text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span className="min-w-0">{focus.address}</span>
                </p>
              )}
            </div>
          </div>
          <BookingAtHandCard stop={focus} docs={bookingDocs} />
          <PlaceFacts
            name={focus.title}
            lat={focus.lat}
            lon={focus.lon}
            day={focus.day_date}
            time={focus.time_label}
            auto
          />
          {journeyNotes}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void act(() => onProgress(arrivalWrites(dayStops, focus.id, new Date())))
              }
              className={primaryBtn}
            >
              I'm here
            </button>
            {navigateTo(focus)}
          </div>
          {rowNext && (
            <NextRow
              stop={rowNext}
              kicker="Next stop"
              meta={timeForRail(rowNext.time_label)}
              onLook={onLook}
            />
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="plain-card space-y-1 p-4">
          <p className="font-display text-[28px] leading-tight">That's the day.</p>
          <p className="text-[16px] leading-snug text-muted-foreground">
            {state.reached === state.total
              ? "Every stop reached."
              : `${state.reached} of ${state.total} stops reached — the rest were skipped along the way.`}
          </p>
        </section>
      )}

      {progress}

      {later.length > 0 && (
        <section aria-labelledby="now-later" className="plain-card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="now-later" className="font-display text-[22px] leading-tight">
              Later today
            </h2>
            <p className="text-[14px] text-muted-foreground">
              {later.length} more {later.length === 1 ? "stop" : "stops"}
            </p>
          </div>
          <p className="mt-1 text-[16px] leading-snug">
            {later.map((stop) => stop.title).join(", ")}.
            {later.some(isBooked) ? ` ${later.filter(isBooked).length} booked.` : ""}
            {timeForRail(later[later.length - 1]?.time_label)
              ? ` Last one at ${timeForRail(later[later.length - 1]!.time_label)}.`
              : ""}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {laterShown.map((stop) => {
              const number = dayStops.indexOf(stop) + 1;
              const row = (
                <>
                  <StopDisc number={number} className="size-8 text-[14px]" />
                  <span className="w-14 shrink-0 text-[14px] font-semibold tabular-nums text-primary">
                    {timeForRail(stop.time_label) || "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words font-display text-[17px] leading-snug">
                      {stop.title}
                    </span>
                    {stop.planned_stay_minutes ? (
                      <span className="block text-[14px] text-muted-foreground">
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
                      className="flex min-h-11 w-full items-center gap-2.5 py-2 text-left"
                    >
                      {row}
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  ) : (
                    <div className="flex items-center gap-2.5 py-2">{row}</div>
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
              className="mt-1 min-h-11 text-[16px] font-semibold text-primary underline underline-offset-2"
            >
              {showAllLater ? "Show fewer" : `Show all ${later.length}`}
            </button>
          )}
        </section>
      )}

      {onEase && easeTarget && (
        <section aria-labelledby="now-ease" className="plain-card space-y-2 p-4">
          <h2 id="now-ease" className="font-display text-[22px] leading-tight">
            Make {easeLabel} easier
          </h2>
          <div className="flex flex-wrap gap-2">
            {EASE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onEase(preset, easeTarget, easeLabel)}
                className="min-h-11 rounded-full border border-border bg-card px-3 text-[16px] font-medium"
              >
                {preset.label}
              </button>
            ))}
          </div>
          <p className="text-[16px] leading-snug text-muted-foreground">
            Béa rearranges that day only, keeps every booking where it is, and shows you the change
            before anything is saved.
          </p>
        </section>
      )}

      {error && (
        <p role="alert" className="text-[16px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

const primaryBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-4 text-[16px] font-semibold text-primary-foreground shadow-xs transition-all active:scale-95 disabled:opacity-60";
const softBtn =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border bg-card px-4 text-[16px] font-semibold shadow-xs transition-all active:scale-95 disabled:opacity-60";
const linkBtn =
  "inline-flex min-h-11 items-center px-1 text-[16px] font-medium text-muted-foreground underline underline-offset-2 disabled:opacity-60";

function StopCircles({
  stops,
  nowMinutes,
  onLook,
}: {
  stops: ItineraryRow[];
  nowMinutes: number | null;
  onLook?: ((id: string) => void) | undefined;
}) {
  return (
    <ol className="now-circles" aria-label="Coming up">
      {stops.map((stop, i) => {
        const at = clockMinutes(stop.time_label);
        const sub =
          i === 0
            ? "Next"
            : nowMinutes != null && at != null && at > nowMinutes
              ? `In ${stayLabel(at - nowMinutes)}`
              : timeForRail(stop.time_label) || "Later";
        const body = (
          <>
            <StopArt item={stop} className="size-14 rounded-full" />
            <span className="now-circle-name">{stop.title}</span>
            <span className="now-circle-sub">{sub}</span>
          </>
        );
        return (
          <li key={stop.id}>
            {onLook ? (
              <button type="button" onClick={() => onLook(stop.id)} className="now-circle">
                {body}
              </button>
            ) : (
              <div className="now-circle">{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function StopKicker({ live, label, aside }: { live?: boolean; label: string; aside?: string }) {
  return (
    <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {live ? (
        <span className="relative flex size-2.5" aria-hidden>
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-50 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
        </span>
      ) : null}
      <span>{label}</span>
      {aside ? (
        <span className="ml-auto text-[14px] font-medium normal-case tracking-normal text-muted-foreground">
          {aside}
        </span>
      ) : null}
    </p>
  );
}

function NextTitle({
  kicker,
  title,
  meta,
}: {
  kicker: string;
  title: string;
  meta?: string | undefined;
}) {
  return (
    <>
      <span className="block text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {kicker}
      </span>
      <span className="block break-words font-display text-[17px] leading-tight">{title}</span>
      {meta ? <span className="mt-0.5 block text-[14px] text-muted-foreground">{meta}</span> : null}
    </>
  );
}

function NextRow({
  stop,
  kicker,
  meta,
  onLook,
  children,
}: {
  stop: ItineraryRow;
  kicker: string;
  meta?: string;
  onLook?: ((id: string) => void) | undefined;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center gap-2.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <KindIcon item={stop} className="size-5" />
        </span>
        {onLook ? (
          <button
            type="button"
            onClick={() => onLook(stop.id)}
            className="min-h-11 min-w-0 flex-1 text-left"
          >
            <NextTitle kicker={kicker} title={stop.title} meta={meta} />
          </button>
        ) : (
          <div className="min-w-0 flex-1">
            <NextTitle kicker={kicker} title={stop.title} meta={meta} />
          </div>
        )}
      </div>
      {stop.address?.trim() ? (
        <p className="flex items-start gap-1 text-[14px] text-muted-foreground">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span className="min-w-0">{stop.address}</span>
        </p>
      ) : null}
      {children}
    </div>
  );
}

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
      <div className="min-w-0 flex-1 text-[16px] leading-snug">
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
          <p className="mt-0.5 text-[14px] text-muted-foreground">
            In Bookings: {booking.documents.join(", ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * A clock of its own: the time is a number beside the icon, so it can be
 * seen without reading Béa's sentence. A tap opens the way there in maps.
 * The time is shown only when both halves are real (a clock time on the next
 * stop and a routed leg); otherwise it says when to be there by, and the
 * journey half appears once measured.
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
      className={`now-leave flex min-h-11 items-center gap-3 px-3 py-2 ${
        urgent
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-[color-mix(in_oklab,#f59ab8_16%,var(--card))]"
      }`}
    >
      {big ? (
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={`grid size-12 shrink-0 place-items-center rounded-full ${
              urgent ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
            }`}
            aria-hidden
          >
            <Clock className="size-7" />
          </span>
          <span className="leading-tight">
            <span
              className={`block text-[13px] font-semibold ${urgent ? "" : "text-muted-foreground"}`}
            >
              {label}
            </span>
            <span
              className={`block text-[28px] font-bold tabular-nums leading-none ${urgent ? "" : "text-foreground"}`}
            >
              {big}
            </span>
          </span>
        </span>
      ) : null}
      {big && words ? <span aria-hidden className="h-9 w-px shrink-0 bg-border" /> : null}
      {words ? (
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="leading-tight">
            <span className="block text-[14px]">
              {words.time} {words.how}
            </span>
            <span className={`block text-[14px] ${urgent ? "" : "text-muted-foreground"}`}>
              {words.distance}
            </span>
          </span>
        </span>
      ) : (
        <span className="flex-1 text-[14px] text-muted-foreground">
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
    <p className="mt-1 text-[14px] font-semibold text-muted-foreground">{line}</p>
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
  onSwap,
}: {
  stops: ItineraryRow[];
  forecast: RainForecast | null;
  now: Date | null;
  /** Have Béa substitute indoor places for the outdoor stops in the rain. */
  onSwap?: ((from: string, until: string | null) => void) | undefined;
}) {
  const day = stops.find((s) => s.day_date)?.day_date ?? null;
  const notice = forecast && day && now ? rainNotice(forecast, day, now) : null;
  if (!notice) return null;
  return (
    <div
      role="status"
      className="plain-card flex items-start gap-2 px-3 py-2 text-[16px] leading-snug"
    >
      <CloudRain className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        {rainLine(notice)}{" "}
        <a
          href="https://open-meteo.com/"
          target="_blank"
          rel="noreferrer"
          title={WEATHER_ATTRIBUTION}
          className="text-[13px] text-muted-foreground underline underline-offset-2"
        >
          Open-Meteo
        </a>
        {onSwap && (
          <button
            type="button"
            onClick={() => onSwap(notice.from, notice.until)}
            className="mt-1 block min-h-11 text-[16px] font-semibold text-primary underline underline-offset-2"
          >
            Substitute outdoor stops
          </button>
        )}
      </span>
    </div>
  );
}

/** "today", "tomorrow", or "Tue, Oct 6", against the place's own date. */
function dayLabelFor(day: string, placeDay: string | null): string {
  if (placeDay && day === placeDay) return "today";
  const date = parseLocalDate(day);
  const today = placeDay ? parseLocalDate(placeDay) : undefined;
  if (date && today && Math.round((date.getTime() - today.getTime()) / 86_400_000) === 1)
    return "tomorrow";
  return date
    ? date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : day;
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
const LATER_PREVIEW = 3;
