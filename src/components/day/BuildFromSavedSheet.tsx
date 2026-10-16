import { useMemo, useState } from "react";
import { friendlyError } from "@/lib/friendly-error";
import { ArrowRight, Check } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useRecommendations, type RecoRowDB } from "@/hooks/useRecommendations";
import { isLocation } from "@/lib/place-lists";
import {
  AROUND,
  PACES,
  hopLine,
  planSaved,
  type SavedAround,
  type SavedPace,
  type SavedPick,
} from "@/lib/saved-plan";
import { tripDays } from "@/lib/stop-move";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";

type Addition = {
  day_date?: string;
  time_label?: string;
  kind: string;
  title: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
  planned_stay_minutes?: number;
};

type Step = "choose" | "review" | "saved";

const STEPS = [
  ["Choose places", "Pick from your Recs"],
  ["Preferences", "Pace and getting around"],
  ["Review", "Preview before save"],
  ["Save", "Final step"],
] as const;

const asPick = (r: RecoRowDB): SavedPick => ({
  id: r.id,
  name: r.name,
  category: r.category,
  address: r.address,
  lat: r.lat,
  lon: r.lon,
});

/**
 * "Build from saved places", as the Figma planning frames draw it: pick
 * places from Recs, choose a pace, preview the days Béa would make, and only
 * then save them to the trip. The preview is worked out here, from the pins
 * (`saved-plan.ts`); nothing is written until "Approve and save".
 */
export function BuildFromSavedSheet({
  open,
  onClose,
  trip,
  existingDays,
  onSave,
  onViewTimeline,
}: {
  open: boolean;
  onClose: () => void;
  trip: {
    title: string;
    city: string | null | undefined;
    country: string | null | undefined;
    start_date: string | null | undefined;
    end_date: string | null | undefined;
  };
  /** The days that already have stops, so the preview fills empty ones first. */
  existingDays: readonly (string | null)[];
  onSave: (additions: Addition[]) => Promise<unknown>;
  onViewTimeline: () => void;
}) {
  const { rows, loading } = useRecommendations();
  const [step, setStep] = useState<Step>("choose");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [allPlaces, setAllPlaces] = useState(false);
  const [pace, setPace] = useState<SavedPace>("balanced");
  const [around, setAround] = useState<SavedAround>("walk");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  const here = (trip.city ?? "").split(",")[0]!.trim().toLowerCase();
  const places = useMemo(() => rows.filter((r) => !isLocation(r)), [rows]);
  const local = useMemo(
    () =>
      places.filter((r) => {
        const c = (r.city ?? "").trim().toLowerCase();
        return here !== "" && c !== "" && (c.includes(here) || here.includes(c));
      }),
    [places, here],
  );
  const shown = allPlaces || local.length === 0 ? places : local;
  const chosen = places.filter((r) => picked.has(r.id));

  const allDays = tripDays(trip.start_date, trip.end_date, []);
  const taken = new Set(existingDays.filter((d): d is string => !!d));
  const free = allDays.filter((d) => !taken.has(d));
  const days = free.length > 0 ? free : allDays;
  const plan = useMemo(
    () => planSaved(chosen.map(asPick), days, pace, around),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chosen.map((r) => r.id).join(","), days.join(","), pace, around],
  );
  const unpinned = chosen.filter((r) => r.lat == null || r.lon == null);
  const stopCount = plan.reduce((n, d) => n + d.stops.length, 0);
  const place = [trip.city, trip.country].filter(Boolean).join(", ");
  const dateLine = [
    trip.country && trip.city ? trip.country : "",
    trip.start_date && trip.end_date ? `${trip.start_date} – ${trip.end_date}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const reset = () => {
    setStep("choose");
    setPicked(new Set());
    setProblem("");
  };
  const close = () => {
    onClose();
    // Leave the picks behind once the sheet has gone, not mid-fade.
    setTimeout(reset, 300);
  };
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const save = async () => {
    setBusy(true);
    setProblem("");
    try {
      const byId = new Map(chosen.map((r) => [r.id, r]));
      const additions: Addition[] = plan.flatMap((day) =>
        day.stops.map((stop) => {
          const r = byId.get(stop.id)!;
          return {
            kind: /food|café|cafe|restaurant|bar|bakery|meal/i.test(r.category ?? "")
              ? "meal"
              : "activity",
            title: r.name,
            ...(day.date ? { day_date: day.date } : {}),
            time_label: stop.start,
            planned_stay_minutes: stop.stayMinutes,
            ...(r.address ? { address: r.address } : {}),
            ...(r.lat != null ? { lat: r.lat } : {}),
            ...(r.lon != null ? { lon: r.lon } : {}),
          };
        }),
      );
      await onSave(additions);
      setStep("saved");
    } catch (e) {
      setProblem(friendlyError(e, "Couldn't save that plan. Your trip is unchanged."));
    } finally {
      setBusy(false);
    }
  };

  const tripBox = (
    <section className="fe-summary">
      <h2 className="text-[24px] font-semibold leading-tight">{trip.title}</h2>
      {dateLine || place ? <p className="mt-2 text-[14px]">{dateLine || place}</p> : null}
    </section>
  );

  if (step === "saved") {
    const first = plan[0];
    return (
      <Sheet open={open} onClose={close} page title="Plan saved" crumb="Back to Timeline" tone={3}>
        <div className="space-y-3">
          <section className="fe-summary">
            <p className="flex items-center gap-2 text-[14px] font-semibold">
              <Check className="size-4" aria-hidden /> Your {trip.title} itinerary is saved
            </p>
            <p className="mt-1 text-[14px]">
              {stopCount} {stopCount === 1 ? "stop is" : "stops are"} now in your plan. No
              reservations or tickets were booked.
            </p>
          </section>
          {tripBox}
          <section className="fe-card">
            <h2 className="text-[16px] font-semibold">What&apos;s saved</h2>
            <p className="mt-2 text-[14px]">
              {plan.length === 1 && first?.date
                ? `Your ${formatTimelineDayLabel(first.date)} stops and times are kept.`
                : "Your stops and times are kept."}{" "}
              Travel gaps and break time were added. Nothing was removed.
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              Your Recs stay saved separately.
            </p>
          </section>
          {unpinned.length > 0 && (
            <section className="fe-card">
              <h2 className="text-[16px] font-semibold">Still to confirm</h2>
              <p className="mt-2 text-[14px]">
                {unpinned.map((r) => r.name).join(", ")} {unpinned.length === 1 ? "has" : "have"} no
                exact spot on the map yet.
              </p>
            </section>
          )}
          <p className="text-[14px] text-muted-foreground">
            No booking or availability checks were performed. This saves your itinerary, not
            reservations.
          </p>
          <button
            type="button"
            onClick={() => {
              close();
              onViewTimeline();
            }}
            className="fe-btn fe-btn-primary"
          >
            View {trip.title} Timeline
          </button>
        </div>
      </Sheet>
    );
  }

  if (step === "review") {
    return (
      <Sheet
        open={open}
        onClose={close}
        onBack={() => setStep("choose")}
        page
        title="Review plan"
        hint="Plan with Béa · Review"
        crumb="Edit plan"
        tone={3}
      >
        <div className="space-y-3">
          <section className="fe-summary">
            <p className="text-[14px] font-semibold uppercase tracking-[0.04em]">
              Preview · not yet saved
            </p>
            <p className="mt-1 text-[14px]">
              Viewing this plan does not change your trip. Only Approve and save adds it.
            </p>
          </section>
          {tripBox}
          <section className="fe-card">
            <h2 className="text-[16px] font-semibold">What changes?</h2>
            <p className="mt-2 text-[14px]">
              {stopCount} {stopCount === 1 ? "place is" : "places are"} added over {plan.length}{" "}
              {plan.length === 1 ? "day" : "days"}, with travel gaps and a short break after each
              visit. Nothing already in your plan is moved or removed.
            </p>
            {free.length === 0 && existingDays.length > 0 && (
              <p className="mt-2 text-[14px] text-muted-foreground">
                Every day already has stops, so these go in alongside them. Check the times in the
                Timeline afterwards.
              </p>
            )}
          </section>
          {plan.map((day, i) => (
            <section key={day.date ?? i} className="fe-card">
              <h2 className="text-[18px] font-semibold leading-tight">
                {day.date
                  ? `Day ${allDays.indexOf(day.date) + 1} · ${formatTimelineDayLabel(day.date)}`
                  : "Your day"}
              </h2>
              <p className="mt-1 text-[14px] text-muted-foreground">
                Proposed stops and travel estimates
              </p>
              <ol className="mt-3 space-y-3">
                {day.stops.map((stop) => (
                  <li key={stop.id}>
                    {stop.travel && (
                      <div className="mb-3 border-l-2 border-border pl-3">
                        <p className="text-[14px] font-semibold">Travel gap</p>
                        <p className="text-[14px] text-muted-foreground">{hopLine(stop.travel)}</p>
                      </div>
                    )}
                    <p className="text-[14px] text-muted-foreground">
                      {stop.start}–{stop.end}
                    </p>
                    <p className="text-[16px] font-semibold">{stop.name}</p>
                  </li>
                ))}
              </ol>
            </section>
          ))}
          {unpinned.length > 0 && (
            <section className="fe-card">
              <h2 className="text-[16px] font-semibold">Places to confirm</h2>
              <p className="mt-2 text-[14px]">
                {unpinned.map((r) => r.name).join(", ")} can&apos;t be placed on the map yet, so no
                travel time is counted for {unpinned.length === 1 ? "it" : "them"}.
              </p>
            </section>
          )}
          <p className="text-[14px] text-muted-foreground">
            No booking or availability checks. Approval saves an itinerary, not reservations.
          </p>
          {problem && (
            <p role="alert" className="text-[14px] text-destructive">
              {problem}
            </p>
          )}
          <button
            type="button"
            disabled={busy || stopCount === 0}
            onClick={() => void save()}
            className="fe-btn fe-btn-primary"
          >
            {busy ? "Saving…" : "Approve and save"}
          </button>
          <button type="button" onClick={() => setStep("choose")} className="fe-btn">
            Edit plan
          </button>
          <button type="button" onClick={close} className="fe-btn">
            Back · keep current plan unchanged
          </button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      page
      title="Build from saved places"
      hint="Plan with Béa · From your Recs"
      crumb="Back to Timeline"
      tone={3}
    >
      <div className="space-y-3">
        <p className="text-[14px]">
          Choose which saved places to include. This does not save a plan yet.
        </p>
        <section>
          <h2 className="fe-label">Planning flow</h2>
          <ol className="grid grid-cols-2 gap-2">
            {STEPS.map(([title, note], i) => (
              <li
                key={title}
                className={`fe-card !p-3 ${i === 0 ? "!border-foreground" : ""}`}
                aria-current={i === 0 ? "step" : undefined}
              >
                <p className="text-[14px] font-semibold">
                  {i + 1} {title}
                </p>
                <p className="mt-0.5 text-[12px] text-muted-foreground">
                  {i === 0 ? `${picked.size} selected` : note}
                </p>
              </li>
            ))}
          </ol>
        </section>
        {tripBox}

        {local.length > 0 && local.length < places.length && (
          <div>
            <label htmlFor="saved-city" className="fe-label">
              City filter
            </label>
            <select
              id="saved-city"
              value={allPlaces ? "all" : "city"}
              onChange={(e) => setAllPlaces(e.target.value === "all")}
              className="fe-input"
            >
              <option value="city">
                {trip.city?.split(",")[0]} · {local.length}
              </option>
              <option value="all">All saved places · {places.length}</option>
            </select>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">
            {picked.size} {picked.size === 1 ? "place" : "places"} selected
          </h2>
          {picked.size > 0 && (
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="text-[14px] font-semibold underline"
            >
              Clear all
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-[14px] text-muted-foreground">Loading your places…</p>
        ) : shown.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            No saved places yet. Save places in Recs and they appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((r) => (
              <li key={r.id}>
                <label className="fe-card flex cursor-pointer items-start gap-3 !p-3">
                  <input
                    type="checkbox"
                    checked={picked.has(r.id)}
                    onChange={() => toggle(r.id)}
                    className="mt-1 size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[16px] font-semibold">{r.name}</span>
                    <span className="block text-[14px] text-muted-foreground">
                      {[r.category, r.city].filter(Boolean).join(" · ")}
                    </span>
                    {r.notes ? (
                      <span className="mt-1 block text-[14px]">Note: {r.notes}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        )}

        <section className="fe-card space-y-3">
          <h2 className="text-[16px] font-semibold">Travel preferences</h2>
          <div>
            <label htmlFor="saved-pace" className="fe-label">
              Daily pace
            </label>
            <select
              id="saved-pace"
              value={pace}
              onChange={(e) => setPace(e.target.value as SavedPace)}
              className="fe-input"
            >
              {PACES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="saved-around" className="fe-label">
              Getting around
            </label>
            <select
              id="saved-around"
              value={around}
              onChange={(e) => setAround(e.target.value as SavedAround)}
              className="fe-input"
            >
              {AROUND.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
        </section>

        <button
          type="button"
          disabled={picked.size === 0}
          onClick={() => setStep("review")}
          className="fe-btn fe-btn-primary gap-2"
        >
          Preview plan <ArrowRight className="size-4" aria-hidden />
        </button>
        <section className="fe-summary">
          <p className="text-[14px] font-semibold">Your Recs stay saved separately</p>
          <p className="mt-1 text-[14px]">
            Previewing does not schedule a place or replace your current plan. No bookings or
            availability checks.
          </p>
        </section>
      </div>
    </Sheet>
  );
}
