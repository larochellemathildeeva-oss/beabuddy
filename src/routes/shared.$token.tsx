import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/AppShell";
import { MapPin } from "@/components/icons";
import { readSharedTrip } from "@/lib/trip-share.functions";
import type { SharedTrip } from "@/lib/trip-share";
import { formatDateRangeLabel, parseLocalDate } from "@/lib/trip-dates";

export const Route = createFileRoute("/shared/$token")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "A shared trip — Béa" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "referrer", content: "no-referrer" },
    ],
  }),
  component: SharedTripPage,
});

function dayHeading(day: string | null): string {
  if (!day) return "Some time on the trip";
  const date = parseLocalDate(day);
  return date
    ? date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
    : day;
}

/**
 * A trip someone shared with a read-only link: where they will be, and
 * when. No account needed, nothing to change, and only the plan itself —
 * never bookings, notes or documents.
 */
function SharedTripPage() {
  const { token } = Route.useParams();
  const read = useServerFn(readSharedTrip);
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "missing" }
    | { kind: "error"; message: string }
    | { kind: "ok"; trip: SharedTrip }
  >({ kind: "loading" });

  useEffect(() => {
    let active = true;
    read({ data: { token } })
      .then((trip) => {
        if (active) setState(trip ? { kind: "ok", trip } : { kind: "missing" });
      })
      .catch((e: unknown) => {
        if (active)
          setState({
            kind: "error",
            message: e instanceof Error ? e.message : "This trip didn't load. Try again.",
          });
      });
    return () => {
      active = false;
    };
  }, [read, token]);

  if (state.kind !== "ok") {
    return (
      <AppShell publicPage eyebrow="Shared trip" title="A trip, shared with you">
        <p className="plain-card p-4 text-[14.5px] text-muted-foreground">
          {state.kind === "loading"
            ? "Opening the trip…"
            : state.kind === "missing"
              ? "This link doesn't open a trip any more. It may have expired, or been turned off by the traveller who shared it."
              : state.message}
        </p>
      </AppShell>
    );
  }

  const { trip } = state;
  const dates =
    trip.startDate && trip.endDate ? formatDateRangeLabel(trip.startDate, trip.endDate) : "";
  return (
    <AppShell
      publicPage
      eyebrow={[trip.place, dates].filter(Boolean).join(" · ") || "Shared trip"}
      title={trip.title}
    >
      <div className="space-y-4 pb-6">
        <p className="text-[13.5px] text-muted-foreground">
          A read-only copy of the plan, shared from Béa. It shows the latest version each time you
          open it.
        </p>
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
              {day.stops.map((stop, i) => (
                <li key={i} className="flex items-start gap-3 px-3.5 py-2.5">
                  <span className="w-12 shrink-0 pt-0.5 text-[14px] font-bold tabular-nums text-primary">
                    {stop.time || "–"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[15px] leading-snug">{stop.title}</span>
                    {stop.address && (
                      <span className="mt-0.5 flex items-start gap-1 text-[12.5px] text-muted-foreground">
                        <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        <span className="min-w-0">{stop.address}</span>
                      </span>
                    )}
                  </span>
                </li>
              ))}
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
