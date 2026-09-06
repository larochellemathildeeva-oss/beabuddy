import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import type { Pin } from "@/data/atlas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useScorePrefs } from "@/hooks/useScorePrefs";
import { useTrips } from "@/hooks/useTrips";
import { DAY_TRIP_PACES, dayTripCity, dayTripTitle, matchDayTripPlace } from "@/lib/day-trip";
import { planDayTrip, type ParsedItineraryItem } from "@/lib/itinerary.functions";
import { toLocalISODate } from "@/lib/trip-dates";

const OPEN_TRIP_KEY = "bea.trips.open";

export function DayTripFromNear({
  selected,
  here,
  onClear,
}: {
  selected: Pin[];
  here: { lat: number; lon: number } | null;
  onClear: () => void;
}) {
  const { user } = useAuth();
  const trips = useTrips();
  const scorePrefs = useScorePrefs();
  const plan = useServerFn(planDayTrip);
  const navigate = useNavigate();
  const [date, setDate] = useState(() => toLocalISODate(new Date()));
  const [pace, setPace] = useState<(typeof DAY_TRIP_PACES)[number]["id"]>("balanced");
  const [emphasize, setEmphasize] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<{
    title: string;
    summary: string;
    items: ParsedItineraryItem[];
  } | null>(null);

  const tags = scorePrefs.tags.slice(0, 12);
  const city = dayTripCity(selected);

  const arrange = async () => {
    if (selected.length < 2 || !user) return;
    setBusy(true);
    setError("");
    setDraft(null);
    try {
      const out = await plan({
        data: {
          date,
          here,
          pace,
          emphasize,
          note: note.trim() || null,
          places: selected.map((pin) => ({
            name: pin.name,
            city: pin.city || null,
            country: pin.country || null,
            category: pin.category ?? null,
            notes: pin.notes ?? null,
            tags: pin.travelTags ?? [],
            lat: pin.lat,
            lon: pin.lon,
          })),
        },
      });
      setDraft({ title: out.trip_title, summary: out.summary, items: out.items });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Béa couldn't arrange that day.");
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!draft || !user) return;
    setBusy(true);
    setError("");
    try {
      const title = draft.title.trim() || dayTripTitle(city, date);
      const tripId = await trips.createTrip({
        title,
        ...(city ? { city } : {}),
        ...(selected[0]?.country ? { country: selected[0].country } : {}),
        start_date: date,
        end_date: date,
        dates_status: "confirmed",
      });
      const { data: auth } = await supabase.auth.getUser();
      const authorId = auth.user?.id ?? null;
      const rows = draft.items.map((item, index) => {
        const hit = matchDayTripPlace(item.title, selected);
        return {
          trip_id: tripId,
          day_date: date,
          time_label: item.time_label,
          kind: item.kind,
          title: hit?.name ?? item.title,
          detail: item.detail,
          address: hit ? [hit.city, hit.country].filter(Boolean).join(", ") || null : null,
          lat: hit?.lat ?? null,
          lon: hit?.lon ?? null,
          position: index,
          created_by: authorId,
          updated_by: authorId,
        };
      });
      if (rows.length) {
        const { error: insertError } = await supabase.from("itinerary_items").insert(rows);
        if (insertError) throw insertError;
      }
      try {
        sessionStorage.setItem(OPEN_TRIP_KEY, tripId);
      } catch {
        /* remembering the open trip is optional */
      }
      onClear();
      await navigate({ to: "/trips" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save that day trip.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) {
    return (
      <div data-guide="day-trip" className="card-soft p-4">
        <p className="font-display text-[17px] leading-snug">Plan a day trip</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Sign in to let Béa arrange the recs you ticked into a one-day trip.
        </p>
        <Link
          to="/auth"
          className="mt-3 block rounded-xl bg-primary px-4 py-2.5 text-center text-[13px] font-semibold text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div data-guide="day-trip" className="card-soft space-y-3 p-4">
      <div>
        <p className="font-display text-[17px] leading-snug">Plan a day trip</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {selected.length} saved place{selected.length === 1 ? "" : "s"} ticked. Béa will line them
          up for one day using your travel preferences
          {emphasize.length ? " and whatever you lean into today" : ""}.
        </p>
      </div>

      <label className="block">
        <span className="text-[12px] font-medium">When</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1 w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
        />
      </label>

      <div>
        <p className="text-[12px] font-medium">Pace for this day</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {DAY_TRIP_PACES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPace(option.id)}
              className={`rounded-xl border px-2 py-2 text-left ${
                pace === option.id ? "border-primary bg-primary/10" : "border-border"
              }`}
            >
              <span className="block text-[12px] font-semibold">{option.label}</span>
              <span className="block text-[10px] leading-snug text-muted-foreground">
                {option.hint}
              </span>
            </button>
          ))}
        </div>
      </div>

      {tags.length > 0 && (
        <div>
          <p className="text-[12px] font-medium">Lean into today</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {tags.map((tag) => {
              const on = emphasize.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() =>
                    setEmphasize((cur) => (on ? cur.filter((t) => t !== tag) : [...cur, tag]))
                  }
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={400}
        rows={2}
        placeholder="Anything else for today — lunch first, no museums…"
        className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[13px] outline-none focus:border-primary"
      />

      {error && <p className="text-[12px] text-destructive">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void arrange()}
          disabled={busy || selected.length < 2}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy && !draft ? "Béa is arranging…" : "Arrange with Béa"}
        </button>
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl border border-border px-4 py-2.5 text-[13px]"
        >
          Clear
        </button>
      </div>

      {draft && (
        <div className="space-y-2 rounded-xl border border-border bg-elevated p-3">
          <p className="text-[13px] font-semibold">{draft.title}</p>
          {draft.summary && (
            <p className="text-[12px] text-muted-foreground">{draft.summary}</p>
          )}
          <ol className="space-y-2">
            {draft.items.map((item, i) => (
              <li key={`${item.title}-${i}`} className="text-[13px]">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  {[item.time_label, item.kind].filter(Boolean).join(" · ")}
                </span>
                <span className="mt-0.5 block font-medium">{item.title}</span>
                {item.detail && (
                  <span className="block text-[12px] text-muted-foreground">{item.detail}</span>
                )}
              </li>
            ))}
          </ol>
          <p className="text-[11px] text-muted-foreground">
            Nothing is booked. You can still change the trip after it is added.
          </p>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || draft.items.length === 0}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Saving the day…" : "Save as a trip"}
          </button>
        </div>
      )}
    </div>
  );
}
