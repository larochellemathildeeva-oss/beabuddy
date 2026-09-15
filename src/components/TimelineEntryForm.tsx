import { useEffect, useState } from "react";
import { Bookmark, CalendarDays, Check, Clock, MapPin, Tag, StickyNote, X } from "lucide-react";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import {
  dayChipLabel,
  dayOutsideTripNote,
  defaultEntryDay,
  detailChipLabel,
  normalizeTimeLabel,
  timeChipLabel,
  TIME_CHIPS,
  tripDayOptions,
} from "@/lib/timeline-entry";
import type { ParsedPlace } from "@/lib/places.functions";
import { filledFromMapSummary, timelineKindForPlace } from "@/lib/place-kind";
import { SavedPlacePicker } from "@/components/SavedPlacePicker";
import { capturedFromParsedPlace, toTimelineItem, type CapturedPlace } from "@/lib/captured-place";

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

const kindLabel = (value: string) => KINDS.find(([v]) => v === value)?.[1] ?? "Activity";

const EMPTY_PLACE = {
  address: "",
  city: "",
  country: "",
  lat: undefined as number | undefined,
  lon: undefined as number | undefined,
  note: "",
};

/** Only one optional control is open at a time. */
type Panel = "kind" | "day" | "time" | "detail" | "saved" | null;

/**
 * Add something to the timeline.
 *
 * Everything except the name is optional, so everything except the name is a
 * chip: it reads as its own current value and opens only the control you
 * tapped. Showing all of it at once meant seventeen things on screen to add
 * one stop, which is what quick-add in Todoist, Google Calendar and Reminders
 * all avoid by collapsing the rest behind a single row.
 *
 * The form stays open after a save — nobody adds exactly one thing — and the
 * kind, day and time survive it. Only the name, note and place are cleared.
 */
export function TimelineEntryForm({
  tripStart,
  tripEnd,
  openDay,
  near,
  onAdd,
  onUpdateEntry,
  onDone,
  existing = [],
}: {
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** The day group the user is looking at, so a new entry lands there. */
  openDay?: string | undefined;
  /** City, country — biases place search towards where the trip is. */
  near?: string | undefined;
  /** Returns the new row's id, so the form can offer to schedule it. */
  onAdd: (entry: NewTimelineEntry) => Promise<string | undefined | void>;
  /** Set a day or time on something already added. */
  onUpdateEntry?:
    | ((
        id: string,
        patch: { day_date?: string | null; time_label?: string | null },
      ) => Promise<void>)
    | undefined;
  onDone: () => void;
  /** Existing rows, so a saved place is not offered twice. */
  existing?: { title: string; address?: string | null; lat?: number | null; lon?: number | null }[];
}) {
  const [kind, setKind] = useState("activity");
  /** True once the kind was chosen by hand — then a pick must not override it. */
  const [kindTouched, setKindTouched] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [place, setPlace] = useState(EMPTY_PLACE);
  const [day, setDay] = useState(() => defaultEntryDay({ openDay, tripStart, tripEnd }));
  const [time, setTime] = useState("");
  const [freeTime, setFreeTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [added, setAdded] = useState(0);
  const [panel, setPanel] = useState<Panel>(null);
  /** The entry just added, while the offer to schedule it is still up. */
  const [justAdded, setJustAdded] = useState<{ id: string; title: string } | null>(null);
  const [scheduling, setScheduling] = useState<"day" | "time" | null>(null);

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
  const placeAddress = place.address || [place.city, place.country].filter(Boolean).join(", ");
  const toggle = (next: Panel) => setPanel((cur) => (cur === next ? null : next));

  /**
   * One pick fills the lot: the name, the address, the city, the point on the
   * map, and the kind of stop it is. A café comes back as an amenity from the
   * geocoder, so the kind is worked out from its type rather than its
   * addresstype — and never overrides a kind the user chose themselves.
   */
  const pickPlace = (p: ParsedPlace) => {
    setTitle(p.name);
    const filled = {
      address: p.address ?? "",
      city: p.city ?? "",
      country: p.country ?? "",
      ...(p.lat != null ? { lat: p.lat } : { lat: undefined }),
      ...(p.lon != null ? { lon: p.lon } : { lon: undefined }),
      note: "",
    };
    filled.note = filledFromMapSummary({
      address: filled.address,
      city: filled.city || filled.country,
      lat: filled.lat,
    });
    setPlace(filled);
    if (!kindTouched) {
      setKind(
        timelineKindForPlace({
          ...(p.placeType ? { placeType: p.placeType } : {}),
          ...(p.category ? { category: p.category } : {}),
          name: p.name,
        }),
      );
    }
    setError("");
  };

  /** Add a captured place now, and remember it so a day or time can follow. */
  const addCaptured = async (captured: CapturedPlace, label: string) => {
    setError("");
    try {
      const id = await onAdd(
        toTimelineItem(captured, {
          ...(kindTouched ? { kind } : {}),
          ...(day ? { day_date: day } : {}),
          ...(timeLabel ? { time_label: timeLabel } : {}),
        }),
      );
      setAdded((n) => n + 1);
      setPanel(null);
      setScheduling(null);
      if (typeof id === "string" && onUpdateEntry) setJustAdded({ id, title: label });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that one");
    }
  };

  /** Look something up and take it in one tap, rather than filling the form. */
  const quickAddPlace = async (p: ParsedPlace) => {
    const captured = capturedFromParsedPlace(p);
    await addCaptured(captured, p.name);
    // Show the kind that was actually saved, so the chip is not lying about
    // the café it just filed as a meal.
    if (!kindTouched) setKind(timelineKindForPlace(captured));
    setTitle("");
    setPlace(EMPTY_PLACE);
  };

  const addSaved = (saved: CapturedPlace) => addCaptured(saved, saved.name);

  const save = async () => {
    const name = title.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    try {
      const id = await onAdd({
        kind,
        title: name,
        ...(day ? { day_date: day } : {}),
        ...(timeLabel ? { time_label: timeLabel } : {}),
        ...(detail.trim() ? { detail: detail.trim() } : {}),
        ...(placeAddress ? { address: placeAddress } : {}),
        ...(place.lat != null ? { lat: place.lat } : {}),
        ...(place.lon != null ? { lon: place.lon } : {}),
      });
      // Keep the kind, day and time — the next entry is usually the same sort
      // of thing on the same day. Clear only what is specific to this one.
      setTitle("");
      setDetail("");
      setPlace(EMPTY_PLACE);
      setPanel(null);
      setScheduling(null);
      setAdded((n) => n + 1);
      if (typeof id === "string" && onUpdateEntry) setJustAdded({ id, title: name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add that entry");
    } finally {
      setBusy(false);
    }
  };

  /**
   * Set a day or time on the entry just added. It also becomes the form's
   * default, because the next thing you add is usually on the same day.
   */
  const scheduleJustAdded = async (patch: {
    day_date?: string | null;
    time_label?: string | null;
  }) => {
    if (!justAdded || !onUpdateEntry) return;
    try {
      await onUpdateEntry(justAdded.id, patch);
      if (patch.day_date !== undefined) {
        setDayTouched(true);
        setDay(patch.day_date ?? "");
      }
      if (patch.time_label !== undefined) {
        setTime(patch.time_label ?? "");
        setFreeTime("");
      }
      setScheduling(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't set that");
    }
  };

  const chip = (active: boolean, set: boolean) =>
    `flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[13.5px] ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : set
          ? "border-primary/50 text-foreground"
          : "border-border text-muted-foreground"
    }`;

  return (
    <div className="space-y-2.5 rounded-2xl bg-elevated p-3.5">
      {/* The name is the only thing that is not optional, so it is the only
          thing on screen by default. */}
      <PlaceSearchInput
        value={title}
        onChange={setTitle}
        onPick={pickPlace}
        placeholder="What's happening?"
        {...(near ? { near } : {})}
        {...(onUpdateEntry
          ? { quickAdd: { label: "Add", busyLabel: "Adding…", onAdd: quickAddPlace } }
          : {})}
      />

      {placeAddress && (
        <div className="flex items-start justify-between gap-2 rounded-xl border border-primary/40 bg-elevated px-3 py-2">
          <div className="min-w-0">
            <p className="min-w-0 break-words text-[13.5px]">
              <MapPin className="mr-1 inline size-3.5 text-primary" aria-hidden />
              {placeAddress}
            </p>
            {place.note && (
              <p aria-live="polite" className="mt-0.5 text-[12.5px] text-muted-foreground">
                {place.note}
                {!kindTouched && ` Set as a ${kind}.`}
              </p>
            )}
          </div>
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

      {/* Everything optional lives here, showing its own value. */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Optional details">
        <button
          type="button"
          aria-expanded={panel === "day"}
          onClick={() => toggle("day")}
          className={chip(panel === "day", Boolean(day))}
        >
          <CalendarDays className="size-3.5" aria-hidden />
          {dayChipLabel(day, days)}
        </button>
        <button
          type="button"
          aria-expanded={panel === "time"}
          onClick={() => toggle("time")}
          className={chip(panel === "time", Boolean(timeLabel))}
        >
          <Clock className="size-3.5" aria-hidden />
          {timeChipLabel(time, freeTime)}
        </button>
        <button
          type="button"
          aria-expanded={panel === "kind"}
          onClick={() => toggle("kind")}
          className={chip(panel === "kind", kindTouched)}
        >
          <Tag className="size-3.5" aria-hidden />
          {kindLabel(kind)}
        </button>
        <button
          type="button"
          aria-expanded={panel === "detail"}
          onClick={() => toggle("detail")}
          className={chip(panel === "detail", Boolean(detail.trim()))}
        >
          <StickyNote className="size-3.5" aria-hidden />
          {detailChipLabel(detail)}
        </button>
        <button
          type="button"
          aria-expanded={panel === "saved"}
          onClick={() => toggle("saved")}
          className={chip(panel === "saved", false)}
        >
          <Bookmark className="size-3.5" aria-hidden />
          Saved
        </button>
      </div>

      {panel === "kind" && (
        <div className="flex flex-wrap gap-1.5 rounded-2xl bg-elevated p-2.5">
          {KINDS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => {
                setKind(value);
                setKindTouched(true);
                setPanel(null);
              }}
              className={`rounded-full border px-3 py-1.5 text-[13.5px] ${
                kind === value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {panel === "day" && (
        <div className="space-y-2 rounded-2xl bg-elevated p-2.5">
          {days.length > 1 && (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Day of the trip">
              {days.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={day === value}
                  onClick={() => {
                    setDayTouched(true);
                    setDay(day === value ? "" : value);
                    setPanel(null);
                  }}
                  className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
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
          <label className="block text-[12.5px] text-muted-foreground">
            Or a specific date
            <input
              type="date"
              value={day}
              {...(tripStart ? { min: tripStart } : {})}
              {...(tripEnd ? { max: tripEnd } : {})}
              onChange={(e) => {
                setDayTouched(true);
                setDay(e.target.value);
              }}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px] text-foreground"
            />
          </label>
          {outside && <p className="text-[12.5px] text-muted-foreground">{outside}</p>}
          {day && (
            <button
              type="button"
              onClick={() => {
                setDayTouched(true);
                setDay("");
                setPanel(null);
              }}
              className="text-[12.5px] text-muted-foreground underline"
            >
              No day yet
            </button>
          )}
        </div>
      )}

      {panel === "time" && (
        <div className="space-y-2 rounded-2xl bg-elevated p-2.5">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Rough time of day">
            {TIME_CHIPS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={time === preset.value}
                onClick={() => {
                  setTime(time === preset.value ? "" : preset.value);
                  setFreeTime("");
                  setPanel(null);
                }}
                className={`rounded-full border px-3 py-1 text-[12.5px] ${
                  time === preset.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <label className="block text-[12.5px] text-muted-foreground">
            Or a clock time
            <input
              type="time"
              value={time}
              onChange={(e) => {
                setTime(e.target.value);
                setFreeTime("");
              }}
              className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px] text-foreground"
            />
          </label>
          {!time && (
            <label className="block text-[12.5px] text-muted-foreground">
              Or in your own words
              <input
                value={freeTime}
                onChange={(e) => setFreeTime(e.target.value)}
                onBlur={() => setFreeTime(normalizeTimeLabel(freeTime))}
                placeholder="after check-in"
                className="mt-1 w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px] text-foreground"
              />
            </label>
          )}
          {timeLabel && (
            <button
              type="button"
              onClick={() => {
                setTime("");
                setFreeTime("");
                setPanel(null);
              }}
              className="text-[12.5px] text-muted-foreground underline"
            >
              No time
            </button>
          )}
        </div>
      )}

      {panel === "detail" && (
        <input
          value={detail}
          autoFocus
          onChange={(e) => setDetail(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setPanel(null);
          }}
          placeholder="Anything worth remembering"
          aria-label="Note"
          className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px]"
        />
      )}

      {panel === "saved" && (
        <SavedPlacePicker
          {...(near ? { near } : {})}
          alreadyHere={existing.map((row) => ({
            name: row.title,
            ...(row.lat != null ? { lat: row.lat } : {}),
            ...(row.lon != null ? { lon: row.lon } : {}),
          }))}
          onPick={addSaved}
          onClose={() => setPanel(null)}
        />
      )}

      {error && <p className="text-[12.5px] text-destructive">{error}</p>}

      {/* Added first, scheduled after — the day and time are offered once the
          thing exists, rather than asked for before it does. */}
      {justAdded && !error && (
        <div className="space-y-2 rounded-xl border border-primary/40 bg-elevated p-2.5">
          <div className="flex items-start justify-between gap-2">
            <p aria-live="polite" className="min-w-0 text-[13.5px]">
              <Check className="mr-1 inline size-3.5 text-primary" aria-hidden />
              Added <span className="font-medium">{justAdded.title}</span>
              {day || timeLabel ? (
                <span className="text-muted-foreground">
                  {" · "}
                  {[dayChipLabel(day, days) !== "Day" ? dayChipLabel(day, days) : "", timeLabel]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => {
                setJustAdded(null);
                setScheduling(null);
              }}
              aria-label="Dismiss"
              className="grid size-6 shrink-0 place-items-center rounded-full border border-border"
            >
              <X className="size-3" />
            </button>
          </div>

          {scheduling === null && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setScheduling("day")}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12.5px]"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                {day ? `Change day (${dayChipLabel(day, days)})` : "Set a day"}
              </button>
              <button
                type="button"
                onClick={() => setScheduling("time")}
                className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-[12.5px]"
              >
                <Clock className="size-3.5" aria-hidden />
                {timeLabel ? `Change time (${timeLabel})` : "Set a time"}
              </button>
            </div>
          )}

          {scheduling === "day" && (
            <div className="flex flex-wrap gap-1.5">
              {days.map((value, index) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => void scheduleJustAdded({ day_date: value })}
                  className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
                    day === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  Day {index + 1}
                </button>
              ))}
              {days.length === 0 && (
                <input
                  type="date"
                  aria-label="Day for the entry just added"
                  onChange={(e) => void scheduleJustAdded({ day_date: e.target.value })}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[15px]"
                />
              )}
              <button
                type="button"
                onClick={() => void scheduleJustAdded({ day_date: null })}
                className="rounded-full border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground"
              >
                No day
              </button>
            </div>
          )}

          {scheduling === "time" && (
            <div className="flex flex-wrap gap-1.5">
              {TIME_CHIPS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => void scheduleJustAdded({ time_label: preset.value })}
                  className={`rounded-full border px-2.5 py-1 text-[12.5px] ${
                    time === preset.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border"
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <input
                type="time"
                aria-label="Time for the entry just added"
                onChange={(e) => void scheduleJustAdded({ time_label: e.target.value || null })}
                className="rounded-xl border border-border bg-card px-2 py-1 text-[13.5px]"
              />
              <button
                type="button"
                onClick={() => void scheduleJustAdded({ time_label: null })}
                className="rounded-full border border-border px-2.5 py-1 text-[12.5px] text-muted-foreground"
              >
                No time
              </button>
            </div>
          )}
        </div>
      )}

      {added > 0 && !justAdded && !error && (
        <p aria-live="polite" className="text-[12.5px] text-primary">
          {added === 1 ? "Added." : `${added} added.`} Keep going, or tap Done.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!title.trim() || busy}
          onClick={() => void save()}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[15px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Adding…" : added > 0 ? "Add another" : "Add to timeline"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-xl border border-border px-4 py-2.5 text-[15px] font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}
