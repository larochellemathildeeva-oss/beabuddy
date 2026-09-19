import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentVault } from "@/components/DocumentVault";
import { DateRangeField } from "@/components/DateRangeField";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TripBanner } from "@/components/TripBanner";
import { TripListSkeleton } from "@/components/Skeletons";
import { useTripPhotos, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { pickTripPhoto } from "@/lib/trip-card";
import { suggestedTripTitle } from "@/lib/timeline-entry";
import { useAuth } from "@/hooks/useAuth";
import { useTrips, type TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { beaTripNote } from "@/lib/trip-note";
import { usePacking } from "@/hooks/usePacking";
import { locationFromParsedPlace } from "@/lib/place-label";
import { tripCompanionsLine, tripStillEditableNote } from "@/lib/trip-copy";
import { beaLine } from "@/lib/bea-voice";
import { toLocalISODate, type DatesStatus } from "@/lib/trip-dates";

export const Route = createFileRoute("/trips")({
  staticData: { plane: "tab" },
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
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [form, setForm] = useState({
    title: "",
    city: "",
    country: "",
    start_date: "",
    end_date: "",
    dates_status: "tentative" as DatesStatus,
  });
  // A trip should not need a name before Béa will keep anything — "Lisbon,
  // sometime in March" is a trip. The city and dates suggest one.
  const suggestedName = suggestedTripTitle(form.city, form.start_date);
  const [withBudget, setWithBudget] = useState(false);
  const packing = usePacking(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Traveller";
  const { photos } = useTripPhotos(t.uid);

  return (
    <AppShell eyebrow="Trip folders" title="Everything, already filed.">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Link
            to="/calendar"
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-center text-[13px] font-semibold"
          >
            Calendar view
          </Link>
        </div>

        {t.signedIn ? (
          <>
            <div className="flex gap-2">
              <button
                data-guide="new-trip"
                onClick={() => {
                  setCreating(!creating);
                  setJoining(false);
                }}
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
              >
                New trip
              </button>
              <button
                data-guide="join-trip"
                onClick={() => {
                  setJoining(!joining);
                  setCreating(false);
                }}
                className="flex-1 rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold"
              >
                Join with a code
              </button>
            </div>

            {creating && (
              <div className="rise card-soft space-y-2 p-4">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={suggestedName || "Trip name"}
                  aria-label="Trip name"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
                />
                {!form.title.trim() && suggestedName && (
                  <p className="px-1 text-[12px] text-muted-foreground">
                    No name needed — Béa will file this as “{suggestedName}”. Type over it whenever
                    you like.
                  </p>
                )}
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
                  placeholder="Starting city — search it"
                />
                <p className="px-1 text-[12px] text-muted-foreground">
                  Going to more than one country? Open the trip after creating it and add each stop
                  — including layovers.
                </p>
                <DateRangeField
                  start={form.start_date}
                  end={form.end_date}
                  onChange={(start_date, end_date) => setForm({ ...form, start_date, end_date })}
                  datesStatus={form.dates_status}
                  onDatesStatusChange={(dates_status) => setForm({ ...form, dates_status })}
                />
                {form.start_date && form.end_date && form.end_date < form.start_date && (
                  <p className="px-1 text-[13px] font-medium text-destructive">
                    End date can't be earlier than the start date.
                  </p>
                )}
                {packing.packs.length > 0 && (
                  <label className="block px-1 py-1 text-[13px] text-muted-foreground">
                    Attach a copy of a packing list
                    <select
                      value={packTemplateId}
                      onChange={(e) => setPackTemplateId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px] text-foreground"
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
                    (!form.title.trim() && !suggestedName) ||
                    !!(form.start_date && form.end_date && form.end_date < form.start_date)
                  }
                  onClick={async () => {
                    setError("");
                    try {
                      const id = await t.createTrip({
                        ...form,
                        title: form.title.trim() || suggestedName,
                        budget_enabled: withBudget,
                      });
                      if (packTemplateId) await packing.attachToTrip(packTemplateId, id);
                      setPackTemplateId("");
                      await navigate({
                        to: "/trips/$tripId",
                        params: { tripId: id },
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
                      setWithBudget(false);
                      setCreating(false);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Couldn't create the trip");
                    }
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Create trip
                </button>
              </div>
            )}

            {joining && (
              <div className="rise card-soft space-y-2 p-4">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Invite code"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px] tracking-widest"
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
                      setError(e instanceof Error ? e.message : "That code didn't work");
                    }
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Join trip
                </button>
              </div>
            )}

            {error && <p className="text-[13px] text-destructive">{error}</p>}

            <div data-guide="trip-list" className="space-y-3">
              {t.loading && t.trips.length === 0 && <TripListSkeleton />}
              {t.trips.map((trip) => (
                <TripListCard
                  key={trip.id}
                  trip={trip}
                  photos={photos}
                  companionsLine={tripCompanionsLine(
                    t.members.filter((m) => m.trip_id === trip.id),
                    t.uid,
                  )}
                />
              ))}
              {t.trips.length === 0 && !t.loading && (
                <div className="py-8 text-center">
                  <p className="font-display text-[18px] leading-snug">
                    {beaLine("empty.trips").title}
                  </p>
                  <p className="mt-1 text-[14.5px] text-muted-foreground">
                    {beaLine("empty.trips").body}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="card-soft p-4">
            <p className="font-display text-[19px] leading-snug">Sign in to start a trip.</p>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Trips, itineraries, invited friends and saved directions all save to your account.
            </p>
            <Link
              to="/auth"
              className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[14.5px] font-semibold text-primary-foreground"
            >
              Sign in or create an account
            </Link>
          </div>
        )}

        <section data-guide="document-vault">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label-caps text-foreground">Trip documents</p>
            <span className="text-[12px] text-muted-foreground">Encrypted on this device</span>
          </div>
          <DocumentVault />
        </section>
      </div>
    </AppShell>
  );
}

/**
 * A trip in the list: its photograph, and the way in.
 *
 * The card carries the same `view-transition-name` as the banner on the trip's
 * own page, so tapping it hands the photograph to the destination rather than
 * cutting. `viewTransition` on the Link is what asks the browser to do it; on
 * a browser that does not support same-document transitions this degrades to
 * the ordinary navigation with no fallback code needed.
 */
function TripListCard({
  trip,
  photos,
  companionsLine,
}: {
  trip: TripRow;
  photos: TripPhotoRow[];
  companionsLine: string;
}) {
  const cities = useTripStops(trip.id, null);
  const banner = pickTripPhoto(photos, {
    city: trip.city,
    country: trip.country,
    cities: cities.stops.map((stop) => stop.city),
  });

  return (
    <Link
      to="/trips/$tripId"
      params={{ tripId: trip.id }}
      viewTransition
      className="card-soft block overflow-hidden"
    >
      <TripBanner
        title={trip.title}
        city={trip.city}
        country={trip.country}
        cities={cities.stops.map((stop) => stop.city)}
        startDate={trip.start_date}
        endDate={trip.end_date}
        tentative={trip.dates_status === "tentative"}
        photo={banner}
        companions={companionsLine}
        stops={cities.stops.map((stop) => ({
          title: stop.place_name || stop.city,
          ...(stop.lat != null ? { lat: stop.lat } : {}),
          ...(stop.lon != null ? { lon: stop.lon } : {}),
        }))}
        note={beaTripNote(
          {
            startDate: trip.start_date,
            endDate: trip.end_date,
            stopCount: cities.stops.length,
            plannedCount: null,
          },
          toLocalISODate(new Date()),
        )}
        viewTransitionName={`trip-photo-${trip.id}`}
      />
      <div className="flex items-center gap-2 p-3 text-[12.5px] text-muted-foreground">
        <span className="truncate">
          {[
            cities.stops.length ? `${cities.stops.length} stops` : "",
            trip.budget_enabled ? "Budget on" : "",
          ]
            .filter(Boolean)
            .join(" · ") || "Open to plan it"}
        </span>
        <span className="ml-auto shrink-0 font-semibold text-foreground">Open</span>
      </div>
    </Link>
  );
}
