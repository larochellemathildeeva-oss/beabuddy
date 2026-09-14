import { useEffect, useState } from "react";
import { MapPin, X } from "lucide-react";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { formatDateRangeLabel } from "@/lib/trip-dates";
import {
  dayOutsideTripNote,
  defaultEntryDay,
  normalizeTimeLabel,
  TIME_CHIPS,
  tripDayOptions,
} from "@/lib/timeline-entry";
import type { ParsedPlace } from "@/lib/places.functions";

export type NewTimelineEntry = {
  kind: string;
  title: string;
  day_date?: string;
  time_label?: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
};

const KINDS: [string, string][] = [
  ["activity", "Activity"],
  ["meal", "Meal"],
  ["transport", "Transport"],
  ["lodging", "Lodging"],
  ["note", "Note"],
];

const EMPTY_PLACE = {
  address: "",
  lat: undefined as number | undefined,
  lon: undefined as number | undefined,
};

/**
 * One add-to-timeline form.
 *
 * It stays open after a save on purpose: nobody adds exactly one thing, and the
 * old form closed itself every time, so a day's five stops meant five reopenings
 * and five re-picks of the kind. The kind, day and time survive a save; only the
 * title, detail and place are cleared.
 */
export function TimelineEntryForm({
  tripStart,
  tripEnd,
  openDay,
  near,
  onAdd,
  onDone,
}: {
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** The day group the user is looking at, so a new entry lands there. */
  openDay?: string | undefined;
  /** City, country — biases place search towards where the trip is. */
  near?: string | undefined;
  onAdd: (entry: NewTimelineEntry) => Promise<void>;
  onDone: () => void;
}) {
  const [kind, setKind] = useState("activity");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [day, setDay] = useState(() => defaultEntryDay({ openDay, tripStart, tripEnd }));
  const [time, setTime] = useState("");
  const [freeTime, setFreeTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);

  // Following the user to another day should move the form with them, but only
  // while they have not chosen a day themselves.
  const [dayTouched, setDayTouched] = useState(false);
  useEffect(() => {
    if (dayTouched) return;
    setDay(defaultEntryDay({ openDay, tripStart, tripEnd }));
  }, [openDay, tripStart, tripEnd, dayTouched]);

  const days = tripDayOptions(tripStart, tripEnd);
  const outside = dayOutsideTripNote(day, tripStart, tripEnd);
  const timeLabel = time || normalizeTimeLabel(freeTime);

  const pickPlace = (p: ParsedPlace) => {
    setTitle(p.name);
    setPlace({
      address: p.address ?? "",
      ...(p.lat != null ? { lat: p.lat } : { lat: undefined }),
      ...(p.lon != null ? { lon: p.lon } : { lon: undefined }),
    });
    setError("");
  };

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      await onAdd({
        kind,
        title: name,
        ...(day ? { day_date: day } : {}),
        ...(timeLabel ? { time_label: timeLabel } : {}),
        ...(detail.trim() ? { detail: detail.trim() } : {}),
        ...(place.address ? { address: place.address } : {}),
        ...(place.lat != null ? { lat: place.lat } : {}),
        ...(place.lon != null ? { lon: place.lon } : {}),
      });
      // Keep the kind, day and time — the next entry is usually the same sort of
      // thing on the same day. Clear only what is specific to this one.
      setTitle("");
      setDetail("");
      setPlace(EMPTY_PLACE);
      setAdded((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that entry");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Entry type">
        {KINDS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            aria-pressed={kind === value}
            onClick={() => setKind(value)}
            className={`rounded-full border px-3 py-1.5 text-[12px] ${
              kind === value ? "border-primary bg-primary text-primary-foreground" : "border-border"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Search, so a hand-typed stop gets an address and coordinates too — without
          them it is invisible to the map, to walking directions and to Optimize. */}
      <PlaceSearchInput
        value={title}
        onChange={(v) => setTitle(v)}
        onPick={pickPlace}
        placeholder="What's happening? Search it, paste a link, or just type"
        {...(near ? { near } : {})}
      />
      <p className="px-1 text-[11px] text-muted-foreground">
        Typing plain text works fine. Searching or pasting a Maps link also pins it to the map and
        lets Béa give you directions between stops.
      </p>

      {place.address && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/40 bg-elevated px-3 py-2">
          <p className="min-w-0 break-words text-[12px]">
            <MapPin className="mr-1 inline size-3.5 text-primary" aria-hidden />
            {place.address}
          </p>
          <button
            type="button"
            aria-label="Remove the pinned place"
            onClick={() => setPlace(EMPTY_PLACE)}
            className="grid size-6 shrink-0 place-items-center rounded-full border border-border"
          >
            <X className="size-3" />
          </button>
        </div>
      )}

      {days.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day">
          {days.map((value, index) => (
            <button
              key={value}
              type="button"
              aria-pressed={day === value}
              onClick={() => {
                setDayTouched(true);
                setDay(day === value ? "" : value);
              }}
              className={`rounded-full border px-2.5 py-1 text-[11px] ${
                day === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              Day {index + 1}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="date"
          aria-label="Day"
          value={day}
          {...(tripStart ? { min: tripStart } : {})}
          {...(tripEnd ? { max: tripEnd } : {})}
          onChange={(e) => {
            setDayTouched(true);
            setDay(e.target.value);
          }}
          className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
        />
        <input
          type="time"
          aria-label="Time"
          value={time}
          onChange={(e) => {
            setTime(e.target.value);
            setFreeTime("");
          }}
          className="flex-1 rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
        />
      </div>
      {outside && <p className="px-1 text-[11px] text-muted-foreground">{outside}</p>}
      {tripStart && !day && (
        <p className="px-1 text-[11px] text-muted-foreground">
          No day yet — it will sit in “Not scheduled”. Trip runs{" "}
          {formatDateRangeLabel(tripStart, tripEnd ?? "")}.
        </p>
      )}

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rough time of day">
        {TIME_CHIPS.map((chip) => (
          <button
            key={chip.id}
            type="button"
            aria-pressed={time === chip.value}
            onClick={() => {
              setTime(time === chip.value ? "" : chip.value);
              setFreeTime("");
            }}
            className={`rounded-full border px-3 py-1 text-[11px] ${
              time === chip.value
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {chip.label}
          </button>
        ))}
        {!time && (
          <input
            value={freeTime}
            onChange={(e) => setFreeTime(e.target.value)}
            onBlur={() => setFreeTime(normalizeTimeLabel(freeTime))}
            placeholder="or “after check-in”"
            aria-label="Time in your own words"
            className="min-w-[9rem] flex-1 rounded-full border border-border bg-elevated px-3 py-1 text-[11px]"
          />
        )}
      </div>

      <input
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
        placeholder="Detail (optional)"
        className="w-full rounded-xl border border-border bg-elevated px-3 py-2 text-[13px]"
      />

      {error && <p className="text-[11px] text-destructive">{error}</p>}
      {added > 0 && !error && (
        <p aria-live="polite" className="text-[11px] text-primary">
          {added === 1 ? "Added." : `${added} added.`} The form is still here — keep going.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title.trim() || busy}
          onClick={() => void save()}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Adding…" : added > 0 ? "Add another" : "Add to timeline"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
