import { useEffect, useState } from "react";
import {
  Bookmark,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Footprints,
  MapPin,
  MapPinPlus,
  Plus,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { SwipeRow } from "@/components/day/SwipeRow";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import { isBooked } from "@/lib/bookings";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isDone } from "@/lib/companion";
import type { RouteLeg } from "@/lib/directions.functions";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import type { ParsedPlace } from "@/lib/places.functions";
import { placePatchForSavedRow } from "@/lib/place-label";
import { parseStayChoice, stayChoices, stayLabel } from "@/lib/planned-stay";
import { stripEmbeddedMapsUrl, syncDetailDraft, unroutedLegCopy } from "@/lib/timeline-directions";
import { timeForRail } from "@/lib/timeline-kind";

/**
 * One stop on the Timeline tab, as a card with two sides.
 *
 * The front is one line of time, name and where, so a long day reads at a
 * glance. Tapping it turns the card over: name and note, day, time, stay and
 * place, the booking, and done, save, map, order and delete, each with its
 * name. "Done" turns it back. Edit mode in the list header shows every card's
 * back at once. Swiping the front still marks done (right) or offers save and
 * delete (left). Shared by the by-day and flat lists so rows stay keyed to the
 * same id.
 */
export function TimelineEntry({
  item,
  showDay,
  number,
  editing = false,
  near,
  onEdit,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  tripStart,
  tripEnd,
  onKeep,
  onToggleDone,
  showSwipeHint = false,
  onLocate,
  onSaveBooking,
}: {
  item: ItineraryRow;
  showDay: boolean;
  /** Position in the list shown, for the "#n" beside the time. */
  number?: number | undefined;
  /** Edit mode for the whole itinerary, held by the page and toggled in its header. */
  editing?: boolean;
  /** Where the trip is, so a place search is answered locally. */
  near?: string | undefined;
  onEdit: (field: string | null) => void;
  onUpdate: (
    patch: Partial<
      Pick<
        ItineraryRow,
        | "title"
        | "detail"
        | "time_label"
        | "kind"
        | "day_date"
        | "address"
        | "lat"
        | "lon"
        | "planned_stay_minutes"
      >
    >,
  ) => void;
  onRemove: () => void;
  /** Swap with the entry above or below, within the same day. */
  onMove?: ((direction: -1 | 1) => void) | undefined;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** Save this stop to the vault, so a good find outlives the trip. */
  onKeep?: ((item: ItineraryRow) => Promise<void>) | undefined;
  /** Mark done (arrived and left), or back to not done. */
  onToggleDone: () => void;
  /** The swipe hint line; shown on the first card of a day, not all of them. */
  showSwipeHint?: boolean;
  /** Show this stop on the Map Split tab. Only offered for a placed stop. */
  onLocate?: (() => void) | undefined;
  /** Save the booking switch, reference and details. Rejects on failure. */
  onSaveBooking?: ((patch: BookingPatch) => Promise<void>) | undefined;
}) {
  const [kept, setKept] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const booked = isBooked(item);
  const rail = timeForRail(item.time_label);
  const done = isDone(item);
  const detail = stripEmbeddedMapsUrl(item.detail);
  const canKeep = Boolean(onKeep) && item.kind !== "note";

  const keep = () => {
    if (!onKeep || kept) return;
    void onKeep(item).then(
      () => setKept(true),
      (e: unknown) =>
        toast.error(e instanceof Error ? e.message : "Couldn't save that to your places."),
    );
  };

  const titleInput = (
    <input
      defaultValue={item.title}
      aria-label="Name"
      onFocus={() => onEdit(item.title)}
      onBlur={(e) => {
        onEdit(null);
        if (e.target.value.trim() && e.target.value !== item.title)
          onUpdate({ title: e.target.value.trim() });
      }}
      className="w-full min-w-0 rounded-md bg-transparent text-[15.5px] font-semibold leading-snug outline-none focus:bg-elevated"
    />
  );

  const detailInput = (
    <TimelineDetailInput
      detail={item.detail}
      onFocus={() => onEdit(item.title)}
      onCommit={(next) => {
        onEdit(null);
        const prev = stripEmbeddedMapsUrl(item.detail);
        if (next !== prev) onUpdate({ detail: next || null });
      }}
    />
  );

  const placed = item.lat != null && item.lon != null;
  // The front says where; a stop with no place says so, quietly.
  const where = item.address || (item.kind === "note" ? detail : "") || "";
  const back = editing || flipped;

  const flip = (open: boolean) => {
    setFlipped(open);
    if (!open) onEdit(null);
  };

  // The front: time, name and where. Everything else is one tap away, on the
  // back of the card, so a day of twelve stops reads as twelve lines.
  const front = (
    <article
      className={`overflow-hidden rounded-2xl border bg-card ${
        done ? "border-nexttime/40" : "border-border/70"
      }`}
    >
      <button
        type="button"
        onClick={() => flip(true)}
        aria-expanded={false}
        aria-label={`${rail ? `${rail}, ` : ""}${item.title}${where ? `, ${where}` : ""} — tap to edit`}
        className="flex min-h-14 w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left"
      >
        <span
          className={`w-11 shrink-0 text-[14px] font-bold tabular-nums ${rail ? "text-primary" : "text-muted-foreground"}`}
        >
          {rail || "–"}
        </span>
        <TimelineGlyphMark item={item} />
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-[15px] font-semibold leading-snug ${
              done ? "text-muted-foreground line-through" : ""
            }`}
          >
            {showDay && item.day_date ? (
              <span className="mr-1.5 text-[12px] font-normal text-muted-foreground">
                {item.day_date}
              </span>
            ) : null}
            {item.title}
          </span>
          <span className="block truncate text-[12.5px] text-muted-foreground">
            {where || "No place yet"}
          </span>
        </span>
        {booked && (
          <span
            title="Booked"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-nexttime/15 text-nexttime"
          >
            <Ticket className="size-3.5" aria-hidden />
            <span className="sr-only">Booked</span>
          </span>
        )}
        {done && (
          <span
            title="Done"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-nexttime/15 text-nexttime"
          >
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            <span className="sr-only">Done</span>
          </span>
        )}
      </button>
    </article>
  );

  const iconButton =
    "inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-[12.5px] font-semibold text-muted-foreground disabled:opacity-40";

  // The back: every change to this stop, and its booking, in one place.
  const backSide = (
    <article className="card-flip rounded-2xl border border-primary/30 bg-card p-3 shadow-sm">
      <div className="flex min-w-0 items-center gap-2">
        {number != null && (
          <span className="rounded-md bg-elevated px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
            #{number}
          </span>
        )}
        <TimelineGlyphMark item={item} />
        <span className="label-caps">Edit stop</span>
        {!editing && (
          <button
            type="button"
            onClick={() => flip(false)}
            aria-label={`Close ${item.title}`}
            className="ml-auto inline-flex min-h-9 items-center rounded-xl bg-foreground px-3 text-[12.5px] font-bold text-background"
          >
            Done
          </button>
        )}
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="rounded-lg border border-border bg-elevated px-2 py-1.5">{titleInput}</div>
        {detailInput}
      </div>

      {booked && (
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="mt-2 block w-full rounded-lg bg-nexttime/10 px-2.5 py-2 text-left"
        >
          <span className="block text-[12.5px] font-bold text-nexttime">
            ✓ Booked{item.booking_ref ? ` · ${item.booking_ref}` : ""}
          </span>
          {item.booking_details ? (
            <span className="block whitespace-pre-line text-[12.5px] text-foreground/80">
              {item.booking_details}
            </span>
          ) : null}
        </button>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-elevated p-2">
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          Day
          <input
            type="date"
            value={item.day_date ?? ""}
            aria-label={`Day for ${item.title}`}
            {...(tripStart ? { min: tripStart } : {})}
            {...(tripEnd ? { max: tripEnd } : {})}
            onChange={(e) => onUpdate({ day_date: e.target.value || null })}
            className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
          />
        </label>
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          Time
          <input
            type="time"
            value={rail}
            aria-label={`Time for ${item.title}`}
            onChange={(e) => onUpdate({ time_label: e.target.value || null })}
            className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
          />
        </label>
        {/* How long the plan allows here. Companion counts it down once you
            tap "I'm here"; left empty, it only says how long it has been. */}
        <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          Stay
          <select
            value={item.planned_stay_minutes ?? ""}
            aria-label={`How long to stay at ${item.title}`}
            onChange={(e) => onUpdate({ planned_stay_minutes: parseStayChoice(e.target.value) })}
            className="rounded-lg border border-border bg-card px-2 py-1 text-[12.5px] text-foreground"
          >
            <option value="">—</option>
            {stayChoices(item.planned_stay_minutes).map((minutes) => (
              <option key={minutes} value={minutes}>
                {stayLabel(minutes)}
              </option>
            ))}
          </select>
        </label>
        <TimelinePlaceEditor
          item={item}
          {...(near ? { near } : {})}
          onPick={(place) => onUpdate(placePatchForSavedRow(place))}
        />
        {placed && (
          <a
            href={mapsPlaceUrl(item.title, item)}
            target="_blank"
            rel="noreferrer"
            className="text-[12px] font-semibold text-primary underline"
          >
            Open in Maps
          </a>
        )}
      </div>

      {/* The same actions the swipe gives, and the rest, with their names. */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
          className={`${iconButton} ${done ? "border-nexttime/40 text-nexttime" : ""}`}
        >
          <Check className="size-4" strokeWidth={done ? 3 : 2} aria-hidden />
          {done ? "Done" : "Mark done"}
        </button>
        {onSaveBooking && (
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            aria-label={`Booking for ${item.title}`}
            className={`${iconButton} ${booked ? "text-nexttime" : ""}`}
          >
            <Ticket className="size-4" aria-hidden />
            Booking
          </button>
        )}
        {onLocate && placed && (
          <button
            type="button"
            onClick={onLocate}
            aria-label={`Locate ${item.title} on the map`}
            className={iconButton}
          >
            <MapPin className="size-4" aria-hidden />
            Map
          </button>
        )}
        {canKeep && (
          <button
            type="button"
            onClick={keep}
            disabled={kept}
            aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
            className={`${iconButton} ${kept ? "text-primary" : ""}`}
          >
            <Bookmark className="size-4" fill={kept ? "currentColor" : "none"} aria-hidden />
            {kept ? "Saved" : "Save"}
          </button>
        )}
        {onMove && (
          <>
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              aria-label={`Move ${item.title} earlier`}
              className={iconButton}
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              aria-label={`Move ${item.title} later`}
              className={iconButton}
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${item.title}`}
          className={`${iconButton} ml-auto text-destructive`}
        >
          <Trash2 className="size-4" aria-hidden />
          Delete
        </button>
      </div>
    </article>
  );

  return (
    <li className="relative min-w-0 list-none">
      {back ? (
        backSide
      ) : (
        <SwipeRow
          done={done}
          onToggleDone={onToggleDone}
          onSave={canKeep && !kept ? keep : undefined}
          onDelete={onRemove}
        >
          {front}
        </SwipeRow>
      )}
      {!back && showSwipeHint && (
        <p className="mt-1 px-1 text-center text-[10.5px] text-muted-foreground/80">
          Tap a stop to edit · swipe right for done, left to save or delete
        </p>
      )}
      {onSaveBooking && bookingOpen && (
        <BookingSheet
          item={item}
          open={bookingOpen}
          onClose={() => setBookingOpen(false)}
          onSave={onSaveBooking}
        />
      )}
    </li>
  );
}

/**
 * Move a saved entry to a different place.
 *
 * "Order" and "where" are the two things that change about a plan after it is
 * written down, and only order had a control. The search is the same one the
 * add form uses, so a pick brings the address and the point with it — which is
 * also what puts the entry on the trip's map.
 */
function TimelinePlaceEditor({
  item,
  near,
  onPick,
}: {
  item: ItineraryRow;
  near?: string | undefined;
  onPick: (place: ParsedPlace) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  if (!open)
    return (
      <button
        type="button"
        onClick={() => {
          setQuery(item.title);
          setOpen(true);
        }}
        className="flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[12px] text-muted-foreground"
      >
        <MapPinPlus className="size-3.5" aria-hidden />
        {item.address ? "Change place" : "Set place"}
      </button>
    );

  return (
    <div className="w-full space-y-1.5">
      <PlaceSearchInput
        value={query}
        onChange={setQuery}
        onPick={(place) => {
          onPick(place);
          setOpen(false);
        }}
        placeholder={`Where is ${item.title}?`}
        {...(near ? { near } : {})}
      />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-[12px] text-muted-foreground underline"
      >
        Cancel
      </button>
    </div>
  );
}

/** Keeps the detail draft while focused so a realtime row refresh cannot wipe it. */
function TimelineDetailInput({
  detail,
  autoFocus = false,
  onFocus,
  onCommit,
}: {
  detail: string | null;
  autoFocus?: boolean;
  onFocus: () => void;
  onCommit: (next: string) => void;
}) {
  const remote = stripEmbeddedMapsUrl(detail);
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState(remote);

  useEffect(() => {
    setDraft((current) => syncDetailDraft(focused, current, detail));
  }, [detail, focused]);

  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      placeholder="Add a detail"
      aria-label="Note"
      autoFocus={autoFocus}
      onFocus={() => {
        setFocused(true);
        onFocus();
      }}
      onBlur={() => {
        setFocused(false);
        const next = stripEmbeddedMapsUrl(draft);
        setDraft(next);
        onCommit(next);
      }}
      className="w-full min-w-0 truncate bg-transparent text-[13px] text-muted-foreground outline-none"
    />
  );
}

/**
 * The walk or drive to the next stop, drawn between the two cards.
 *
 * The prototype's transit row: how long and how far, and "Map route". The
 * turn-by-turn steps open from the summary, because they are only worth the
 * space when you are about to walk them. Hidden by "Walk times" in Customize.
 */
export function TransitConnector({ leg }: { leg?: RouteLeg | undefined }) {
  const [open, setOpen] = useState(false);
  if (!leg) return null;

  const measured = leg.distance > 0;
  const how = leg.mode === "walking" ? "walk" : "drive";
  const summary = measured
    ? `${prettyDuration(leg.duration)} ${how} (${prettyDistance(leg.distance)}) to ${leg.to}`
    : `Directions to ${leg.to}`;
  const Icon = leg.mode === "walking" ? Footprints : Car;

  return (
    <li className="list-none">
      <div className="rounded-2xl border border-border/70 bg-card px-3 py-1.5">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            className="flex min-h-9 min-w-0 items-center gap-2 text-left text-[12.5px] text-muted-foreground"
          >
            <Icon className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {open ? "Hide directions" : summary}
            </span>
          </button>
          <a
            href={leg.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-[12.5px] font-semibold text-nexttime"
          >
            Map route ↗
          </a>
        </div>
        {open && (
          <div className="mb-1.5 mt-1 rounded-lg border border-border bg-elevated p-2">
            {leg.steps.length > 0 ? (
              <ol className="space-y-1">
                {leg.steps.map((step, s) => (
                  <li key={s} className="text-[12px] text-muted-foreground">
                    {step.instruction}
                    {step.distance > 0 && ` · ${prettyDistance(step.distance)}`}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12px] text-muted-foreground">{unroutedLegCopy(leg)}.</p>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Between two cards, centred on the line: add a stop there at a halfway time. */
export function AddBetween({ onAdd }: { onAdd: () => void }) {
  return (
    <li className="list-none">
      {/* A small + on the line between two cards: there when you want it,
          not a card's worth of height between every stop. */}
      <div className="flex items-center gap-2 px-6">
        <span aria-hidden className="h-px flex-1 bg-border/70" />
        <button
          type="button"
          onClick={onAdd}
          aria-label="Add stop between"
          title="Add stop between"
          className="tap-44 grid size-6 place-items-center rounded-full border border-primary/30 bg-card text-primary"
        >
          <Plus className="size-3.5" aria-hidden />
        </button>
        <span aria-hidden className="h-px flex-1 bg-border/70" />
      </div>
    </li>
  );
}
