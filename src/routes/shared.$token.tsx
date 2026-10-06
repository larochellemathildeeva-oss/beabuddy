import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Check, ChevronDown, Clock, MapPin } from "@/components/icons";
import { useAuth } from "@/hooks/useAuth";
import { changeFollow, readFollowState } from "@/lib/trip-follow.functions";
import type { FollowState } from "@/lib/trip-follow";
import { readSharedTrip } from "@/lib/trip-share.functions";
import { clockIn, dateIn, wallTimeToInstant, zoneGap, zoneLabel } from "@/lib/trip-clock";
import {
  sharedLive,
  sharedTripZone,
  sharedStopMapsUrl,
  type SharedLive,
  type SharedPhoto,
  type SharedStop,
  type SharedTrip,
} from "@/lib/trip-share";
import { formatDateRangeLabel, parseLocalDate } from "@/lib/trip-dates";

export const Route = createFileRoute("/shared/$token")({
  staticData: { plane: "detail" },
  // Read on the server, so the friend opening the link sees the plan in the
  // first paint rather than "Opening the trip…", and a chat app's preview
  // carries the trip's name.
  loader: ({ params }) => readSharedTrip({ data: { token: params.token } }),
  head: ({ loaderData: trip }) => {
    const dates =
      trip?.startDate && trip.endDate ? formatDateRangeLabel(trip.startDate, trip.endDate) : "";
    const title = trip ? `${trip.title} — shared from Béa` : "A shared trip — Béa";
    const description = trip
      ? [trip.place, dates].filter(Boolean).join(" · ") || "A trip plan, shared from Béa."
      : "A trip plan, shared from Béa.";
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { name: "referrer", content: "no-referrer" },
      ],
    };
  },
  pendingComponent: SharedTripPending,
  errorComponent: SharedTripError,
  component: SharedTripPage,
});

/**
 * How often an open page asks again. Slow on purpose: the link's own limit
 * is shared by everyone reading it, and a stop changes every hour or so,
 * not every minute.
 */
const REFRESH_MS = 2 * 60 * 1000;

/**
 * The trip as last read: the loader's answer, then a quiet re-read every
 * two minutes while the page is in view (and on coming back to it, at most
 * that often). Plan-only pages ask too, so a link switched to "follow
 * along" starts showing it. A failed re-read keeps the last good copy on
 * screen and tries again next time, rather than replacing it with an error.
 */
function useLatestTrip(token: string, first: SharedTrip | null): SharedTrip | null {
  const [trip, setTrip] = useState(first);
  const lastAsked = useRef(Date.now());
  useEffect(() => setTrip(first), [first]);
  useEffect(() => {
    if (!first) return;
    let alive = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastAsked.current < REFRESH_MS - 5_000) return;
      lastAsked.current = Date.now();
      try {
        const next = await readSharedTrip({ data: { token } });
        if (alive) setTrip(next);
      } catch {
        // Busy or offline: keep what is shown, and ask again later.
      }
    };
    const timer = window.setInterval(() => void refresh(), REFRESH_MS);
    const onShow = () => void refresh();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      alive = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [token, first]);
  return trip;
}

function dayHeading(day: string | null): string {
  if (!day) return "Some time on the trip";
  const date = parseLocalDate(day);
  return date
    ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : day;
}

/** The plan's shape while it loads on a client-side visit. */
function SharedTripPending() {
  return (
    <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you.">
      <div className="space-y-4" aria-busy="true" aria-label="Opening the trip">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        {[0, 1].map((d) => (
          <div key={d} className="space-y-2">
            <div className="h-6 w-1/2 animate-pulse rounded bg-muted" />
            <div className="plain-card divide-y divide-border overflow-hidden">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex gap-3 px-3.5 py-3">
                  <div className="h-4 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

function SharedTripError({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you.">
      <div className="plain-card space-y-3 p-4">
        <p className="text-[16px] text-muted-foreground">
          {error.message || "This trip didn't load. Try again."}
        </p>
        <button
          type="button"
          onClick={() => void router.invalidate()}
          className="btn-primary flex w-full items-center justify-center px-4"
        >
          Try again
        </button>
      </div>
    </AppShell>
  );
}

/** The friend's own time zone, as the browser reports it. */
function readerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/**
 * The time now, and the friend's time zone; null until the page is in the
 * browser, so the server's clock never reaches the page. Asked again every
 * minute and on coming back to the page, so the clocks and "Next" move on.
 */
function useNow(): { now: number; zone: string } | null {
  const [now, setNow] = useState<{ now: number; zone: string } | null>(null);
  useEffect(() => {
    const update = () => setNow({ now: Date.now(), zone: readerZone() });
    update();
    const timer = window.setInterval(update, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return now;
}

/** "Sat" for `instant` in `zone`. */
function weekdayIn(zone: string, instant: number): string {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: zone }).format(instant);
}

/** The trip's clock against the friend's, when they differ. */
type Clocks = { trip: string; reader: string; now: number };

/**
 * A trip someone shared with a read-only link: where they will be, and
 * when. No account needed, nothing to change, and only the plan itself —
 * never bookings, notes or documents. A link that follows along opens on
 * the live card and that day's stops, with the whole plan folded below.
 */
function SharedTripPage() {
  const { token } = Route.useParams();
  const trip = useLatestTrip(token, Route.useLoaderData());
  const clock = useNow();

  if (!trip) {
    return (
      <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you.">
        <p className="plain-card p-4 text-[16px] text-muted-foreground">
          This link doesn't open a trip any more. It may have expired, or been turned off by the
          traveller who shared it.
        </p>
      </AppShell>
    );
  }

  const dates =
    trip.startDate && trip.endDate ? formatDateRangeLabel(trip.startDate, trip.endDate) : "";
  // Each day is over on its own calendar, read in that day's zone: a
  // friend a day ahead or behind would otherwise skip, or keep, the wrong
  // stops. A trip with no pins falls back on the friend's own date.
  const today = clock ? (zone: string | undefined) => dateIn(zone ?? clock.zone, clock.now) : null;
  const live = trip.following ? sharedLive(trip, today) : null;
  const liveDay = live?.day ? trip.days.find((d) => d.day === live.day!.day) : undefined;
  const tripZone = sharedTripZone(trip, live?.day?.day);
  const clocks: Clocks | null =
    clock && tripZone && zoneGap(tripZone, clock.zone, clock.now)
      ? { trip: tripZone, reader: clock.zone, now: clock.now }
      : null;
  // Planned times are read in their own day's zone, and converted whenever
  // the friend's clock differs at that moment, even if it agrees today.
  const readerTime = (place: { day: string | null; stop: SharedStop }): string | null => {
    const zone = clock && place.day ? sharedTripZone(trip, place.day) : undefined;
    const at =
      zone && place.stop.time ? wallTimeToInstant(place.day!, place.stop.time, zone) : null;
    if (!clock || at === null) return null;
    const time = clockIn(clock.zone, at);
    const date = dateIn(clock.zone, at);
    if (time === place.stop.time && date === place.day) return null;
    return time + (date !== place.day ? ` ${weekdayIn(clock.zone, at)}` : "");
  };
  return (
    <AppShell
      publicPage
      eyebrow={[trip.place, dates].filter(Boolean).join(" · ") || "Shared trip"}
      title={trip.title}
    >
      <div className="space-y-4 pb-6">
        {live ? (
          <>
            <LiveCard live={live} clocks={clocks} readerTime={readerTime} />
            <FollowButton token={token} />
            {liveDay && <DayPlan day={liveDay} />}
            {trip.days.length > (liveDay ? 1 : 0) && (
              <details className="group" open={!liveDay}>
                <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-0.5 text-[14px] font-semibold text-primary">
                  <ChevronDown
                    className="size-4 transition-transform group-open:rotate-180"
                    aria-hidden
                  />
                  The whole plan
                </summary>
                <div className="mt-2 space-y-4">
                  {trip.days.map((day) => (
                    <DayPlan key={day.day ?? "undated"} day={day} />
                  ))}
                </div>
              </details>
            )}
            <TripPhotos trip={trip} />
            <p className="text-[13px] text-muted-foreground">
              Following along, read-only: it shows the stop they tapped “I'm here” at — never their
              location — and updates by itself.
            </p>
          </>
        ) : (
          <>
            <p className="text-[14px] text-muted-foreground">
              A read-only copy of the plan, shared from Béa. It shows the latest version each time
              you open it. Tap an address to open it in Maps.
            </p>
            {clocks && <ClockLine clocks={clocks} />}
            <FollowButton token={token} />
            {trip.days.length === 0 && (
              <p className="plain-card p-4 text-[16px] text-muted-foreground">
                Nothing is planned yet.
              </p>
            )}
            {trip.days.map((day) => (
              <DayPlan key={day.day ?? "undated"} day={day} />
            ))}
            <TripPhotos trip={trip} />
          </>
        )}
        <p className="text-center text-[13px] text-muted-foreground">
          Planned with{" "}
          <Link to="/" className="font-semibold text-primary underline underline-offset-2">
            Béa
          </Link>
        </p>
      </div>
    </AppShell>
  );
}

/**
 * "Follow in Béa": a signed-in traveller keeps this trip under Trips →
 * Following. It is the same link, kept in their account; if the link is
 * turned off, the trip leaves their list. Hidden until following is set up
 * (its migration), and for a link that no longer opens.
 */
function FollowButton({ token }: { token: string }) {
  const { user, loading } = useAuth();
  const readState = useServerFn(readFollowState);
  const change = useServerFn(changeFollow);
  // The state belongs to the account it was read for: another account
  // signing in never sees it, even for a moment.
  const [read, setState] = useState<{ userId: string; state: FollowState | null } | null>(null);
  const state = user && read?.userId === user.id ? read.state : null;
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    const userId = user.id;
    let alive = true;
    readState({ data: { token } })
      .then((next) => alive && setState({ userId, state: next }))
      .catch(() => alive && setState({ userId, state: null }));
    return () => {
      alive = false;
    };
  }, [user, token, readState]);

  if (loading) return null;
  if (!user) {
    return (
      <p className="text-[13px] text-muted-foreground">
        Have Béa?{" "}
        <Link
          to="/auth"
          className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2"
        >
          Sign in
        </Link>{" "}
        to follow this trip from your Trips.
      </p>
    );
  }
  if (state !== "following" && state !== "not-following") return null;
  const following = state === "following";
  const toggle = async () => {
    setBusy(true);
    try {
      const next = await change({ data: { token, follow: !following } });
      if (next !== "full") setState({ userId: user.id, state: next });
      if (next === "following")
        toast.success("Following", { description: "It's under Trips → Following." });
      else if (next === "not-following") toast("Stopped following");
      else if (next === "full")
        toast.error("You're following as many trips as Béa keeps", {
          description: "Stop following one under Trips → Following, then try again.",
        });
      else toast.error("This trip can't be followed any more.");
    } catch {
      toast.error("That didn't save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      aria-pressed={following}
      className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-full px-4 text-[16px] font-semibold disabled:opacity-60 ${
        following ? "border border-border bg-elevated text-foreground" : "btn-primary"
      }`}
    >
      {following ? (
        <>
          <Check className="size-4" aria-hidden />
          Following in Béa · tap to stop
        </>
      ) : (
        "Follow in Béa"
      )}
    </button>
  );
}

/** One stop on the live card, with a tap through to Maps when it has an address. */
function LiveStop({
  label,
  place,
  yours,
}: {
  label: string;
  place: { day: string | null; stop: SharedStop };
  /** The planned time on the friend's clock, when it differs. */
  yours: string | null;
}) {
  const maps = sharedStopMapsUrl(place.stop);
  return (
    <span className="block min-w-0">
      <span className="block text-[13px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="block break-words font-display text-[21px] leading-tight">
        {place.stop.title}
      </span>
      <span className="block text-[13px] text-muted-foreground">
        {dayHeading(place.day)}
        {place.stop.time ? ` · planned for ${place.stop.time}` : ""}
        {yours ? ` (${yours} your time)` : ""}
      </span>
      {maps && (
        <a
          href={maps}
          target="_blank"
          rel="noopener noreferrer"
          className="-my-1 flex min-h-11 items-center gap-1 text-[13px] text-muted-foreground underline decoration-border underline-offset-2"
        >
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0">{place.stop.address}</span>
        </a>
      )}
    </span>
  );
}

/** Where they are and where they go next: the first thing a following friend sees. */
function LiveCard({
  live,
  clocks,
  readerTime,
}: {
  live: SharedLive;
  clocks: Clocks | null;
  readerTime: (place: { day: string | null; stop: SharedStop }) => string | null;
}) {
  return (
    <section className="plain-card space-y-3 p-4" aria-live="polite" aria-label="Live">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-primary">
        <span className="relative flex size-2.5" aria-hidden>
          <span
            className={`absolute inline-flex size-full rounded-full ${live.now ? "animate-ping bg-primary/60 motion-reduce:animate-none" : ""}`}
          />
          <span
            className={`relative inline-flex size-2.5 rounded-full ${live.now ? "bg-primary" : "bg-muted-foreground/40"}`}
          />
        </span>
        Live
        {live.day && live.day.total > 0 && (
          <span className="font-normal text-muted-foreground">
            · {live.day.done} of {live.day.total} {live.day.total === 1 ? "stop" : "stops"} done
          </span>
        )}
      </p>
      {live.now ? (
        <LiveStop label="Now at" place={live.now} yours={readerTime(live.now)} />
      ) : (
        <p className="text-[14px] text-muted-foreground">
          {live.next
            ? "Not at a stop just now. You'll see it here when they get to the next one."
            : "No stops left on the plan. The trip may be over."}
        </p>
      )}
      {clocks && <ClockLine clocks={clocks} />}
      {live.next && (
        <div className="border-t border-border pt-3">
          <LiveStop
            label={live.now ? "Next" : "Next up"}
            place={live.next}
            yours={readerTime(live.next)}
          />
        </div>
      )}
    </section>
  );
}

/**
 * "In Japan: 08:14 Sat · You: 20:14 Fri — plan times are Japan time, 12 h
 * ahead of you." Shown only when the two clocks differ.
 */
function ClockLine({ clocks }: { clocks: Clocks }) {
  const gap = zoneGap(clocks.trip, clocks.reader, clocks.now);
  // Named after the zone's city ("Tokyo time"), which is what the clock is,
  // rather than the trip's town, which may be in another zone.
  const city = zoneLabel(clocks.trip);
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-elevated px-3 py-2 text-[13px]">
      <Clock className="size-4 shrink-0 text-primary" aria-hidden />
      <span>
        <span className="font-semibold">{city ? `${city} time:` : "Trip time:"}</span>{" "}
        <span className="tabular-nums">{clockIn(clocks.trip, clocks.now)}</span>{" "}
        {weekdayIn(clocks.trip, clocks.now)}
      </span>
      <span aria-hidden>·</span>
      <span>
        <span className="font-semibold">Your time:</span>{" "}
        <span className="tabular-nums">{clockIn(clocks.reader, clocks.now)}</span>{" "}
        {weekdayIn(clocks.reader, clocks.now)}
      </span>
      <span className="basis-full text-[13px] text-muted-foreground">
        {city ? `Plan times are ${city} time` : "Plan times are the trip's local time"}
        {gap ? `, ${gap} of you` : ""}.
      </span>
    </p>
  );
}

/** A stop's or the trip's photos, small; a tap opens one at full size. */
function PhotoRow({ photos, label }: { photos: SharedPhoto[]; label: string }) {
  return (
    <span className="mt-2 flex flex-wrap gap-1.5">
      {photos.map((photo, i) => (
        <a
          key={i}
          href={photo.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open photo ${i + 1} of ${label}`}
          className="block size-16 overflow-hidden rounded-xl bg-elevated"
        >
          <img
            src={photo.url}
            alt={`Photo ${i + 1} of ${label}`}
            loading="lazy"
            className="size-full object-cover"
          />
        </a>
      ))}
    </span>
  );
}

/**
 * The photos of the trip as a whole, under its plan, or a line saying why
 * there are none: the traveller who shared it has not turned photos on, or
 * none have been added yet.
 */
function TripPhotos({ trip }: { trip: SharedTrip }) {
  const shown = trip.photos ?? [];
  const onStops = trip.days.some((d) => d.stops.some((s) => s.photos?.length));
  if (shown.length) {
    return (
      <section aria-label="Photos from this trip">
        <h2 className="mb-2 px-0.5 font-display text-[21px] leading-tight">
          Photos from this trip
        </h2>
        <div className="plain-card p-3.5">
          <PhotoRow photos={shown} label="the trip" />
        </div>
      </section>
    );
  }
  if (onStops) return null;
  return (
    <p className="text-[13px] text-muted-foreground">
      {trip.photosOn
        ? "Photos are on for this link, but there are none to show right now."
        : "Photos aren't shared on this link. The traveller who shared it can turn them on."}
    </p>
  );
}

/** One day of the plan, marking what is done and where they are on a following link. */
function DayPlan({ day }: { day: SharedTrip["days"][number] }) {
  return (
    <section aria-label={dayHeading(day.day)}>
      <h2 className="mb-2 px-0.5 font-display text-[21px] leading-tight">{dayHeading(day.day)}</h2>
      <ol className="plain-card divide-y divide-border overflow-hidden">
        {day.stops.map((stop, i) => {
          const maps = sharedStopMapsUrl(stop);
          const here = stop.status === "here";
          const done = stop.status === "done";
          return (
            // The plan has no stop ids to share; time and title keep a
            // row's key stable when the plan above it changes.
            <li
              key={`${stop.time}|${stop.title}|${i}`}
              className={`flex items-start gap-3 px-3.5 py-2.5 ${here ? "bg-primary/10" : ""}`}
              aria-current={here ? "location" : undefined}
            >
              <span className="w-12 shrink-0 pt-0.5 text-[14px] font-bold tabular-nums text-primary">
                {stop.time || "–"}
                {done && (
                  <Check className="mt-0.5 block size-4 text-muted-foreground" aria-label="Done" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block break-words text-[16px] leading-snug ${done ? "text-muted-foreground" : ""}`}
                >
                  {stop.title}
                  {here && (
                    <span className="ms-2 inline-block rounded-full bg-primary px-2 py-0.5 align-middle text-[13px] font-bold text-primary-foreground">
                      Here now
                    </span>
                  )}
                </span>
                {stop.address &&
                  (maps ? (
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="-my-1 flex min-h-11 items-center gap-1 text-[13px] text-muted-foreground underline decoration-border underline-offset-2"
                    >
                      <MapPin className="size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">{stop.address}</span>
                    </a>
                  ) : (
                    <span className="mt-0.5 flex items-start gap-1 text-[13px] text-muted-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span className="min-w-0">{stop.address}</span>
                    </span>
                  ))}
                {stop.photos?.length ? <PhotoRow photos={stop.photos} label={stop.title} /> : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
