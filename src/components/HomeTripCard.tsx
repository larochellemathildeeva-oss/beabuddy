import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, CalendarClock, ChevronRight, Ticket } from "lucide-react";
import { TripBanner } from "@/components/TripBanner";
import { TripCard } from "@/components/TripCard";
import type { TripRow, MemberRow } from "@/hooks/useTrips";
import type { TripPhotoRow } from "@/hooks/useTripPhotos";
import type { TripGlance } from "@/hooks/useTripGlances";
import { useTripStops } from "@/hooks/useTripStops";
import { useTripTodos } from "@/hooks/useTripTodos";
import { laterHeading, peopleOnTrip } from "@/lib/home-trip";
import { pickTripPhoto } from "@/lib/trip-card";
import { timeForRail } from "@/lib/timeline-kind";
import { toLocalISODate } from "@/lib/trip-dates";
import { dueLine, nextOnPlan, nextTodo } from "@/lib/trip-glance";

function todayIso() {
  return toLocalISODate(new Date());
}

/** A serif heading with one quiet link beside it, as on Home. */
export function HomeSectionTitle({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="font-display text-[27px] leading-none">{title}</h2>
      {aside ? <div className="shrink-0 text-[14px] text-primary">{aside}</div> : null}
    </div>
  );
}

/** What the hero says under the title: how booked, else how packed, else how planned. */
function readiness(glance: TripGlance | undefined): { label: string; line: string } {
  if (glance?.plans) {
    const { confirmed, total } = glance.plans;
    return {
      label: confirmed === total ? "Ready to go" : "Getting ready",
      line: `${confirmed} of ${total} ${total === 1 ? "plan" : "plans"} confirmed`,
    };
  }
  if (glance?.packing) {
    return {
      label: "Packing",
      line: `${glance.packing.packed} of ${glance.packing.total} packed`,
    };
  }
  const n = glance?.stops ?? 0;
  if (n > 0) return { label: "The plan", line: `${n} ${n === 1 ? "stop" : "stops"} planned` };
  return { label: "Just started", line: "Nothing planned yet" };
}

/**
 * Home's current trip, as a picture: your own photo of the place (or a
 * painted dusk), how soon, who is coming, and how ready it is.
 */
export function HomeTripHero({
  trip,
  glance,
  photos,
  peopleCount,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  photos: TripPhotoRow[];
  peopleCount: number;
}) {
  const stops = useTripStops(trip.id, null);
  const cities = stops.stops.map((s) => s.city);
  const photo = pickTripPhoto(photos, { city: trip.city, country: trip.country, cities });
  const ready = readiness(glance);

  return (
    <section data-guide="home-trip" className="rise">
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        viewTransition
        className="group block rounded-[28px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
      >
        <TripBanner
          variant="hero"
          title={trip.title}
          city={trip.city}
          country={trip.country}
          cities={cities}
          startDate={trip.start_date}
          endDate={trip.end_date}
          tentative={trip.dates_status === "tentative"}
          photo={photo}
          peopleCount={peopleCount}
          viewTransitionName={`trip-photo-${trip.id}`}
          footer={
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-[14px] font-semibold leading-snug">
                <span className="sr-only">{ready.label}: </span>
                {ready.line}
              </p>
              <span className="flex shrink-0 items-center gap-1 text-[14px] font-semibold">
                View itinerary
                <ArrowUpRight
                  className="size-4.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </div>
          }
        />
      </Link>
    </section>
  );
}

/**
 * "Next up": the one to-do worth doing today, or, with none, the next thing
 * on the plan. Hidden when there is neither.
 */
export function HomeNextUp({
  trip,
  glance,
  uid,
}: {
  trip: TripRow;
  glance: TripGlance | undefined;
  uid: string | null;
}) {
  const { todos } = useTripTodos(trip.id, uid);
  const open = todos.filter((t) => !t.done);
  const todo = nextTodo(todos);
  const planned = todo ? null : nextOnPlan(glance?.items ?? [], todayIso());

  if (!todo && !planned) return null;

  const eyebrow = todo ? "One thing for today" : "Next on the plan";
  const title = todo ? todo.title : planned!.title;
  const note = todo
    ? dueLine(todo.due_on) || todo.notes || trip.title
    : [
        planned!.day_date
          ? new Date(`${planned!.day_date}T00:00:00`).toLocaleDateString(undefined, {
              weekday: "short",
              day: "numeric",
              month: "short",
            })
          : "",
        timeForRail(planned!.time_label),
      ]
        .filter(Boolean)
        .join(" · ");
  const Icon = todo ? Ticket : CalendarClock;

  return (
    <section data-guide="home-next" className="rise">
      <HomeSectionTitle
        title="Next up"
        aside={
          open.length > 0 ? `${open.length} ${open.length === 1 ? "task" : "tasks"}` : undefined
        }
      />
      <Link
        to="/trips/$tripId"
        params={{ tripId: trip.id }}
        className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
      >
        <span
          aria-hidden
          className="grid size-14 shrink-0 place-items-center rounded-full bg-nexttime/15 text-nexttime"
        >
          <Icon className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {eyebrow}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-[17px] font-medium leading-snug">
            {title}
          </span>
          {note ? (
            <span className="block truncate text-[13.5px] text-muted-foreground">{note}</span>
          ) : null}
        </span>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
      </Link>
    </section>
  );
}

/**
 * Trips that ended in the last year, at the foot of Home: one thin bar each,
 * so they are there to revisit without taking the page from what is next.
 */
export function HomePastTrips({ trips, photos }: { trips: TripRow[]; photos: TripPhotoRow[] }) {
  if (trips.length === 0) return null;
  return (
    <section data-guide="home-past" className="rise">
      <HomeSectionTitle title="Past trips" aside={<Link to="/trips">All trips</Link>} />
      <div className="space-y-2">
        {trips.map((t) => (
          <Link
            key={t.id}
            to="/trips/$tripId"
            params={{ tripId: t.id }}
            viewTransition
            className="block overflow-hidden rounded-2xl shadow-xs transition-shadow hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            <TripBanner
              variant="compact"
              title={t.title}
              city={t.city}
              country={t.country}
              cities={[]}
              startDate={t.start_date}
              endDate={t.end_date}
              photo={pickTripPhoto(photos, { city: t.city, country: t.country, cities: [] })}
              viewTransitionName={`trip-photo-${t.id}`}
            />
          </Link>
        ))}
      </div>
    </section>
  );
}

/** The trips after the current one, as banners, each one tap from its page. */
export function HomeLaterTrips({
  trips,
  photos,
  glances,
  members,
  uid,
}: {
  trips: TripRow[];
  photos: TripPhotoRow[];
  glances: Record<string, TripGlance>;
  members: MemberRow[];
  uid: string | null;
}) {
  if (trips.length === 0) return null;
  return (
    <section className="rise">
      <HomeSectionTitle
        title={laterHeading(trips.map((t) => t.start_date))}
        aside={<Link to="/trips">All trips</Link>}
      />
      <div className="space-y-3">
        {trips.map((t) => (
          <TripCard
            key={t.id}
            trip={t}
            photos={photos}
            glance={glances[t.id]}
            peopleCount={peopleOnTrip(members, t.id, uid)}
            detail={false}
          />
        ))}
      </div>
    </section>
  );
}
