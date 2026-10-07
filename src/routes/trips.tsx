import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { friendlyError } from "@/lib/friendly-error";
import type { PlannerTab } from "@/components/ItineraryImport";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronRight, FileText, Plus, Sparkles, Users, X } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { AppShell } from "@/components/AppShell";
import { DateRangeField } from "@/components/DateRangeField";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import {
  LayoutSwitch,
  PastTiles,
  TripFeature,
  TripListRow,
  TripsHero,
  TripsSection,
} from "@/components/TripsList";
import { useTripsLayout } from "@/hooks/useTripsLayout";
import { FollowedTripList } from "@/components/FollowedTripList";
import { listFollowedTrips } from "@/lib/trip-follow.functions";
import type { FollowedTrip } from "@/lib/trip-follow";
import { knownToFollow, rememberFollows } from "@/lib/follow-hint";
import { useTripGlances } from "@/hooks/useTripGlances";
import { peopleOnTrip, tripTabs } from "@/lib/home-trip";
import { toLocalISODate } from "@/lib/trip-dates";
import { TripListSkeleton } from "@/components/Skeletons";
import { useTripPhotos } from "@/hooks/useTripPhotos";
import type { TripRow } from "@/hooks/useTrips";
import { suggestedTripTitle } from "@/lib/timeline-entry";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import { usePacking } from "@/hooks/usePacking";
import { locationFromParsedPlace } from "@/lib/place-label";
import { tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { emptyLine } from "@/lib/bea-personality";
import { useBeaSettings } from "@/hooks/useBeaSettings";
import { type DatesStatus } from "@/lib/trip-dates";
import {
  EMPTY_CITY,
  EMPTY_DAY_TRIP,
  citiesToStops,
  cityOutsideTrip,
  dayTripInsertAt,
  dayTripOutsideBase,
  onePlaceStops,
  shortCity,
  tripDatesFromCities,
  type CityDraft,
} from "@/lib/trip-cities";

type TripsSearch = {
  /** Open the new-trip form (from Plan with Béa). */
  new?: boolean;
  /** Where the new trip's planner opens once it exists. */
  plan?: PlannerTab;
  ask?: string;
};

const PLAN_AFTER_CREATE: readonly PlannerTab[] = ["build", "import"];

export const Route = createFileRoute("/trips")({
  staticData: { plane: "tab" },
  validateSearch: (search: Record<string, unknown>): TripsSearch => ({
    ...(search["new"] === true || search["new"] === "true" ? { new: true } : {}),
    ...(PLAN_AFTER_CREATE.includes(search["plan"] as PlannerTab)
      ? { plan: search["plan"] as PlannerTab }
      : {}),
    ...(typeof search["ask"] === "string" && search["ask"].trim()
      ? { ask: search["ask"].slice(0, 2000) }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Trips — Béa" },
      {
        name: "description",
        content:
          "Every trip as a folder: a shared timeline you edit together, live presence, reservations, documents and budget.",
      },
      { property: "og:title", content: "Trips — Béa" },
      {
        property: "og:description",
        content:
          "Trip folders with a live shared itinerary, invited friends, and encrypted trip documents.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripsPage,
});

function TripsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const t = useTrips();
  // A trip is a place you go to, not a drawer you open. It used to be an
  // accordion, which needed a sessionStorage note to survive a tab change —
  // otherwise the itinerary, budget and saved directions all vanished, which
  // reads as "everything disappeared" rather than "the card closed". A route
  // has that for free, and the note is gone.
  const search = Route.useSearch();
  const [creating, setCreating] = useState(Boolean(search.new));
  const [joining, setJoining] = useState(false);
  /**
   * The master's tabs. Undated trips sit at the end of Upcoming; Following
   * (trips others shared) shows once the traveller follows one.
   */
  const [view, setView] = useState<"upcoming" | "past" | "following" | "all">("upcoming");
  const [layout, setLayout] = useTripsLayout();
  const {
    trips: followed,
    failed: followedFailed,
    retry: retryFollowed,
    forget: forgetFollowed,
  } = useFollowedTrips(user?.id ?? null);
  // The tab stays when the list could not be read but this phone knows of
  // follows, so a failed read is not mistaken for "following nothing".
  const showFollowing =
    Boolean(followed?.length) || (followedFailed && !!user && knownToFollow(user.id));
  const [form, setForm] = useState({
    title: "",
    city: "",
    country: "",
    start_date: "",
    end_date: "",
    dates_status: "tentative" as DatesStatus,
  });
  /** One place, or several cities each with its own dates. */
  const [multiCity, setMultiCity] = useState(false);
  const [cities, setCities] = useState<CityDraft[]>([EMPTY_CITY, EMPTY_CITY]);
  const setCity = (index: number, patch: Partial<CityDraft>) =>
    setCities((list) => list.map((city, i) => (i === index ? { ...city, ...patch } : city)));
  /** One place with days out of it: Kyoto for the week, Hiroshima for a day. */
  const [dayTrips, setDayTrips] = useState<CityDraft[]>([]);
  const setDayTrip = (index: number, patch: Partial<CityDraft>) =>
    setDayTrips((list) => list.map((trip, i) => (i === index ? { ...trip, ...patch } : trip)));
  // With several cities, blank trip dates come from the cities' own.
  const cityDates = tripDatesFromCities(cities);
  const tripStart = multiCity ? form.start_date || cityDates.start : form.start_date;
  const tripEnd = multiCity ? form.end_date || cityDates.end : form.end_date;
  const firstCity = cities.find((city) => city.city.trim());
  // A trip should not need a name before Béa will keep anything — "Lisbon,
  // sometime in March" is a trip. The city and dates suggest one.
  const suggestedName = suggestedTripTitle(
    multiCity ? (firstCity?.city ?? "") : form.city,
    tripStart,
  );
  const [withBudget, setWithBudget] = useState(false);
  const packing = usePacking(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  // One trip per tap: on a slow connection, taps while the first save is on
  // its way each made another copy of the trip.
  const saving = useRef(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Traveller";
  const { photos } = useTripPhotos(t.uid);
  const { glances } = useTripGlances(t.trips.map((trip) => trip.id));
  const today = toLocalISODate(new Date());
  const lists = tripTabs(t.trips, today);
  const beaSettings = useBeaSettings();
  // Picked once per visit, in the traveller's mix.
  const [emptyTrips] = useState(() => emptyLine({ kind: "noTrips", settings: beaSettings }));

  const openNew = () => {
    setError("");
    setCreating(true);
    setJoining(false);
  };
  const featured = layout === "big" ? lists.upcoming[0] : undefined;
  const rest = featured ? lists.upcoming.slice(1) : lists.upcoming;
  const live = !!(featured?.start_date && featured.start_date <= today);
  const row = (trip: TripRow) => (
    <TripListRow
      key={trip.id}
      trip={trip}
      photos={photos}
      glance={glances[trip.id]}
      peopleCount={peopleOnTrip(t.members, trip.id, t.uid)}
    />
  );
  const switches = (withLayout: boolean) =>
    withLayout ? <LayoutSwitch layout={layout} onLayout={setLayout} /> : undefined;
  const pastSection = (all: boolean) =>
    lists.past.length > 0 ? (
      <TripsSection
        title="Past trips"
        aside={
          all ? (
            switches(false)
          ) : (
            <button
              type="button"
              onClick={() => setView("past")}
              className="flex min-h-11 shrink-0 items-center gap-0.5 text-[15px] font-semibold text-foreground"
            >
              See all
              <ChevronRight className="size-4 text-primary" aria-hidden />
            </button>
          )
        }
      >
        {all ? (
          <div className="space-y-3">{lists.past.map(row)}</div>
        ) : (
          <PastTiles trips={lists.past.slice(0, 3)} photos={photos} />
        )}
      </TripsSection>
    ) : null;
  const draftsSection = (withSwitch: boolean) =>
    lists.drafts.length > 0 ? (
      <TripsSection title="Dates to set" aside={withSwitch ? switches(false) : undefined}>
        <div className="space-y-3">{lists.drafts.map(row)}</div>
      </TripsSection>
    ) : null;
  const ahead = (
    <>
      {lists.upcoming.length > 0 ? (
        featured ? (
          <TripsSection title={live ? "Happening now" : "Next up"} aside={switches(true)}>
            <TripFeature
              trip={featured}
              photos={photos}
              glance={glances[featured.id]}
              peopleCount={peopleOnTrip(t.members, featured.id, t.uid)}
            />
          </TripsSection>
        ) : (
          <TripsSection title="Upcoming trips" aside={switches(true)}>
            <div className="space-y-3">{rest.map(row)}</div>
          </TripsSection>
        )
      ) : !t.loading && t.trips.length > 0 ? (
        <TripsSection title="Upcoming trips" aside={switches(true)}>
          <NothingAhead
            title="No trip on the calendar."
            body="Nothing ahead yet. Béa keeps the next one here once it has dates."
            onPlan={openNew}
          />
        </TripsSection>
      ) : null}
      {featured && rest.length > 0 ? (
        <TripsSection
          title="Later"
          aside={
            <span className="text-[14px] text-muted-foreground">
              {rest.length} {rest.length === 1 ? "trip" : "trips"}
            </span>
          }
        >
          <div className="space-y-3">{rest.map(row)}</div>
        </TripsSection>
      ) : null}
    </>
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <TripsHero
          actions={
            <>
              <Link
                to="/calendar"
                aria-label="Calendar view"
                title="Calendar view"
                className="grid min-h-11 place-items-center px-2 text-[13px] text-muted-foreground"
              >
                Calendar
              </Link>
            </>
          }
        />
        {t.signedIn ? (
          <>
            <div role="tablist" aria-label="Which trips" className="trips-tabs relative z-[1]">
              {(
                [
                  ["upcoming", "Upcoming"],
                  ["past", "Past"],
                  ...(showFollowing ? ([["following", "Following"]] as const) : []),
                  ["all", "All"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={view === value}
                  onClick={() => setView(value)}
                >
                  {label}
                </button>
              ))}
            </div>

            {view !== "past" && view !== "following" ? (
              <button
                type="button"
                data-guide="new-trip"
                aria-label="New trip"
                aria-expanded={creating}
                onClick={openNew}
                className="trips-create"
              >
                Create trip →
              </button>
            ) : null}

            {view !== "past" && view !== "following" ? (
              <div className="grid grid-cols-2 gap-2.5">
                {/* Plan with Béa: build, import, optimize or compare, from one place. */}
                <Link
                  to="/trips/plan"
                  data-guide="plan-with-bea"
                  className="trips-action tile-fill-5"
                >
                  <Sparkles className="size-6 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-display text-[18px] leading-tight">
                      Plan with Béa
                    </span>
                    <span className="block text-[13px] text-foreground/75">
                      Build, import, optimize or compare
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  data-guide="join-trip"
                  aria-expanded={joining}
                  onClick={() => {
                    setError("");
                    setJoining(true);
                    setCreating(false);
                  }}
                  className="trips-action tile-fill-3 text-left"
                >
                  <Users className="size-6 shrink-0 text-primary" aria-hidden />
                  <span className="min-w-0">
                    <span className="block font-display text-[18px] leading-tight">
                      Join with a code
                    </span>
                    <span className="block text-[13px] text-foreground/75">Trips with friends</span>
                  </span>
                </button>
              </div>
            ) : null}

            {error && !creating && !joining && (
              <p role="alert" className="text-[14px] text-destructive">
                {error}
              </p>
            )}

            <div data-guide="trip-list" className="space-y-7">
              {t.loading && t.trips.length === 0 && <TripListSkeleton />}

              {view === "upcoming" && (
                <>
                  {ahead}
                  {draftsSection(false)}
                  {pastSection(false)}
                </>
              )}

              {view === "past" &&
                (lists.past.length > 0 ? (
                  pastSection(true)
                ) : !t.loading ? (
                  <p className="py-6 text-center text-[16px] text-muted-foreground">
                    No past trips yet. They land here once they end.
                  </p>
                ) : null)}

              {view === "all" && t.trips.length > 0 && (
                <>
                  {ahead}
                  {draftsSection(false)}
                  {pastSection(false)}
                </>
              )}

              {view === "following" &&
                (followedFailed ? (
                  <p className="py-6 text-center text-[14.5px] text-muted-foreground">
                    The trips you follow didn't load.{" "}
                    <button
                      type="button"
                      onClick={retryFollowed}
                      className="-my-3 inline-flex min-h-11 items-center font-semibold text-primary underline underline-offset-2"
                    >
                      Try again
                    </button>
                  </p>
                ) : (
                  <FollowedTripList trips={followed ?? []} onRemoved={forgetFollowed} />
                ))}

              {t.trips.length === 0 && !t.loading && view !== "following" && (
                <div className="tile-fill-3 flex items-center gap-4 rounded-[var(--r-card)] p-4">
                  <img
                    src="/bea/bea-think-static.png"
                    alt=""
                    aria-hidden
                    className="size-24 shrink-0 object-contain"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-[22px] leading-snug">{emptyTrips}</p>
                    <p className="mt-1 text-[16px] text-muted-foreground">
                      {beaLine("empty.trips").body}
                    </p>
                    <button
                      type="button"
                      onClick={openNew}
                      className="mt-3 min-h-11 rounded-full bg-primary px-5 text-[16px] font-semibold text-primary-foreground"
                    >
                      Plan a trip
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card-soft p-4">
            <p className="font-display text-[20px] leading-snug">Sign in to start a trip.</p>
            <p className="mt-1 text-[16px] text-muted-foreground">
              Trips, itineraries, invited friends and saved directions all save to your account.
            </p>
            <Link
              to="/auth"
              className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[16px] font-semibold text-primary-foreground"
            >
              Sign in or create an account
            </Link>
          </div>
        )}

        {/* The vault moved into Trip documents (its Protected section). */}
        {t.signedIn && view === "upcoming" ? (
          <TripsSection title="Trip documents">
            <Link
              to="/profile/documents"
              data-guide="document-vault"
              className="plain-card flex items-center gap-3 p-4"
            >
              <span className="tile-fill-3 grid size-11 shrink-0 place-items-center rounded-full text-primary">
                <FileText className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[17px] font-semibold leading-tight">
                  Bookings and tickets
                </span>
                <span className="block text-[14px] text-muted-foreground">
                  And Protected files, encrypted on this device
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </TripsSection>
        ) : null}
      </div>

      <Sheet
        // Only for someone signed in: a /trips?new link opened signed out
        // shows the sign-in card, not a form that cannot save.
        open={creating && t.signedIn}
        onClose={() => {
          setError("");
          setCreating(false);
        }}
        title="New trip"
        hint="Where, when, and who. All of it can change later."
      >
        <div className="space-y-2">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder={suggestedName || "Trip name"}
            aria-label="Trip name"
            className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2.5 text-[15px]"
          />
          {!form.title.trim() && suggestedName && (
            <p className="px-1 text-[12px] text-muted-foreground">
              No name needed — Béa will file this as “{suggestedName}”. Type over it whenever you
              like.
            </p>
          )}
          <div
            role="radiogroup"
            aria-label="Where is this trip going?"
            className="flex gap-1 rounded-xl bg-elevated p-1"
          >
            {(
              [
                [false, "One place"],
                [true, "Several cities"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={multiCity === value}
                onClick={() => setMultiCity(value)}
                className={`flex-1 rounded-lg px-3 py-1.5 text-[13.5px] font-semibold ${
                  multiCity === value
                    ? "bg-card text-foreground shadow-2xs"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {!multiCity && (
            <PlaceSearchInput
              value={form.city}
              onChange={(v) => setForm({ ...form, city: v })}
              onPick={(p) => {
                const loc = locationFromParsedPlace(p);
                setForm({
                  ...form,
                  city: loc.city,
                  country: loc.country || form.country,
                });
              }}
              placeholder="Where to — search it"
              areas
            />
          )}
          <DateRangeField
            start={form.start_date}
            end={form.end_date}
            onChange={(start_date, end_date) => setForm({ ...form, start_date, end_date })}
            datesStatus={form.dates_status}
            onDatesStatusChange={(dates_status) => setForm({ ...form, dates_status })}
            placeholder={
              multiCity && cityDates.start ? "Trip dates — from the cities below" : "Dates"
            }
          />
          {!multiCity && form.city.trim() && (
            <div className="space-y-2">
              {dayTrips.map((trip, index) => (
                <DayTripRow
                  key={index}
                  trip={trip}
                  base={form.city}
                  min={form.start_date}
                  max={form.end_date}
                  outside={cityOutsideTrip(
                    { ...trip, end: trip.start },
                    form.start_date,
                    form.end_date,
                  )}
                  onChange={(patch) => setDayTrip(index, patch)}
                  onRemove={() => setDayTrips((list) => list.filter((_, i) => i !== index))}
                />
              ))}
              <button
                type="button"
                onClick={() => setDayTrips((list) => [...list, EMPTY_DAY_TRIP])}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-[13.5px] font-semibold text-primary"
              >
                <Plus className="size-4" aria-hidden />
                Add a day trip from {shortCity(form.city)}
              </button>
            </div>
          )}
          {multiCity && (
            <div className="space-y-2">
              <p className="px-1 text-[12px] text-muted-foreground">
                Each city in order, with the days you're there. Add layovers too, and day trips from
                a city you're sleeping in.
              </p>
              {cities.map((city, index) =>
                city.dayTrip ? (
                  <div key={index} className="ml-7">
                    <DayTripRow
                      trip={city}
                      base={baseOf(cities, index)?.city ?? ""}
                      min={baseOf(cities, index)?.start ?? ""}
                      max={baseOf(cities, index)?.end ?? ""}
                      outside={dayTripOutsideBase(cities, index)}
                      onChange={(patch) => setCity(index, patch)}
                      onRemove={() => setCities((list) => list.filter((_, i) => i !== index))}
                    />
                  </div>
                ) : (
                  <div
                    key={index}
                    className="space-y-1.5 rounded-xl border border-border bg-elevated p-2"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-[12px] font-bold text-primary-foreground">
                        {cities.slice(0, index + 1).filter((c) => !c.dayTrip).length}
                      </span>
                      <div className="min-w-0 flex-1">
                        <PlaceSearchInput
                          value={city.city}
                          onChange={(v) =>
                            setCity(index, { city: v, lat: undefined, lon: undefined })
                          }
                          onPick={(p) => {
                            const loc = locationFromParsedPlace(p);
                            setCity(index, {
                              city: loc.city,
                              country: loc.country,
                              lat: p.lat,
                              lon: p.lon,
                            });
                          }}
                          placeholder={`City ${index + 1} — search it`}
                          areas
                        />
                      </div>
                      {cities.length > 1 && (
                        <button
                          type="button"
                          aria-label={`Remove city ${index + 1}`}
                          onClick={() =>
                            // Its day trips go with it: they sleep there.
                            setCities((list) => {
                              const end = dayTripInsertAt(list, index);
                              return list.filter((_, i) => i < index || i >= end);
                            })
                          }
                          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground"
                        >
                          <X className="size-4" aria-hidden />
                        </button>
                      )}
                    </div>
                    <DateRangeField
                      start={city.start}
                      end={city.end}
                      onChange={(start, end) => setCity(index, { start, end })}
                      title={
                        city.city.trim()
                          ? `Dates in ${city.city.split(",")[0]}`
                          : "Dates in this city"
                      }
                      placeholder="Dates in this city"
                      month={cities[index - 1]?.end || form.start_date || undefined}
                    />
                    {cityOutsideTrip(city, form.start_date, form.end_date) && (
                      <p role="alert" className="px-1 text-[14px] font-medium text-destructive">
                        These dates fall outside the trip's.
                      </p>
                    )}
                    {city.city.trim() && (
                      <button
                        type="button"
                        onClick={() =>
                          setCities((list) => {
                            const at = dayTripInsertAt(list, index);
                            return [...list.slice(0, at), EMPTY_DAY_TRIP, ...list.slice(at)];
                          })
                        }
                        className="flex items-center gap-1 px-1 text-[12.5px] font-semibold text-primary"
                      >
                        <Plus className="size-3.5" aria-hidden />
                        Day trip from {shortCity(city.city)}
                      </button>
                    )}
                  </div>
                ),
              )}
              <button
                type="button"
                onClick={() => setCities((list) => [...list, EMPTY_CITY])}
                className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-[13.5px] font-semibold text-primary"
              >
                <Plus className="size-4" aria-hidden />
                Add another city
              </button>
            </div>
          )}
          {form.start_date && form.end_date && form.end_date < form.start_date && (
            <p role="alert" className="px-1 text-[14px] font-medium text-destructive">
              End date can't be earlier than the start date.
            </p>
          )}
          {packing.packs.length > 0 && (
            <label className="block px-1 py-1 text-[13px] text-muted-foreground">
              Attach a copy of a packing list
              <select
                value={packTemplateId}
                onChange={(e) => setPackTemplateId(e.target.value)}
                className="mt-1 w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2.5 text-[15px] text-foreground"
              >
                <option value="">No packing list</option>
                {packing.packs.map((pack) => (
                  <option key={pack.id} value={pack.id}>
                    {pack.emoji} {pack.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[12px]">
                You get a copy — ticking things off only affects this trip.
              </span>
            </label>
          )}
          <label className="flex items-center gap-2 px-1 py-1 text-[14.5px]">
            <input
              type="checkbox"
              checked={withBudget}
              onChange={(e) => setWithBudget(e.target.checked)}
              className="size-5"
            />
            Track a budget for this trip
          </label>
          <p className="px-1 text-[12px] text-muted-foreground">{tripStillEditableNote()}</p>
          <button
            disabled={
              saveBusy ||
              (!form.title.trim() && !suggestedName) ||
              !!(form.start_date && form.end_date && form.end_date < form.start_date)
            }
            onClick={async () => {
              if (saving.current) return;
              saving.current = true;
              setSaveBusy(true);
              setError("");
              try {
                const id = await t.createTrip({
                  ...form,
                  ...(multiCity
                    ? {
                        city: firstCity?.city ?? "",
                        country: firstCity?.country ?? "",
                        stops: citiesToStops(cities),
                      }
                    : {
                        stops: onePlaceStops(
                          {
                            city: form.city,
                            country: form.country,
                            start: tripStart,
                            end: tripEnd,
                          },
                          dayTrips,
                        ),
                      }),
                  start_date: tripStart,
                  end_date: tripEnd,
                  title: form.title.trim() || suggestedName,
                  budget_enabled: withBudget,
                });
                if (packTemplateId) await packing.attachToTrip(packTemplateId, id);
                setPackTemplateId("");
                await navigate({
                  to: "/trips/$tripId",
                  params: { tripId: id },
                  // Started from Plan with Béa: its planner opens on
                  // the new trip, with anything already typed.
                  search: search.plan
                    ? { plan: search.plan, ...(search.ask ? { ask: search.ask } : {}) }
                    : {},
                  viewTransition: true,
                });
                setForm({
                  title: "",
                  city: "",
                  country: "",
                  start_date: "",
                  end_date: "",
                  dates_status: "tentative",
                });
                setMultiCity(false);
                setCities([EMPTY_CITY, EMPTY_CITY]);
                setDayTrips([]);
                setWithBudget(false);
                setCreating(false);
              } catch (e) {
                setError(friendlyError(e, "Couldn't create the trip"));
              } finally {
                saving.current = false;
                setSaveBusy(false);
              }
            }}
            className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {saveBusy ? "Creating…" : "Create trip"}
          </button>
          {error && creating && (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          )}
        </div>
      </Sheet>

      <Sheet
        open={joining}
        onClose={() => {
          setError("");
          setJoining(false);
        }}
        title="Join with a code"
        hint="The code a friend shared from their trip."
      >
        <div className="space-y-2">
          <input
            aria-label="Invite code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Invite code"
            className="w-full rounded-xl border border-[var(--field-border)] bg-card px-3 py-2.5 text-[15px] tracking-widest"
          />
          <button
            disabled={code.length < 4}
            onClick={async () => {
              setError("");
              try {
                const id = await t.joinTrip(code, myName);
                await navigate({
                  to: "/trips/$tripId",
                  params: { tripId: id },
                  viewTransition: true,
                });
                setCode("");
                setJoining(false);
              } catch (e) {
                setError(friendlyError(e, "That code didn't work"));
              }
            }}
            className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            Join trip
          </button>
          {error && joining && (
            <p role="alert" className="text-[14px] text-destructive">
              {error}
            </p>
          )}
        </div>
      </Sheet>
    </AppShell>
  );
}

/** Nothing ahead: Béa's line and the way to start one. */
function NothingAhead({
  title,
  body,
  onPlan,
}: {
  title: string;
  body: string;
  onPlan: () => void;
}) {
  return (
    <div className="tile-fill-3 rounded-[var(--r-card)] p-4">
      <p className="font-display text-[22px] leading-snug">{title}</p>
      <p className="mt-1 text-[16px] text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onPlan}
        className="mt-3 min-h-11 rounded-full bg-primary px-5 text-[16px] font-semibold text-primary-foreground"
      >
        Plan a trip
      </button>
    </div>
  );
}

/** The city a day trip in the list goes out from, and sleeps in. */
function baseOf(cities: CityDraft[], index: number): CityDraft | null {
  for (let i = index - 1; i >= 0; i--) if (!cities[i]!.dayTrip) return cities[i]!;
  return null;
}

/** A day out and back: where to, and the one day. */
function DayTripRow({
  trip,
  base,
  min,
  max,
  outside,
  onChange,
  onRemove,
}: {
  trip: CityDraft;
  base: string;
  min: string;
  max: string;
  outside: boolean;
  onChange: (patch: Partial<CityDraft>) => void;
  onRemove: () => void;
}) {
  const from = shortCity(base);
  return (
    <div className="space-y-1.5 rounded-xl border border-dashed border-border bg-elevated p-2">
      <div className="flex items-center gap-1.5">
        <span aria-hidden className="grid size-6 shrink-0 place-items-center text-[14px]">
          🚆
        </span>
        <div className="min-w-0 flex-1">
          <PlaceSearchInput
            value={trip.city}
            onChange={(v) => onChange({ city: v, lat: undefined, lon: undefined })}
            onPick={(p) => {
              const loc = locationFromParsedPlace(p);
              onChange({ city: loc.city, country: loc.country, lat: p.lat, lon: p.lon });
            }}
            placeholder={from ? `Day trip from ${from} — where to?` : "Day trip — where to?"}
            areas
          />
        </div>
        <button
          type="button"
          aria-label="Remove this day trip"
          onClick={onRemove}
          className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <label className="flex flex-wrap items-center gap-2 px-1 text-[12.5px] text-muted-foreground">
        On
        <input
          type="date"
          value={trip.start}
          {...(min ? { min } : {})}
          {...(max ? { max } : {})}
          aria-label="The day of this day trip"
          onChange={(e) => onChange({ start: e.target.value, end: e.target.value })}
          className="min-h-11 rounded-xl border border-[var(--field-border)] bg-card px-3 py-2 text-[14.5px] text-foreground"
        />
      </label>
      <p className="px-1 text-[12px] text-muted-foreground">
        {from ? `Back to ${from} for the night.` : "Back the same night."}
      </p>
      {outside && (
        <p role="alert" className="px-1 text-[14px] font-medium text-destructive">
          {from
            ? `This day falls outside your stay in ${from}.`
            : "This day falls outside the trip's."}
        </p>
      )}
    </div>
  );
}

/**
 * The trips this traveller follows, read when Trips opens and again for
 * another account; null until read and while following is not set up (its
 * migration). A read that fails says so (`failed`), with `retry`, instead
 * of looking like an empty list. A list belongs to the account it was read
 * for, so another account never sees it, even for a moment.
 */
function useFollowedTrips(userId: string | null): {
  trips: FollowedTrip[] | null;
  /** The read failed; the tab shows with a way to try again when this phone knows of follows. */
  failed: boolean;
  retry: () => void;
  /** A trip the traveller just stopped following leaves the list for good this visit. */
  forget: (token: string) => void;
} {
  const list = useServerFn(listFollowedTrips);
  const [read, setRead] = useState<{
    userId: string;
    trips: FollowedTrip[] | null;
    failed?: boolean;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!userId) return;
    // A retry, another account or leaving Trips cancels the read in flight.
    const request = new AbortController();
    list({ signal: request.signal })
      .then((trips) => {
        if (request.signal.aborted) return;
        if (trips) rememberFollows(userId, trips.length > 0);
        setRead({ userId, trips });
      })
      .catch(() => !request.signal.aborted && setRead({ userId, trips: null, failed: true }));
    return () => request.abort();
  }, [userId, list, attempt]);
  const forget = useCallback((token: string) => {
    setRead((r) => {
      if (!r?.trips) return r;
      const trips = r.trips.filter((t) => t.token !== token);
      // The last one removed: a later failed read must not bring the tab back.
      if (trips.length === 0) rememberFollows(r.userId, false);
      return { ...r, trips };
    });
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const mine = userId && read?.userId === userId ? read : null;
  return { trips: mine?.trips ?? null, failed: mine?.failed === true, retry, forget };
}
