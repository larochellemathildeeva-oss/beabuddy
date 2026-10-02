import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Check, MapPin } from "@/components/icons";
import { readSharedTrip } from "@/lib/trip-share.functions";
import { sharedNow, sharedStopMapsUrl, type SharedTrip } from "@/lib/trip-share";
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
    <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you">
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
    <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you">
      <div className="plain-card space-y-3 p-4">
        <p className="text-[14.5px] text-muted-foreground">
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

/**
 * A trip someone shared with a read-only link: where they will be, and
 * when. No account needed, nothing to change, and only the plan itself —
 * never bookings, notes or documents.
 */
function SharedTripPage() {
  const { token } = Route.useParams();
  const trip = useLatestTrip(token, Route.useLoaderData());

  if (!trip) {
    return (
      <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you">
        <p className="plain-card p-4 text-[14.5px] text-muted-foreground">
          This link doesn't open a trip any more. It may have expired, or been turned off by the
          traveller who shared it.
        </p>
      </AppShell>
    );
  }

  const dates =
    trip.startDate && trip.endDate ? formatDateRangeLabel(trip.startDate, trip.endDate) : "";
  const now = sharedNow(trip);
  return (
    <AppShell
      publicPage
      eyebrow={[trip.place, dates].filter(Boolean).join(" · ") || "Shared trip"}
      title={trip.title}
    >
      <div className="space-y-4 pb-6">
        <p className="text-[13.5px] text-muted-foreground">
          {trip.following
            ? "A read-only copy of the plan, shared from Béa, following along: it marks the stop they're at and the ones they've done, and updates by itself. Tap an address to open it in Maps."
            : "A read-only copy of the plan, shared from Béa. It shows the latest version each time you open it. Tap an address to open it in Maps."}
        </p>
        {trip.following && (
          <div className="plain-card flex items-start gap-3 p-3.5" aria-live="polite">
            <span
              className={`mt-1.5 size-2.5 shrink-0 rounded-full ${now ? "bg-primary" : "bg-muted-foreground/40"}`}
              aria-hidden
            />
            {now ? (
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Now at
                </span>
                <span className="block break-words font-display text-[19px] leading-tight">
                  {now.stop.title}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">
                  {dayHeading(now.day)}
                  {now.stop.time ? ` · planned for ${now.stop.time}` : ""}
                </span>
              </span>
            ) : (
              <span className="text-[14px] text-muted-foreground">
                Not at a stop just now. You'll see it here when they get to the next one.
              </span>
            )}
          </div>
        )}
        {trip.days.length === 0 && (
          <p className="plain-card p-4 text-[14.5px] text-muted-foreground">
            Nothing is planned yet.
          </p>
        )}
        {trip.days.map((day) => (
          <section key={day.day ?? "undated"} aria-label={dayHeading(day.day)}>
            <h2 className="mb-2 px-0.5 font-display text-[21px] leading-tight">
              {dayHeading(day.day)}
            </h2>
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
                        <Check
                          className="mt-0.5 block size-4 text-muted-foreground"
                          aria-label="Done"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block break-words text-[15px] leading-snug ${done ? "text-muted-foreground" : ""}`}
                      >
                        {stop.title}
                        {here && (
                          <span className="ms-2 inline-block rounded-full bg-primary px-2 py-0.5 align-middle text-[11.5px] font-bold text-primary-foreground">
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
                            className="-my-1 flex min-h-11 items-center gap-1 text-[12.5px] text-muted-foreground underline decoration-border underline-offset-2"
                          >
                            <MapPin className="size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0">{stop.address}</span>
                          </a>
                        ) : (
                          <span className="mt-0.5 flex items-start gap-1 text-[12.5px] text-muted-foreground">
                            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                            <span className="min-w-0">{stop.address}</span>
                          </span>
                        ))}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
        <p className="text-center text-[12.5px] text-muted-foreground">
          Planned with{" "}
          <Link to="/" className="font-semibold text-primary underline underline-offset-2">
            Béa
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
