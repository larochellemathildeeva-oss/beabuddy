import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { FileText, Settings, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { DocumentVault } from "@/components/DocumentVault";
import { PackingLists } from "@/components/PackingLists";
import { DateRangeField } from "@/components/DateRangeField";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TripBudget } from "@/components/TripBudget";
import { TripStops } from "@/components/TripStops";
import { ItineraryImport } from "@/components/ItineraryImport";
import { ItineraryDirections } from "@/components/ItineraryDirections";

import { useAuth } from "@/hooks/useAuth";
import { prettyDistance, prettyDuration, useOfflineDirections } from "@/hooks/useOfflineDirections";
import type { RouteLeg } from "@/lib/directions.functions";
import { useTripBoard, useTrips, type TripRow } from "@/hooks/useTrips";
import { useTripStops } from "@/hooks/useTripStops";
import { useTripBudget } from "@/hooks/useTripBudget";
import { usePacking } from "@/hooks/usePacking";
import { stopsForDirections, timelineStopsForDirections } from "@/lib/direction-stops";
import { formatTripLocation, locationFromParsedPlace } from "@/lib/place-label";
import { unroutedLegCopy } from "@/lib/timeline-directions";
import { tripCompanionsLine, tripStillEditableNote } from "@/lib/trip-copy";
import type { DatesStatus } from "@/lib/trip-dates";
import logo from "@/assets/bea-logo.png";

export const Route = createFileRoute("/trips")({
  head: () => ({
    meta: [
      { title: "Trips — Béa" },
      {
        name: "description",
        content:
          "Every trip as a folder: a shared timeline you edit together, live presence, reservations, documents, budget and the debrief you wrote afterwards.",
      },
      { property: "og:title", content: "Trips — Béa" },
      {
        property: "og:description",
        content:
          "Trip folders with a live shared itinerary, invited friends and an encrypted document vault.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TripsPage,
});

const OPEN_TRIP_KEY = "bea.trips.open";

function TripsPage() {
  const { user } = useAuth();
  const t = useTrips();
  const [openId, setOpenId] = useState<string>("");

  // Switching tabs unmounts this route, so the expanded trip used to collapse and
  // take its timeline, budget and saved directions with it — which reads as
  // "everything disappeared" rather than "the card closed". Remember it for the
  // session. Restored in an effect, not in useState, so SSR and the first client
  // render agree.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(OPEN_TRIP_KEY);
      if (stored) setOpenId(stored);
    } catch {
      /* private mode, or storage disabled — just start collapsed */
    }
  }, []);

  const openTrip = useCallback((id: string) => {
    setOpenId(id);
    try {
      if (id) sessionStorage.setItem(OPEN_TRIP_KEY, id);
      else sessionStorage.removeItem(OPEN_TRIP_KEY);
    } catch {
      /* not being able to remember it is not worth failing the click over */
    }
  }, []);
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
  const [withBudget, setWithBudget] = useState(false);
  const packing = usePacking(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  const myName =
    (user?.user_metadata?.["display_name"] as string | undefined) ??
    user?.email?.split("@")[0] ??
    "Traveller";

  return (
    <AppShell eyebrow="Trip folders" title="Everything, already filed.">
      <div className="space-y-5">
        <div className="flex gap-2">
          <Link
            to="/calendar"
            className="flex-1 rounded-xl border border-border px-3 py-2.5 text-center text-[12px] font-semibold"
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
                className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
              >
                New trip
              </button>
              <button
                data-guide="join-trip"
                onClick={() => {
                  setJoining(!joining);
                  setCreating(false);
                }}
                className="flex-1 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
              >
                Join with a code
              </button>
            </div>

            {creating && (
              <div className="rise card-soft space-y-2 p-4">
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Trip name"
                  className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
                />
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
                <p className="px-1 text-[11px] text-muted-foreground">
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
                {form.start_date &&
                  form.end_date &&
                  form.end_date < form.start_date && (
                    <p className="px-1 text-[12px] font-medium text-destructive">
                      End date can't be earlier than the start date.
                    </p>
                  )}
                {packing.packs.length > 0 && (
                  <label className="block px-1 py-1 text-[12px] text-muted-foreground">
                    Attach a copy of a packing list
                    <select
                      value={packTemplateId}
                      onChange={(e) => setPackTemplateId(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px] text-foreground"
                    >
                      <option value="">No packing list</option>
                      {packing.packs.map((pack) => (
                        <option key={pack.id} value={pack.id}>
                          {pack.emoji} {pack.name}
                        </option>
                      ))}
                    </select>
                    <span className="mt-1 block text-[11px]">
                      You get a copy — ticking things off only affects this trip.
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-2 px-1 py-1 text-[13px]">
                  <input
                    type="checkbox"
                    checked={withBudget}
                    onChange={(e) => setWithBudget(e.target.checked)}
                    className="size-5 accent-[hsl(var(--primary))]"
                  />
                  Track a budget for this trip
                </label>
                <p className="px-1 text-[11px] text-muted-foreground">{tripStillEditableNote()}</p>
                <button
                  disabled={
                    !form.title.trim() ||
                    !!(form.start_date && form.end_date && form.end_date < form.start_date)
                  }
                  onClick={async () => {
                    setError("");
                    try {
                      const id = await t.createTrip({ ...form, budget_enabled: withBudget });
                      if (packTemplateId) await packing.attachToTrip(packTemplateId, id);
                      setPackTemplateId("");
                      openTrip(id);
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
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
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
                  className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px] tracking-widest"
                />
                <button
                  disabled={code.length < 4}
                  onClick={async () => {
                    setError("");
                    try {
                      const id = await t.joinTrip(code, myName);
                      openTrip(id);
                      setCode("");
                      setJoining(false);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "That code didn't work");
                    }
                  }}
                  className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  Join trip
                </button>
              </div>
            )}

            {error && <p className="text-[12px] text-destructive">{error}</p>}

            <div data-guide="trip-list" className="space-y-3">
              {t.trips.map((trip) => (
                <LiveTripCard
                  key={trip.id}
                  trip={trip}
                  companionsLine={tripCompanionsLine(
                    t.members.filter((m) => m.trip_id === trip.id),
                    t.uid,
                  )}
                  open={openId === trip.id}
                  onToggle={() => openTrip(openId === trip.id ? "" : trip.id)}
                  me={{ id: t.uid, name: myName }}
                  onInvite={() => t.inviteToTrip(trip.id)}
                  onUpdate={(patch) => t.updateTrip(trip.id, patch)}
                  onDelete={() => t.deleteTrip(trip.id)}
                />
              ))}
              {t.trips.length === 0 && !t.loading && (
                <p className="py-8 text-center text-[13px] text-muted-foreground">
                  No trips yet. Create one, then invite whoever's coming.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="card-soft p-4">
            <p className="font-display text-[19px] leading-snug">Sign in to start a trip.</p>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Trips, itineraries, invited friends and offline directions all save to your account.
            </p>
            <Link
              to="/auth"
              className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
            >
              Sign in or create an account
            </Link>
          </div>
        )}

        <section data-guide="document-vault">
          <div className="mb-3 flex items-baseline justify-between">
            <p className="label-caps text-foreground">Document vault</p>
            <span className="text-[11px] text-muted-foreground">End-to-end encrypted</span>
          </div>
          <DocumentVault />
        </section>
      </div>
    </AppShell>
  );
}

function LiveTripCard({
  trip,
  companionsLine,
  open,
  onToggle,
  me,
  onInvite,
  onUpdate,
  onDelete,
}: {
  trip: TripRow;
  companionsLine: string;
  open: boolean;
  onToggle: () => void;
  me: { id: string | null; name: string };
  onInvite: () => Promise<string>;
  onUpdate: (patch: Partial<TripRow>) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerTab, setPlannerTab] = useState<"import" | "optimize" | "compare">("import");
  // The Béa planner button lives in the card header, outside the expanded view,
  // so anything it writes to needs a trip id even while the card is collapsed —
  // otherwise saving its plan failed with "Open a trip first".
  const activeId = open || plannerOpen ? trip.id : null;
  const board = useTripBoard(activeId, me);
  const budget = useTripBudget(activeId);
  const cities = useTripStops(activeId, me.id);
  const dir = useOfflineDirections(activeId);
  const directionStops = timelineStopsForDirections(board.items);
  const routeStops = stopsForDirections(cities.stops, board.items);
  const directionArea = formatTripLocation(trip.city, trip.country) || undefined;
  const templates = usePacking(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sheetSection, setSheetSection] = useState<
    "invite" | "budget" | "edit" | "offline" | "packing" | null
  >(null);
  const [packTemplateId, setPackTemplateId] = useState("");
  const [packMsg, setPackMsg] = useState("");
  const [packSignal, setPackSignal] = useState(0);
  const [inviteCode, setInviteCode] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingTimeline, setAddingTimeline] = useState(false);
  const [timelineDraft, setTimelineDraft] = useState({
    kind: "activity",
    day_date: "",
    time_label: "",
    title: "",
    detail: "",
  });
  const [timelineError, setTimelineError] = useState("");
  const [tripForm, setTripForm] = useState({
    title: trip.title,
    city: formatTripLocation(trip.city, trip.country),
    country: trip.country ?? "",
    start_date: trip.start_date ?? "",
    end_date: trip.end_date ?? "",
    dates_status: trip.dates_status,
    status: trip.status,
  });
  const others = board.present.filter((p) => p.userId !== me.id);

  return (
    <article className="card-soft overflow-hidden">
      <div className="flex items-start gap-1 p-4 pb-3">
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <span className="label-caps">
            {trip.status === "past"
              ? "Past"
              : trip.status === "active"
                ? "In progress"
                : "Upcoming"}
          </span>
          <h2 className="mt-1 text-[22px] leading-tight">{trip.title}</h2>
          <p className="text-[12px] text-muted-foreground">
            {formatTripLocation(trip.city, trip.country)}
            {trip.start_date
              ? ` · ${trip.dates_status === "tentative" ? "Tentative · " : ""}${trip.start_date}${trip.end_date ? ` – ${trip.end_date}` : ""}`
              : ""}
          </p>
          <p className="mt-1 truncate text-[12px] text-muted-foreground">{companionsLine}</p>
        </button>
        <button
          data-guide="bea-plan"
          aria-label="Let Béa plan this trip"
          title="Let Béa plan this trip"
          onClick={() => {
            if (!open) onToggle();
            setPlannerTab("import");
            setPlannerOpen(true);
          }}
          className="relative grid size-9 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10"
        >
          <img src={logo} alt="" className="size-7 object-contain" />
          <Sparkles className="absolute -right-1 -top-1 size-3.5 rounded-full bg-card p-0.5 text-primary" />
        </button>
        <button
          data-guide="packing-lists"
          aria-label="Add packing list to this trip"
          title="Add packing list to this trip"
          onClick={() => {
            if (!open) onToggle();
            setPackSignal((n) => n + 1);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <FileText className="size-4" />
        </button>
        <button
          aria-label="Trip settings"
          onClick={() => {
            setSettingsOpen(true);
            setSheetSection(null);
          }}
          className="grid size-9 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
        >
          <Settings className="size-4" />
        </button>
      </div>

      {open && (
        <div className="rise border-t border-border px-4 pb-4 pt-3">
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-elevated px-3 py-2">
            <div className="flex items-center gap-2">
              <span className="size-1.5 animate-pulse rounded-full bg-nexttime" />
              <p className="text-[12px] text-muted-foreground">
                {others.length === 0
                  ? "You're the only one here right now"
                  : others.some((o) => o.editing)
                    ? `${others.find((o) => o.editing)?.name} is editing ${others.find((o) => o.editing)?.editing}`
                    : `${others.map((o) => o.name).join(", ")} ${others.length === 1 ? "is" : "are"} here`}
              </p>
            </div>
            <div className="flex -space-x-1.5">
              {others.slice(0, 3).map((o) => (
                <span
                  key={o.userId}
                  title={o.name}
                  className="grid size-6 place-items-center rounded-full border border-card bg-primary text-[10px] font-semibold text-primary-foreground"
                >
                  {o.name.slice(0, 1).toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          <TripStops tripId={trip.id} uid={me.id} />

          <PackingLists
            tripId={trip.id}
            label="Packing list for this trip"
            hint="Only this trip. Tick things off as you pack."
            openSignal={packSignal}
            hideTrigger
          />

          {trip.budget_enabled && <TripBudget tripId={trip.id} />}

          <div data-guide="trip-timeline" className="mb-3 rounded-xl border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="label-caps text-foreground">What you're doing</p>
                <p className="text-[11px] text-muted-foreground">
                  {board.items.length === 0
                    ? "Add activities, meals, transport and notes."
                    : `${board.items.length} entr${board.items.length === 1 ? "y" : "ies"}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <button
                  onClick={() => {
                    setTimelineDraft({ kind: "activity", day_date: "", time_label: "", title: "", detail: "" });
                    setTimelineError("");
                    setAddingTimeline(!addingTimeline);
                  }}
                  className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
                >
                  {addingTimeline ? "Cancel" : "Add to timeline"}
                </button>
                {board.items.length >= 2 && (
                  <button
                    data-guide="optimize-trip"
                    onClick={() => {
                      setPlannerTab("optimize");
                      setPlannerOpen(true);
                    }}
                    className="rounded-xl border border-border px-3 py-2 text-[12px] font-semibold"
                  >
                    Optimize
                  </button>
                )}
              </div>
            </div>



          <ol className="relative space-y-3 border-l border-border pl-4">
            {board.items.map((item, i) => (
              <li key={item.id} className="relative">
                <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {[item.day_date, item.time_label].filter(Boolean).join(" · ")} · {item.kind}
                </p>
                <input
                  defaultValue={item.title}
                  onFocus={() => board.setEditing(item.title)}
                  onBlur={(e) => {
                    board.setEditing(null);
                    if (e.target.value.trim() && e.target.value !== item.title)
                      void board.updateItem(item.id, { title: e.target.value.trim() });
                  }}
                  className="w-full bg-transparent text-[14px] font-medium outline-none"
                />
                <input
                  defaultValue={item.detail ?? ""}
                  placeholder="Add a detail"
                  onFocus={() => board.setEditing(item.title)}
                  onBlur={(e) => {
                    board.setEditing(null);
                    if (e.target.value !== (item.detail ?? ""))
                      void board.updateItem(item.id, { detail: e.target.value });
                  }}
                  className="w-full bg-transparent text-[12px] text-muted-foreground outline-none"
                />
                {item.address && (
                  <p className="text-[11px] text-muted-foreground">
                    📍 {item.address}
                    {item.lat != null && item.lon != null && (
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${item.lat}&mlon=${item.lon}#map=17/${item.lat}/${item.lon}`}
                        target="_blank"
                        rel="noreferrer"
                        className="ml-2 font-semibold text-primary underline"
                      >
                        Map
                      </a>
                    )}
                  </p>
                )}
                <StopDirections leg={dir.saved?.legs[i]} />
                <button
                  onClick={() => void board.removeItem(item.id)}
                  className="mt-0.5 text-[11px] text-muted-foreground underline"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>

          {addingTimeline && (
            <div className="mt-3 space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap gap-1.5">
                {[
                  ["activity", "Activity"],
                  ["meal", "Meal"],
                  ["transport", "Transport"],
                  ["lodging", "Lodging"],
                  ["note", "Note"],
                ].map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTimelineDraft({ ...timelineDraft, kind: v as string })}
                    className={`rounded-full border px-3 py-1.5 text-[12px] ${
                      timelineDraft.kind === v
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <input
                value={timelineDraft.title}
                onChange={(e) => setTimelineDraft({ ...timelineDraft, title: e.target.value })}
                placeholder="What's happening?"
                className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  aria-label="Day"
                  value={timelineDraft.day_date}
                  onChange={(e) => setTimelineDraft({ ...timelineDraft, day_date: e.target.value })}
                  className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                />
                <input
                  value={timelineDraft.time_label}
                  onChange={(e) => setTimelineDraft({ ...timelineDraft, time_label: e.target.value })}
                  placeholder="Time (e.g. 14:00)"
                  className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                />
              </div>
              <input
                value={timelineDraft.detail}
                onChange={(e) => setTimelineDraft({ ...timelineDraft, detail: e.target.value })}
                placeholder="Detail (optional)"
                className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
              />
              {timelineError && <p className="text-[11px] text-destructive">{timelineError}</p>}
              <button
                disabled={!timelineDraft.title.trim()}
                onClick={async () => {
                  setTimelineError("");
                  try {
                    await board.addItem({
                      kind: timelineDraft.kind,
                      title: timelineDraft.title.trim(),
                      day_date: timelineDraft.day_date,
                      time_label: timelineDraft.time_label,
                      detail: timelineDraft.detail,
                    });
                    setTimelineDraft({ kind: "activity", day_date: "", time_label: "", title: "", detail: "" });
                    setAddingTimeline(false);
                  } catch (e) {
                    setTimelineError(e instanceof Error ? e.message : "Couldn't add that entry");
                  }
                }}
                className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Add to timeline
              </button>
            </div>
          )}
          </div>

          <ItineraryDirections
            stops={directionStops}
            existingTitles={board.items.map((i) => i.title)}
            onAddToTimeline={board.addItems}
            {...(directionArea ? { area: directionArea } : {})}
          />

        </div>
      )}

      <ItineraryImport
        open={plannerOpen}
        onClose={() => setPlannerOpen(false)}
        defaultTab={plannerTab}
        existingItems={board.items.map((item) => ({
          id: item.id,
          day_date: item.day_date,
          time_label: item.time_label,
          kind: item.kind,
          title: item.title,
          detail: item.detail,
          address: item.address,
          lat: item.lat,
          lon: item.lon,
        }))}
        cities={cities.stops.map((stop) => ({
          city: stop.city,
          country: stop.country,
          arrive_on: stop.arrive_on,
          depart_on: stop.depart_on,
          lat: stop.lat,
          lon: stop.lon,
        }))}
        {...(trip.city ? { tripCity: [trip.city, trip.country].filter(Boolean).join(", ") } : {})}
        {...(trip.start_date ? { startDate: trip.start_date } : {})}
        {...(trip.end_date ? { endDate: trip.end_date } : {})}
        onAddItems={board.addItems}
        onAddCosts={async (items) => {
          if (!trip.budget_enabled) await onUpdate({ budget_enabled: true });
          await budget.addItems(items);
        }}
        onApplySchedule={board.applySchedule}
        onApplyDates={async (dates) => {
          await onUpdate(dates);
        }}
      />

      {settingsOpen && (
        <div
          role="dialog"
          aria-label="Trip settings"
          onClick={() => setSettingsOpen(false)}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[85vh] w-full max-w-sm overflow-y-auto rounded-t-3xl bg-card p-5 sm:rounded-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-[19px] leading-snug">{trip.title}</p>
              <button
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
                className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-1">
              <button
                onClick={() => setSheetSection(sheetSection === "invite" ? null : "invite")}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold hover:bg-elevated"
              >
                Invite a friend
              </button>
              {sheetSection === "invite" && (
                <div className="rounded-xl border border-border p-3">
                  <button
                    onClick={async () => setInviteCode(await onInvite())}
                    className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
                  >
                    Create an invite code
                  </button>
                  {inviteCode && (
                    <p className="mt-2 text-center text-[13px] text-muted-foreground">
                      Share this code:{" "}
                      <span className="font-semibold tracking-widest text-foreground">
                        {inviteCode}
                      </span>
                    </p>
                  )}
                  {!inviteCode && board.invites[0] && (
                    <p className="mt-2 text-center text-[13px] text-muted-foreground">
                      Last code:{" "}
                      <span className="font-semibold tracking-widest text-foreground">
                        {board.invites[0].code}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={() => setSheetSection(sheetSection === "packing" ? null : "packing")}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold hover:bg-elevated"
              >
                Attach a packing list
              </button>
              {sheetSection === "packing" && (
                <div className="rounded-xl border border-border p-3">
                  {templates.packs.length === 0 ? (
                    <p className="text-[12px] text-muted-foreground">
                      No saved lists yet — create one under Profile → Create packing lists.
                    </p>
                  ) : (
                    <>
                      <p className="text-[11px] text-muted-foreground">
                        You get a copy — ticking things off only affects this trip.
                      </p>
                      <select
                        value={packTemplateId}
                        onChange={(e) => {
                          setPackTemplateId(e.target.value);
                          setPackMsg("");
                        }}
                        className="mt-2 w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                      >
                        <option value="">Choose a list…</option>
                        {templates.packs.map((pk) => (
                          <option key={pk.id} value={pk.id}>
                            {pk.emoji} {pk.name}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={!packTemplateId}
                        onClick={async () => {
                          if (!packTemplateId) return;
                          await templates.attachToTrip(packTemplateId, trip.id);
                          setPackTemplateId("");
                          setPackMsg("List attached — open the trip to tick items off.");
                        }}
                        className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        Attach a copy to this trip
                      </button>
                      {packMsg && (
                        <p className="mt-2 text-[12px] text-muted-foreground">{packMsg}</p>
                      )}
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => setSheetSection(sheetSection === "offline" ? null : "offline")}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold hover:bg-elevated"
              >
                Offline directions
                {dir.saved && (
                  <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                    Saved {new Date(dir.saved.savedAt).toLocaleDateString()}
                  </span>
                )}
              </button>
              {sheetSection === "offline" && (
                <div className="rounded-xl border border-border p-3">
                  <p className="text-[11px] text-muted-foreground">
                    Download the walk or drive between stops so the steps work with no service.
                    Adding directions to the timeline saves the summary — not the offline map.
                  </p>
                  <button
                    disabled={dir.busy || routeStops.length < 2}
                    onClick={() =>
                      void dir.download(
                        routeStops,
                        directionArea,
                      )
                    }
                    className="mt-2 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {dir.busy
                      ? "Saving…"
                      : dir.saved
                        ? "Refresh directions"
                        : "Download directions"}
                  </button>
                  {routeStops.length < 2 && (
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Add at least two cities to this trip first (or two timeline entries with
                      places).
                    </p>
                  )}
                  {dir.error && <p className="mt-2 text-[11px] text-destructive">{dir.error}</p>}
                  {dir.saved && (
                    <div className="mt-3 space-y-2">
                      {dir.saved.legs.map((l, i) => (
                        <details key={i} className="rounded-xl bg-elevated px-3 py-2">
                          <summary className="cursor-pointer text-[13px] font-medium">
                            {l.from} → {l.to}
                            <span className="ml-2 text-[11px] font-normal text-muted-foreground">
                              {l.distance > 0
                                ? `${l.mode === "walking" ? "Walk" : "Drive"} · ${prettyDistance(l.distance)} · ${prettyDuration(l.duration)}`
                                : unroutedLegCopy(l)}
                            </span>
                          </summary>
                          <ol className="mt-2 space-y-1">
                            {l.steps.map((s, k) => (
                              <li key={k} className="text-[12px] text-muted-foreground">
                                {s.instruction}
                                {s.distance > 0 ? ` — ${prettyDistance(s.distance)}` : ""}
                              </li>
                            ))}
                          </ol>
                          <a
                            href={l.mapUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 inline-block text-[12px] font-semibold text-primary"
                          >
                            Open in maps (needs service)
                          </a>
                        </details>
                      ))}
                      {dir.saved.unresolved.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Couldn't find on the map: {dir.saved.unresolved.join(", ")}
                        </p>
                      )}
                      {(dir.saved.deferred?.length || dir.saved.legs.some((l) => l.capped)) && (
                        <p className="text-[11px] text-muted-foreground">
                          Later stretches open in maps — Béa stops looking after a long list.
                        </p>
                      )}
                      <button
                        onClick={dir.clear}
                        className="text-[11px] text-muted-foreground underline"
                      >
                        Delete saved directions
                      </button>
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={() => setSheetSection(sheetSection === "budget" ? null : "budget")}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold hover:bg-elevated"
              >
                Budget Options
              </button>
              {sheetSection === "budget" && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <label className="flex items-center gap-2 px-1 text-[13px]">
                    <input
                      type="checkbox"
                      checked={trip.budget_enabled}
                      onChange={(e) => void onUpdate({ budget_enabled: e.target.checked })}
                      className="size-5 accent-[hsl(var(--primary))]"
                    />
                    Track a budget for this trip
                  </label>
                </div>
              )}

              <button
                onClick={() => {
                  const next = sheetSection === "edit" ? null : "edit";
                  setSheetSection(next);
                  if (next === "edit") {
                    setTripForm({
                      title: trip.title,
                      city: formatTripLocation(trip.city, trip.country),
                      country: trip.country ?? "",
                      start_date: trip.start_date ?? "",
                      end_date: trip.end_date ?? "",
                      dates_status: trip.dates_status,
                      status: trip.status,
                    });
                  }
                }}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold hover:bg-elevated"
              >
                Trip Options
              </button>
              {sheetSection === "edit" && (
                <div className="space-y-2 rounded-xl border border-border p-3">
                  <input
                    value={tripForm.title}
                    onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
                    placeholder="Trip name"
                    className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
                  />
                  <PlaceSearchInput
                    value={tripForm.city}
                    onChange={(v) => setTripForm({ ...tripForm, city: v })}
                    onPick={(p) => {
                      const loc = locationFromParsedPlace(p);
                      setTripForm({
                        ...tripForm,
                        city: loc.city,
                        country: loc.country || tripForm.country,
                      });
                    }}
                    placeholder="Starting city — search it"
                  />
                  <DateRangeField
                    start={tripForm.start_date}
                    end={tripForm.end_date}
                    onChange={(start_date, end_date) =>
                      setTripForm({ ...tripForm, start_date, end_date })
                    }
                    datesStatus={tripForm.dates_status}
                    onDatesStatusChange={(dates_status) =>
                      setTripForm({ ...tripForm, dates_status })
                    }
                    className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-left text-[13px]"
                  />
                  {tripForm.start_date &&
                    tripForm.end_date &&
                    tripForm.end_date < tripForm.start_date && (
                      <p className="px-1 text-[12px] font-medium text-destructive">
                        End date can't be earlier than the start date.
                      </p>
                    )}
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      ["upcoming", "Upcoming"],
                      ["active", "In progress"],
                      ["past", "Past"],
                    ].map(([v, label]) => (
                      <button
                        key={v}
                        onClick={() => setTripForm({ ...tripForm, status: v as string })}
                        className={`rounded-full border px-3 py-1.5 text-[12px] ${
                          tripForm.status === v
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <button
                    disabled={
                      !tripForm.title.trim() ||
                      !!(
                        tripForm.start_date &&
                        tripForm.end_date &&
                        tripForm.end_date < tripForm.start_date
                      )
                    }
                    onClick={async () => {
                      await onUpdate({
                        title: tripForm.title.trim(),
                        city: tripForm.city,
                        country: tripForm.country,
                        start_date: tripForm.start_date,
                        end_date: tripForm.end_date,
                        dates_status: tripForm.dates_status,
                        status: tripForm.status,
                      } as Partial<TripRow>);
                    }}
                    className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    Save changes
                  </button>
                </div>
              )}

              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full rounded-xl px-3 py-3 text-left text-[14px] font-semibold text-destructive hover:bg-elevated"
              >
                Delete trip
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          role="dialog"
          aria-label="Delete trip confirmation"
          onClick={() => setConfirmDelete(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmDelete(false);
          }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-t-3xl bg-card p-5 text-center sm:rounded-2xl"
          >
            <p className="font-display text-[19px] leading-snug">Delete this trip?</p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              This permanently removes the trip, its timeline, stops, budget and invites. This can't
              be undone.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 rounded-xl border border-border px-3 py-2.5 text-[13px] font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setConfirmDelete(false);
                  setSettingsOpen(false);
                  void onDelete();
                }}
                className="flex-1 rounded-xl bg-destructive px-3 py-2.5 text-[13px] font-semibold text-destructive-foreground"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}


/**
 * Saved walking/driving directions for the leg that starts at this stop.
 * Collapsed to a single quiet line so the timeline stays readable — the steps
 * are only worth screen space at the moment someone is about to walk them.
 */
function StopDirections({ leg }: { leg?: RouteLeg | undefined }) {
  const [open, setOpen] = useState(false);
  if (!leg) return null;

  const measured = leg.distance > 0;
  const summary = measured
    ? `${leg.mode === "walking" ? "Walk" : "Drive"} to ${leg.to} · ${prettyDistance(leg.distance)} · ${prettyDuration(leg.duration)}`
    : `Directions to ${leg.to}`;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="text-[11px] font-medium text-primary underline underline-offset-2"
      >
        {open ? "Hide directions" : summary}
      </button>
      {open && (
        <div className="mt-1.5 rounded-lg border border-border bg-elevated p-2">
          {leg.steps.length > 0 ? (
            <ol className="space-y-1">
              {leg.steps.map((step, s) => (
                <li key={s} className="text-[11px] text-muted-foreground">
                  {step.instruction}
                  {step.distance > 0 && ` · ${prettyDistance(step.distance)}`}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-[11px] text-muted-foreground">{unroutedLegCopy(leg)}.</p>
          )}
          <a
            href={leg.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-[11px] font-semibold text-primary underline"
          >
            Open in maps
          </a>
        </div>
      )}
    </div>
  );
}
