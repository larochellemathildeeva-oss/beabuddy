import { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MapPin,
  MapPinPlus,
  PawPrint,
  ExternalLink,
  Ticket,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  addInside,
  INSIDE_MAX,
  nestPillLabel,
  removeInside,
  toggleInside,
  type InsideEntry,
} from "@/lib/inside-list";
import { PlaceFacts } from "@/components/PlaceFacts";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { SwipeRow } from "@/components/day/SwipeRow";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import { isBooked } from "@/lib/bookings";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isDone, leaveBy } from "@/lib/companion";
import type { RouteLeg } from "@/lib/directions.functions";
import { mapsDirUrl, mapsPlaceUrl } from "@/lib/direction-stops";
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
  center,
  onEdit,
  onUpdate,
  onRemove,
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  tripStart,
  tripEnd,
  onKeep,
  kept: alreadyKept = false,
  onToggleDone,
  showSwipeHint = false,
  onLocate,
  onSaveBooking,
  stray = false,
  foldInto,
  onFold,
  parentTitle,
  nestedStops = 0,
  onInside,
  flat = false,
}: {
  item: ItineraryRow;
  showDay: boolean;
  /** Position in the list shown, for the "#n" beside the time. */
  number?: number | undefined;
  /** Edit mode for the whole itinerary, held by the page and toggled in its header. */
  editing?: boolean;
  /** Where the trip is, so a place search is answered locally. */
  near?: string | undefined;
  /** The middle of the trip, for chain and category searches. */
  center?: { lat: number; lon: number } | null | undefined;
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
  /** Already in the vault, so the save shows as done from the start. */
  kept?: boolean;
  /** Mark done (arrived and left), or back to not done. */
  onToggleDone: () => void;
  /** The swipe hint line; shown on the first card of a day, not all of them. */
  showSwipeHint?: boolean;
  /** Show this stop on the Map tab. Only offered for a placed stop. */
  onLocate?: (() => void) | undefined;
  /** Placed far from the rest of the trip: probably the wrong place with the same name. */
  stray?: boolean;
  /** Save the booking switch, reference and details. Rejects on failure. */
  onSaveBooking?: ((patch: BookingPatch) => Promise<void>) | undefined;
  /**
   * A journey saved as a stop ("Head to the pier"): the stop it leads to,
   * and turning it into a note there. Plans imported before journeys were
   * folded on import still carry these.
   */
  foldInto?: string | undefined;
  onFold?: (() => void) | undefined;
  /** The stop this one is inside: shown above the name, and the card indented under it. */
  parentTitle?: string | undefined;
  /** How many stops are inside this one, for its pill. */
  nestedStops?: number;
  /** Save what to see inside this stop. Absent until the nesting migration is applied. */
  onInside?: ((next: InsideEntry[]) => void) | undefined;
  /** The flat view: what is inside is a plain line, not a pill. */
  flat?: boolean;
}) {
  const [keptHere, setKept] = useState(false);
  const kept = keptHere || alreadyKept;
  const [flipped, setFlipped] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  /** The pill's list, open on the front of the card. */
  const [insideOpen, setInsideOpen] = useState(false);
  const inside = item.inside ?? [];
  // Editable only once the column exists: the row carries it when it does.
  const canEditInside = Boolean(onInside) && item.inside !== undefined;
  const pill = flat ? null : nestPillLabel(inside.length, nestedStops);
  const insideDone = inside.filter((entry) => entry.done).length;
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

  // The front, as in the prototype: time and number down the left; name,
  // the note and a line of where · how long · booked in the middle; done,
  // save, delete and open along the top right. Tapping the name or the
  // chevron turns the card over to edit it.
  const current = Boolean(item.arrived_at) && !item.left_at;
  const meta = [
    // A note with no address uses its text as "where"; that text is already
    // the line above, so it is not said twice.
    stray ? "" : where && where === detail ? "" : where || "No place yet",
    item.planned_stay_minutes ? `~${stayLabel(item.planned_stay_minutes)}` : "",
  ].filter(Boolean);
  // The prototype's small action tiles; each still reaches 44px of tap.
  const topIcon =
    "tap-44 grid size-6 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-elevated";
  const front = (
    <article
      className={`rounded-2xl border bg-card p-3.5 shadow-2xs transition-colors ${
        current
          ? "border-primary/50 ring-1 ring-primary/20"
          : done
            ? "border-nexttime/40"
            : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex shrink-0 flex-col items-center">
            <span
              className={`mt-0.5 font-mono text-xs font-bold tabular-nums ${rail ? "text-primary" : "text-muted-foreground"}`}
            >
              {rail || "–"}
            </span>
            {number != null && (
              <span className="mt-1 rounded-md bg-elevated px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-muted-foreground">
                #{number}
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => flip(true)}
              aria-expanded={false}
              aria-label={`${rail ? `${rail}, ` : ""}${item.title}${parentTitle ? `, in ${parentTitle}` : ""}${where ? `, ${where}` : ""} — tap to edit`}
              className="w-full min-w-0 text-left"
            >
              {parentTitle ? (
                <span className="mb-0.5 block truncate text-[10px] font-bold uppercase tracking-wide text-primary">
                  In {parentTitle}
                </span>
              ) : null}
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                {showDay && item.day_date ? (
                  <span className="text-[10px] text-muted-foreground">{item.day_date}</span>
                ) : null}
                <span
                  className={`break-words text-sm font-bold leading-snug sm:text-base ${
                    done ? "text-muted-foreground line-through" : ""
                  }`}
                >
                  {item.title}
                </span>
                {current && (
                  <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">
                    Current
                  </span>
                )}
                {done && (
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-nexttime/30 bg-nexttime/10 px-2 py-0.5 text-[10px] font-bold text-nexttime">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                    Completed
                  </span>
                )}
              </span>
              {detail ? (
                <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-relaxed text-muted-foreground">
                  {detail}
                </span>
              ) : null}
              {flat && inside.length > 0 ? (
                <span className="mt-0.5 line-clamp-2 block break-words text-xs leading-relaxed text-muted-foreground">
                  Inside:{" "}
                  {inside.map((entry) => `${entry.done ? "✓ " : ""}${entry.title}`).join(" · ")}
                </span>
              ) : null}
              {stray ? (
                <span className="mt-1 block text-xs font-semibold text-destructive">
                  ⚠ Pinned far from the rest of this trip. Tap to check the place.
                </span>
              ) : null}
              {(meta.length > 0 || booked) && (
                <span className="mt-1 flex flex-wrap items-center gap-x-1.5 break-words text-xs text-muted-foreground">
                  {meta.join(" · ")}
                  {booked && (
                    <span className="inline-flex items-center gap-1 font-semibold text-nexttime">
                      {meta.length ? "· " : ""}
                      <CheckCircle2 className="size-3" aria-hidden />
                      Booked
                      {item.booking_ref ? ` · ${item.booking_ref}` : ""}
                    </span>
                  )}
                </span>
              )}
            </button>
            {pill && (
              <InsidePill
                label={pill}
                entries={inside}
                doneCount={insideDone}
                open={insideOpen}
                onToggleOpen={() => setInsideOpen((o) => !o)}
                {...(canEditInside && onInside
                  ? { onTick: (index: number) => onInside(toggleInside(inside, index)) }
                  : {})}
              />
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          <div className="mr-1 flex items-center gap-0.5">
            <button
              type="button"
              onClick={onToggleDone}
              aria-pressed={done}
              aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
              className={`${topIcon} ${done ? "bg-nexttime/10 text-nexttime" : ""}`}
            >
              <Check className="size-3.5" strokeWidth={done ? 3 : 2} aria-hidden />
            </button>
            {canKeep && (
              <button
                type="button"
                onClick={keep}
                disabled={kept}
                aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
                className={`${topIcon} ${kept ? "text-primary" : ""}`}
              >
                <Bookmark className="size-3.5" fill={kept ? "currentColor" : "none"} aria-hidden />
              </button>
            )}
            <button
              type="button"
              onClick={onRemove}
              aria-label={`Delete ${item.title}`}
              className={`${topIcon} hover:text-destructive`}
            >
              <Trash2 className="size-3.5" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            onClick={() => flip(true)}
            aria-label={`Open ${item.title}`}
            className="tap-44 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
      </div>
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

      {/* Hours, website and phone for a stop on the map, and a warning when
          its time falls outside the hours. Looked up when the card turns. */}
      <div className="mt-2 px-0.5">
        <PlaceFacts
          name={item.title}
          lat={item.lat}
          lon={item.lon}
          day={item.day_date}
          time={item.time_label}
          auto
        />
      </div>

      {onFold && foldInto && (
        <div className="mt-2 rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
          <p className="text-[12px] text-muted-foreground">
            This is the way to a stop, not a stop. It can live as a note on{" "}
            <span className="font-semibold text-foreground">{foldInto}</span> instead.
          </p>
          <button
            type="button"
            onClick={onFold}
            className="mt-1.5 inline-flex items-center rounded-lg bg-primary px-2.5 py-1.5 text-xs font-bold text-primary-foreground shadow-2xs"
          >
            Make it a note on {foldInto}
          </button>
        </div>
      )}

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
        {stray && (
          <p className="w-full text-[12.5px] font-semibold text-destructive">
            ⚠ This pin is far from the rest of the trip, so it may be a different place with the
            same name. Use “Change place” to pick the right one.
          </p>
        )}
        <TimelinePlaceEditor
          item={item}
          {...(near ? { near } : {})}
          {...(center ? { center } : {})}
          {...(center ? { center } : {})}
          onPick={(place) => onUpdate(placePatchForSavedRow(place))}
        />
        {canEditInside && onInside && <InsideEditor entries={inside} onChange={onInside} />}
        {placed && (
          <a
            href={mapsPlaceUrl(item.title, item, item.address)}
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
    <li className={`relative min-w-0 list-none ${parentTitle ? "ml-6" : ""}`}>
      {parentTitle ? (
        // The thread from the stop this one is inside.
        <span
          aria-hidden
          className="pointer-events-none absolute -left-4 -top-2 h-[calc(1.75rem+0.5rem)] w-3 rounded-bl-lg border-b-2 border-l-2 border-primary/25"
        />
      ) : null}
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
 * The pill on a card with things nested in it: "2 inside · 1 stop". With a
 * list inside, tapping opens it on the card, and each entry can be ticked
 * off during the visit. Stops inside are cards of their own below, so the
 * pill only counts them.
 */
function InsidePill({
  label,
  entries,
  doneCount,
  open,
  onToggleOpen,
  onTick,
}: {
  label: string;
  entries: readonly InsideEntry[];
  doneCount: number;
  open: boolean;
  onToggleOpen: () => void;
  onTick?: ((index: number) => void) | undefined;
}) {
  const pillClass =
    "inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/35 bg-primary/5 px-2.5 text-[11px] font-bold text-primary";
  if (entries.length === 0) {
    return (
      <span className="mt-1.5 inline-block">
        <span className={pillClass}>{label}</span>
      </span>
    );
  }
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className={`tap-44 ${pillClass}`}
      >
        {label}
        {doneCount > 0 ? (
          <span className="font-semibold text-nexttime">· {doneCount} seen</span>
        ) : null}
        {open ? (
          <ChevronUp className="size-3" aria-hidden />
        ) : (
          <ChevronDown className="size-3" aria-hidden />
        )}
      </button>
      {open && (
        <ul className="mt-1.5 space-y-0.5 border-l-2 border-dashed border-primary/30 pl-2.5">
          {entries.map((entry, index) => (
            <li key={`${entry.title}-${index}`}>
              <button
                type="button"
                onClick={() => onTick?.(index)}
                disabled={!onTick}
                aria-pressed={entry.done}
                aria-label={`${entry.title}${entry.done ? ", seen" : ""}`}
                className="flex min-h-9 w-full items-center gap-2 text-left text-[13px] disabled:cursor-default"
              >
                <span
                  className={`grid size-4 shrink-0 place-items-center rounded-full border ${
                    entry.done
                      ? "border-nexttime bg-nexttime text-background"
                      : "border-muted-foreground/60"
                  }`}
                >
                  {entry.done ? <Check className="size-2.5" strokeWidth={3} aria-hidden /> : null}
                </span>
                <span className={entry.done ? "text-muted-foreground line-through" : ""}>
                  {entry.title}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** The list inside a stop, on the back of its card: add and remove. */
function InsideEditor({
  entries,
  onChange,
}: {
  entries: readonly InsideEntry[];
  onChange: (next: InsideEntry[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const next = addInside(entries, draft);
    if (next.length !== entries.length) onChange(next);
    setDraft("");
  };
  return (
    <div className="w-full space-y-1">
      <p className="text-[12px] text-muted-foreground">Inside this stop</p>
      {entries.length > 0 && (
        <ul className="space-y-0.5">
          {entries.map((entry, index) => (
            <li
              key={`${entry.title}-${index}`}
              className="flex items-center justify-between gap-2 rounded-lg bg-card px-2 py-1 text-[12.5px]"
            >
              <span className={entry.done ? "text-muted-foreground line-through" : ""}>
                {entry.title}
              </span>
              <button
                type="button"
                onClick={() => onChange(removeInside(entries, index))}
                aria-label={`Remove ${entry.title}`}
                className="tap-44 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      {entries.length < INSIDE_MAX && (
        <div className="flex gap-1.5">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Add something to see here"
            aria-label="Add something to see inside this stop"
            className="min-w-0 flex-1 rounded-lg border border-border bg-card px-2 py-1 text-[12.5px]"
          />
          <button
            type="button"
            onClick={add}
            disabled={!draft.trim()}
            className="rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold disabled:opacity-50"
          >
            Add
          </button>
        </div>
      )}
    </div>
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
  center,
  onPick,
}: {
  item: ItineraryRow;
  near?: string | undefined;
  /** The middle of the trip, for chain and category searches. */
  center?: { lat: number; lon: number } | null | undefined;
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
        {...(center ? { center } : {})}
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
 * Between two cards, the prototype's "Travelling to" card: how long it takes
 * to get to the next stop, when to leave, and the way there.
 *
 * Walk time, distance and steps appear once directions are measured (saved
 * in Settings, or worked out on Companion); "Leave by" when the next stop has
 * a clock time as well. The paw is still the mark, and opening Maps is always
 * one tap, measured or not.
 */
export function TravelConnector({
  from,
  to,
  leg,
  area,
  showTime = true,
}: {
  from: Pick<ItineraryRow, "title" | "lat" | "lon">;
  to: Pick<ItineraryRow, "title" | "lat" | "lon" | "time_label">;
  /** The measured leg from `from` to `to`, when there is one. */
  leg?: RouteLeg | undefined;
  area: string;
  /** The walk-times preference: off shows the destination and Maps only. */
  showTime?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mode = leg?.mode === "driving" ? "driving" : "walking";
  const href = leg?.mapUrl || mapsDirUrl(from, to, area, mode);
  const measured = Boolean(leg && leg.distance > 0);
  const how = mode === "walking" ? "walk" : "drive";
  const leave = showTime && leg ? leaveBy(to.time_label, leg) : null;
  const steps = leg?.steps ?? [];
  return (
    <li className="list-none">
      <div className="my-1.5 rounded-2xl border border-border bg-elevated p-2.5 text-xs shadow-2xs sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-[11rem] flex-1 items-center gap-2">
            <span className="grid size-7 shrink-0 place-items-center rounded-xl border border-border bg-card text-primary shadow-2xs">
              <PawPrint className="size-3.5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-1.5">
                {showTime && measured && leg ? (
                  <>
                    <span className="text-xs font-bold">
                      {leg.estimated ? "~" : ""}
                      {prettyDuration(leg.duration)} {how}
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      ({prettyDistance(leg.distance)})
                    </span>
                  </>
                ) : (
                  <span className="min-w-0 truncate text-xs font-bold">
                    Travelling to {to.title}
                  </span>
                )}
                {leave?.kind === "time" && (
                  <span className="rounded-full border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    Leave by {leave.at}
                  </span>
                )}
              </p>
              {leg?.farApartKm ? (
                // One of the two pins is wrong; a drive between them would be
                // a confident answer to the wrong question.
                <p className="mt-0.5 text-[11px] font-semibold text-destructive">
                  ⚠ {leg.farApartKm} km apart on the map on the same day — one of these stops is
                  probably in the wrong place. Tap it to check.
                </p>
              ) : (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {showTime && measured
                    ? `Travelling to ${to.title}`
                    : showTime
                      ? "Not measured yet"
                      : "Directions in Maps"}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 self-center">
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions from ${from.title} to ${to.title}`}
              title="Open in Maps"
              className="tap-44 rounded-lg border border-border bg-card p-1.5 text-muted-foreground transition-colors hover:text-primary"
            >
              <ExternalLink className="size-3.5" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-semibold text-muted-foreground shadow-2xs transition-colors hover:text-foreground"
            >
              {open ? "Hide directions" : "See directions"}
              <ChevronDown
                className={`size-3.5 text-primary transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
        </div>
        {open && (
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            {steps.length > 0 ? (
              <ol className="space-y-2">
                {steps.map((step, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-2.5 shadow-2xs"
                  >
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-foreground text-[10px] font-bold text-background">
                      {i + 1}
                    </span>
                    <span className="min-w-0 text-xs font-medium leading-relaxed">
                      {step.instruction}
                      {step.distance > 0 && (
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {" "}
                          · {prettyDistance(step.distance)}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-border bg-card p-3 text-xs text-muted-foreground">
                {leg ? unroutedLegCopy(leg) : "Béa has not measured this walk yet"}. Open in Maps
                for the full route, or save directions in Settings to see the steps here.
              </p>
            )}
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-[11px] font-bold text-nexttime hover:underline"
            >
              Open in Maps ↗
            </a>
          </div>
        )}
      </div>
    </li>
  );
}
