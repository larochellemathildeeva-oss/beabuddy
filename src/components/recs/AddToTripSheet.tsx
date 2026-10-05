import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Check } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import type { TripRow } from "@/hooks/useTrips";
import { bannerArtUrl, bannerSceneFor } from "@/lib/banner-art";
import { nextPosition } from "@/lib/timeline-order";
import { normaliseKind } from "@/lib/timeline-kind";
import { PARTS_OF_DAY, tripDays, type PartOfDay } from "@/lib/recs-browse";
import { toLocalISODate } from "@/lib/trip-dates";
import { PlaceArt, Sheet, type RecsPlace } from "./RecsParts";

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function tripDatesLabel(trip: TripRow): string {
  if (!trip.start_date) return "Dates to decide";
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const a = new Date(`${trip.start_date}T12:00:00`).toLocaleDateString(undefined, opts);
  if (!trip.end_date || trip.end_date === trip.start_date) return a;
  const b = new Date(`${trip.end_date}T12:00:00`).toLocaleDateString(undefined, opts);
  return `${a} – ${b}`;
}

/** Trips still to come or under way first, soonest first; past trips after. */
function orderTrips(trips: readonly TripRow[], today: string): TripRow[] {
  const live = (t: TripRow) => !t.end_date || t.end_date >= today;
  const byStart = (a: TripRow, b: TripRow) =>
    (a.start_date ?? "9999").localeCompare(b.start_date ?? "9999");
  return [
    ...trips.filter(live).sort(byStart),
    ...trips.filter((t) => !live(t)).sort((a, b) => byStart(b, a)),
  ];
}

/**
 * Put a place on a trip's timeline: which trip, which day, which part of the
 * day, a note. The same row the trip's own "add" writes, at the end of the
 * trip's order; the day and part of the day are optional, as there.
 */
export function AddToTripSheet({
  place,
  trips,
  onClose,
  onAnother,
}: {
  place: RecsPlace;
  trips: readonly TripRow[];
  onClose: () => void;
  /** "Add another place": back to finding one. */
  onAnother: () => void;
}) {
  const today = toLocalISODate(new Date());
  const ordered = useMemo(() => orderTrips(trips, today), [trips, today]);
  const [tripId, setTripId] = useState<string | null>(ordered[0]?.id ?? null);
  const trip = ordered.find((t) => t.id === tripId) ?? null;
  const days = trip ? tripDays(trip.start_date, trip.end_date) : [];
  const [day, setDay] = useState<string>("");
  const [part, setPart] = useState<PartOfDay | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState<{ trip: TripRow; day: string; part: PartOfDay | null } | null>(
    null,
  );

  const add = async () => {
    if (!trip) return;
    setBusy(true);
    setError("");
    try {
      const { data: auth } = await supabase.auth.getUser();
      const authorId = auth.user?.id ?? null;
      const { data: last, error: readError } = await supabase
        .from("itinerary_items")
        .select("position")
        .eq("trip_id", trip.id)
        .order("position", { ascending: false })
        .limit(1);
      if (readError) throw readError;
      const where = [place.address, place.city, place.country].filter(Boolean).join(", ");
      const { error: insertError } = await supabase.from("itinerary_items").insert({
        trip_id: trip.id,
        day_date: day || null,
        time_label: part,
        kind: normaliseKind(place.category),
        title: place.name,
        detail: note.trim() || null,
        address: where || null,
        lat: place.lat ?? null,
        lon: place.lon ?? null,
        position: nextPosition(last ?? []),
        created_by: authorId,
        updated_by: authorId,
      });
      if (insertError) throw insertError;
      setAdded({ trip, day, part });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that to the trip.");
    } finally {
      setBusy(false);
    }
  };

  if (added) {
    const when = [added.day ? dayLabel(added.day) : "", added.part ?? ""]
      .filter(Boolean)
      .join(" · ");
    return (
      <Sheet label="Added to your trip" onClose={onClose}>
        <div className="flex flex-col items-center pt-2 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-6" aria-hidden />
          </span>
          <h2 className="mt-3 font-display text-[27px] leading-none" aria-live="polite">
            Added to your trip
          </h2>
        </div>
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
          <PlaceArt place={place} className="size-16 shrink-0 rounded-xl" />
          <div className="min-w-0">
            <p className="truncate text-[16px] font-semibold">{place.name}</p>
            {when && <p className="text-[13px] text-muted-foreground">{when}</p>}
            <p className="truncate text-[13px] text-muted-foreground">{added.trip.title}</p>
          </div>
        </div>
        <Link
          to="/trips/$tripId"
          params={{ tripId: added.trip.id }}
          className="btn-primary mt-5 flex w-full items-center justify-center"
        >
          View in itinerary
        </Link>
        <button
          type="button"
          onClick={onAnother}
          className="mt-2 h-12 w-full rounded-[var(--r-button)] border border-border bg-card text-[15px] font-semibold"
        >
          Add another place
        </button>
      </Sheet>
    );
  }

  return (
    <Sheet label="Add to trip" onClose={onClose}>
      <h2 className="pr-10 font-display text-[27px] leading-none">Add to trip</h2>
      <p className="mt-1 truncate text-[14px] text-muted-foreground">{place.name}</p>

      {ordered.length === 0 ? (
        <p className="mt-5 text-[15px] text-muted-foreground">
          No trips yet. Start one on the Trips tab, then add this place to it.
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-2" role="radiogroup" aria-label="Which trip">
            {ordered.slice(0, 8).map((t) => {
              const on = t.id === tripId;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setTripId(t.id);
                    setDay("");
                  }}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors ${
                    on ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
                >
                  <img
                    src={bannerArtUrl(bannerSceneFor([t.title, t.city, t.country], t.id))}
                    alt=""
                    className="art-dim size-12 shrink-0 rounded-xl object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{t.title}</span>
                    <span className="block text-[13px] text-muted-foreground">
                      {tripDatesLabel(t)}
                    </span>
                  </span>
                  {on && <Check className="size-5 shrink-0 text-primary" aria-hidden />}
                </button>
              );
            })}
          </div>

          {days.length > 0 && (
            <label className="mt-4 flex items-center justify-between gap-3">
              <span className="text-[15px] font-semibold">Date</span>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="min-w-0 rounded-xl border border-border bg-card px-3 py-2 text-[15px]"
              >
                <option value="">No set day</option>
                {days.map((d) => (
                  <option key={d} value={d}>
                    {dayLabel(d)}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Part of the day">
            {PARTS_OF_DAY.map((p, i) => {
              const on = part === p;
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setPart(on ? null : p)}
                  className={`h-10 rounded-full border text-[14px] font-semibold transition-colors ${
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : `tile-fill-${i + 2} border-border`
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note (optional)"
            aria-label="Note"
            className="mt-4 w-full rounded-xl border border-border bg-card px-3.5 py-3 text-[15px] outline-none focus:border-primary"
          />

          {error && <p className="mt-3 text-[13px] text-destructive">{error}</p>}

          <button
            type="button"
            onClick={() => void add()}
            disabled={busy || !trip}
            className="btn-primary mt-5 w-full disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add to trip"}
          </button>
        </>
      )}
    </Sheet>
  );
}
