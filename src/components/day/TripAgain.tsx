import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useTripCopy } from "@/hooks/useTripCopy";
import { againTitle, type SourceItem, type SourceStop } from "@/lib/trip-duplicate";
import { parseLocalDate } from "@/lib/trip-dates";

type TripSummary = { id: string; title: string; start_date: string | null };

function dayLabel(day: string): string {
  const date = parseLocalDate(day);
  return date
    ? date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
    : day;
}

/**
 * "Do it again", in the trip menu: the whole trip copied onto new dates, or
 * one of its days copied onto a day of any trip. Bookings, confirmation
 * numbers and the record of what happened stay with this trip.
 */
export function TripAgain({
  trip,
  items,
  stops,
  onOpenTrip,
  onCopiedHere,
}: {
  trip: {
    id: string;
    title: string;
    city: string | null;
    country: string | null;
    start_date: string | null;
    end_date: string | null;
    budget_enabled: boolean;
  };
  items: readonly SourceItem[];
  stops: readonly SourceStop[];
  onOpenTrip: (id: string) => void;
  /** A day copied onto this same trip: reload it. */
  onCopiedHere: () => void;
}) {
  const copy = useTripCopy();
  const [title, setTitle] = useState(againTitle(trip.title));
  const [start, setStart] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const days = [...new Set(items.map((i) => i.day_date).filter((d): d is string => !!d))].sort();
  const [sourceDay, setSourceDay] = useState(days[0] ?? "");
  const [targetTrip, setTargetTrip] = useState(trip.id);
  const [targetDay, setTargetDay] = useState("");
  const trips = useTripList();

  const duplicate = async () => {
    setBusy(true);
    setError("");
    try {
      const id = await copy.duplicateTrip({
        trip,
        items,
        stops,
        title,
        startDate: start || null,
      });
      toast.success("A copy of the trip is ready", {
        description: "Bookings and confirmation numbers stayed with the old trip.",
      });
      onOpenTrip(id);
    } catch {
      setError("The copy didn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const copyDay = async () => {
    if (!sourceDay || !targetDay || !targetTrip) return;
    setBusy(true);
    setError("");
    try {
      const n = await copy.copyDay({ items, sourceDay, targetTripId: targetTrip, targetDay });
      toast.success(`${n} ${n === 1 ? "stop" : "stops"} copied to ${dayLabel(targetDay)}`);
      if (targetTrip === trip.id) onCopiedHere();
    } catch {
      setError("That day didn't copy. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "mt-1 w-full rounded-xl border border-input bg-card px-3 py-2.5 text-[14.5px] outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-3">
      <section className="plain-card space-y-2.5 p-3.5">
        <p className="font-display text-[20px] leading-tight">Copy the whole trip</p>
        <p className="text-[13px] text-muted-foreground">
          Every stop, time and note moves to the new dates. Bookings, confirmation numbers and what
          you ticked off stay with this trip.
        </p>
        <label className="block text-[13px] font-semibold">
          Name
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            className={field}
          />
        </label>
        <label className="block text-[13px] font-semibold">
          New first day
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className={field}
          />
        </label>
        {!trip.start_date && start && (
          <p className="text-[12.5px] text-muted-foreground">
            This trip has no dates, so its stops keep the days they have.
          </p>
        )}
        <button
          type="button"
          disabled={busy || !title.trim()}
          onClick={() => void duplicate()}
          className="btn-primary w-full disabled:opacity-50"
        >
          {busy ? "Copying…" : "Make the copy"}
        </button>
      </section>

      {days.length > 0 && (
        <section className="plain-card space-y-2.5 p-3.5">
          <p className="font-display text-[20px] leading-tight">Copy one day</p>
          <label className="block text-[13px] font-semibold">
            The day
            <select
              value={sourceDay}
              onChange={(e) => setSourceDay(e.target.value)}
              className={field}
            >
              {days.map((day) => (
                <option key={day} value={day}>
                  {dayLabel(day)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-[13px] font-semibold">
            Onto the trip
            <select
              value={targetTrip}
              onChange={(e) => {
                setTargetTrip(e.target.value);
                const picked = trips.find((t) => t.id === e.target.value);
                if (picked?.start_date && !targetDay) setTargetDay(picked.start_date);
              }}
              className={field}
            >
              <option value={trip.id}>This trip</option>
              {trips
                .filter((t) => t.id !== trip.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-[13px] font-semibold">
            On the day
            <input
              type="date"
              value={targetDay}
              onChange={(e) => setTargetDay(e.target.value)}
              className={field}
            />
          </label>
          <button
            type="button"
            disabled={busy || !sourceDay || !targetDay}
            onClick={() => void copyDay()}
            className="btn-primary w-full disabled:opacity-50"
          >
            {busy ? "Copying…" : "Copy this day"}
          </button>
        </section>
      )}

      {error && (
        <p role="alert" className="text-[14px] font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Your trips, for "onto the trip". */
function useTripList(): TripSummary[] {
  const [trips, setTrips] = useState<TripSummary[]>([]);
  useEffect(() => {
    let active = true;
    void supabase
      .from("trips")
      .select("id, title, start_date")
      .order("start_date", { ascending: false })
      .then(({ data }) => {
        if (active) setTrips((data ?? []) as TripSummary[]);
      });
    return () => {
      active = false;
    };
  }, []);
  return trips;
}
