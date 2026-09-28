import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowUp,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  FileText,
  CornerUpLeft,
  CornerUpRight,
  FlagArrive,
  Footprints,
  MapIcon,
  MapPin,
  MapPinPlus,
  MoreHorizontal,
  PawPrint,
  ExternalLink,
  Plus,
  Ticket,
  Trash2,
  Undo2,
} from "@/components/icons";
import { StopArt, StopChips, StopDisc } from "@/components/day/stop-bits";
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
import { legMiniMap, stepTurn, type LatLon, type StepTurn } from "@/lib/leg-mini-map";

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
  onMoveTo,
  linkedDocuments = 0,
  onOpenDocuments,
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
  /**
   * One step up or down: inside the day, or over its edge onto the day
   * before or after.
   */
  onMove?: ((direction: -1 | 1) => void) | undefined;
  /** Open "Move to…": any day, any place in it, and its time. */
  onMoveTo?: (() => void) | undefined;
  /** Trip documents linked to this stop (a ticket, a confirmation). */
  linkedDocuments?: number;
  /** Open them: the same record the trip's Bookings and Trip documents open. */
  onOpenDocuments?: (() => void) | undefined;
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
  /** The quick actions under the front, opened by ⋯. */
  const [actionsOpen, setActionsOpen] = useState(false);
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

  // The front, as in the master: a square picture, the name in the serif,
  // how long, the kind and Booked as chips, and ⋯ and › on the right. The
  // time and the numbered disc sit on the rail to the left (see the <li>).
  // Tapping the name or › turns the card over to edit it; ⋯ opens the quick
  // actions (done, save, map, booking, delete) that the swipe also gives.
  const current = Boolean(item.arrived_at) && !item.left_at;
  const whereLine = stray ? "" : where && where === detail ? "" : where || "No place yet";
  const roundIcon =
    "tap-44 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-card text-foreground shadow-2xs transition-colors";
  const quickButton =
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12.5px] font-semibold text-muted-foreground disabled:opacity-40";
  const front = (
    <article
      className={`rounded-2xl bg-card p-1.5 transition-colors ${current ? "bg-primary-soft" : ""}`}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => flip(true)}
          aria-expanded={false}
          aria-label={`${rail ? `${rail}, ` : ""}${item.title}${parentTitle ? `, in ${parentTitle}` : ""}${where ? `, ${where}` : ""} — tap to edit`}
          className="flex min-w-0 flex-1 items-start gap-2.5 text-left"
        >
          <StopArt
            item={item}
            className={`size-16 rounded-xl ${done ? "opacity-60 grayscale-[35%]" : ""}`}
          />
          <span className="block min-w-0 flex-1">
            {parentTitle ? (
              <span className="mb-0.5 block truncate text-[10.5px] font-bold uppercase tracking-wide text-primary">
                In {parentTitle}
              </span>
            ) : null}
            {showDay && item.day_date ? (
              <span className="block text-[11px] text-muted-foreground">{item.day_date}</span>
            ) : null}
            <span
              className={`block break-words font-display text-[19px] leading-[1.1] ${
                done ? "text-muted-foreground line-through" : ""
              }`}
            >
              {item.title}
            </span>
            {item.planned_stay_minutes ? (
              <span className="mt-0.5 flex items-center gap-1 text-[12.5px] text-muted-foreground">
                <Clock className="size-3.5" aria-hidden />
                {stayLabel(item.planned_stay_minutes)}
              </span>
            ) : null}
            {detail ? (
              <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-muted-foreground">
                {detail}
              </span>
            ) : null}
            {whereLine ? (
              <span className="mt-0.5 line-clamp-1 block break-words text-[12px] leading-snug text-muted-foreground">
                {whereLine}
              </span>
            ) : null}
            {flat && inside.length > 0 ? (
              <span className="mt-0.5 line-clamp-2 block break-words text-[12px] leading-snug text-muted-foreground">
                Inside:{" "}
                {inside.map((entry) => `${entry.done ? "✓ " : ""}${entry.title}`).join(" · ")}
              </span>
            ) : null}
            {stray ? (
              <span className="mt-1 block text-[12px] font-semibold text-destructive">
                ⚠ Pinned far from the rest of this trip. Tap to check the place.
              </span>
            ) : null}
            <StopChips
              item={item}
              extra={
                <>
                  {booked && item.booking_ref ? (
                    <span className="text-[11.5px] text-muted-foreground">{item.booking_ref}</span>
                  ) : null}
                  {current && (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">
                      Current
                    </span>
                  )}
                  {done && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-nexttime/10 px-2 py-0.5 text-[11px] font-bold text-nexttime">
                      <Check className="size-3" strokeWidth={3} aria-hidden />
                      Completed
                    </span>
                  )}
                </>
              }
            />
          </span>
        </button>
        <div className="flex shrink-0 flex-col items-center gap-1 pt-0.5">
          {linkedDocuments > 0 && onOpenDocuments ? (
            <button
              type="button"
              onClick={onOpenDocuments}
              aria-label={`${linkedDocuments === 1 ? "Booking document" : `${linkedDocuments} booking documents`} for ${item.title}`}
              className="tap-44 grid size-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary"
            >
              <FileText className="size-4" aria-hidden />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setActionsOpen((o) => !o)}
            aria-expanded={actionsOpen}
            aria-label={`Actions for ${item.title}`}
            className={`${roundIcon} ${actionsOpen ? "border-primary text-primary" : ""}`}
          >
            <MoreHorizontal className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => flip(true)}
            aria-label={`Open ${item.title}`}
            className="tap-44 grid size-8 place-items-center text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
      </div>
      {pill && (
        <div className="pl-[74px]">
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
        </div>
      )}
      {actionsOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-border pt-2">
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={done}
            aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
            className={`${quickButton} ${done ? "text-nexttime" : ""}`}
          >
            <Check className="size-4" strokeWidth={done ? 3 : 2} aria-hidden />
            {done ? "Done" : "Mark done"}
          </button>
          {canKeep && (
            <button
              type="button"
              onClick={keep}
              disabled={kept}
              aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
              className={`${quickButton} ${kept ? "text-primary" : ""}`}
            >
              <Bookmark className="size-4" fill={kept ? "currentColor" : "none"} aria-hidden />
              {kept ? "Saved" : "Save"}
            </button>
          )}
          {onLocate && placed && (
            <button
              type="button"
              onClick={onLocate}
              aria-label={`Locate ${item.title} on the map`}
              className={quickButton}
            >
              <MapPin className="size-4" aria-hidden />
              Map
            </button>
          )}
          {onSaveBooking && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              aria-label={`Booking for ${item.title}`}
              className={`${quickButton} ${booked ? "text-nexttime" : ""}`}
            >
              <Ticket className="size-4" aria-hidden />
              Booking
            </button>
          )}
          {onMove && (
            <>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                aria-label={`Move ${item.title} up`}
                className={quickButton}
              >
                <ChevronUp className="size-4" aria-hidden />
                Up
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                aria-label={`Move ${item.title} down`}
                className={quickButton}
              >
                <ChevronDown className="size-4" aria-hidden />
                Down
              </button>
            </>
          )}
          {onMoveTo && (
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onMoveTo();
              }}
              aria-label={`Move ${item.title} to another day or place`}
              className={quickButton}
            >
              <CalendarDays className="size-4" aria-hidden />
              Move to…
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${item.title}`}
            className={`${quickButton} text-destructive`}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete
          </button>
        </div>
      )}
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
        {onMoveTo && (
          <button
            type="button"
            onClick={onMoveTo}
            aria-label={`Move ${item.title} to another day or place`}
            className={iconButton}
          >
            <CalendarDays className="size-4" aria-hidden />
            Move to…
          </button>
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
      <div className="grid grid-cols-[2.75rem_2rem_minmax(0,1fr)] gap-x-1.5">
        {/* The rail: the hour, and the numbered disc on the day's line. */}
        <span
          className={`pt-3.5 text-[14px] font-bold tabular-nums ${rail ? "text-primary" : "text-muted-foreground"}`}
        >
          {rail || "–"}
        </span>
        <span className="relative z-10 flex justify-center pt-3">
          {number != null ? (
            <StopDisc number={number} done={done} />
          ) : (
            <span className="mt-2 size-3 rounded-full bg-primary" aria-hidden />
          )}
        </span>
        <div className={`relative min-w-0 ${parentTitle ? "ml-5" : ""}`}>
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
            <p className="mt-1 px-1 text-[10.5px] text-muted-foreground/80">
              Tap a stop to edit · swipe right for done, left to save or delete
            </p>
          )}
        </div>
      </div>
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
 * Between two stops, the master's "Walk to next stop · 9 min · 426 m" panel,
 * with a map button and a chevron that opens the steps.
 *
 * Time and distance appear once directions are measured (saved on the phone,
 * worked out on Companion, or kept on the timeline); "Leave by" when the next
 * stop has a clock time as well. Opening Maps is always one tap, measured or
 * not. Nothing is drawn for a leg that was never measured beyond saying so.
 */
export function TravelConnector({
  from,
  to,
  leg,
  area,
  showTime = true,
  onAddBetween,
  fromNumber,
}: {
  from: Pick<ItineraryRow, "title" | "lat" | "lon">;
  to: Pick<ItineraryRow, "title" | "lat" | "lon" | "time_label">;
  /** The number on the stop it leaves from, so the small map's pins match the list. */
  fromNumber?: number | undefined;
  /** The measured leg from `from` to `to`, when there is one. */
  leg?: RouteLeg | undefined;
  area: string;
  /** The walk-times preference: off shows the destination and Maps only. */
  showTime?: boolean;
  /** Add a stop between these two. */
  onAddBetween?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const mode = leg?.mode === "driving" ? "driving" : "walking";
  const href = leg?.mapUrl || mapsDirUrl(from, to, area, mode);
  const isMeasured = Boolean(leg && leg.distance > 0);
  const leave = showTime && leg ? leaveBy(to.time_label, leg) : null;
  const steps = leg?.steps ?? [];
  const walking = mode === "walking";
  const heading =
    showTime && isMeasured
      ? walking
        ? "Walk to next stop"
        : "Drive to next stop"
      : `Travelling to ${to.title}`;
  const sub =
    showTime && isMeasured && leg
      ? `${leg.estimated ? "~" : ""}${prettyDuration(leg.duration)} · ${prettyDistance(leg.distance)}`
      : showTime
        ? "Not measured yet"
        : "Directions in Maps";
  return (
    <li className="list-none">
      <div className="grid grid-cols-[2.75rem_2rem_minmax(0,1fr)] gap-x-1.5">
        <span />
        <span />
        <div className="my-1 overflow-hidden rounded-2xl bg-elevated">
          <div className="flex items-center gap-2 py-1 pl-2.5 pr-1">
            {isMeasured && showTime ? (
              walking ? (
                <Footprints className="size-5 shrink-0" aria-hidden />
              ) : (
                <Car className="size-5 shrink-0" aria-hidden />
              )
            ) : (
              <PawPrint className="size-4 shrink-0 text-primary" aria-hidden />
            )}
            <div className="min-w-0 flex-1 py-0.5">
              <p className="truncate text-[13.5px] font-semibold">{heading}</p>
              {leg?.farApartKm ? (
                // One of the two pins is wrong; a drive between them would be
                // a confident answer to the wrong question.
                <p className="text-[11.5px] font-semibold text-destructive">
                  ⚠ {leg.farApartKm} km apart on the map on the same day — one of these stops is
                  probably in the wrong place. Tap it to check.
                </p>
              ) : (
                <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted-foreground">
                  <span className="whitespace-nowrap">{sub}</span>
                  {leave?.kind === "time" && (
                    <span className="font-semibold text-primary">Leave by {leave.at}</span>
                  )}
                </p>
              )}
            </div>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions from ${from.title} to ${to.title} in Maps`}
              title="Open in Maps"
              className="tap-44 grid size-9 shrink-0 place-items-center border-l border-border text-foreground transition-colors hover:text-primary"
            >
              <MapIcon className="size-5" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Hide directions" : "See directions"}
              className="tap-44 grid size-9 shrink-0 place-items-center border-l border-border text-foreground"
            >
              <ChevronDown
                className={`size-5 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
          {open && (
            <LegMiniMap
              from={
                leg?.fromLat != null && leg.fromLon != null
                  ? { lat: leg.fromLat, lon: leg.fromLon }
                  : from.lat != null && from.lon != null
                    ? { lat: from.lat, lon: from.lon }
                    : null
              }
              to={
                leg?.toLat != null && leg.toLon != null
                  ? { lat: leg.toLat, lon: leg.toLon }
                  : to.lat != null && to.lon != null
                    ? { lat: to.lat, lon: to.lon }
                    : null
              }
              walking={walking}
              fromNumber={fromNumber}
            />
          )}
          {open && (
            <div className="space-y-2 border-t border-border bg-card/60 px-3 py-2.5">
              {steps.length > 0 ? (
                <ol className="space-y-1.5">
                  {steps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[12.5px]">
                      <StepArrow instruction={step.instruction} />
                      <span className="min-w-0 flex-1 leading-snug">{step.instruction}</span>
                      {step.distance > 0 && (
                        <span className="shrink-0 text-[11.5px] text-muted-foreground">
                          {prettyDistance(step.distance)}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[12.5px] text-muted-foreground">
                  {leg ? unroutedLegCopy(leg) : "Béa has not measured this walk yet"}. Open in Maps
                  for the full route, or save directions in the trip menu to see the steps here.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Open in Maps
                </a>
                {/* Béa measures walks and drives only. Maps knows the metro:
                    which line, which stop to get on and where to get off. */}
                <a
                  href={mapsDirUrl(from, to, area, "transit")}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary hover:underline"
                >
                  <ExternalLink className="size-3.5" aria-hidden />
                  Public transport in Maps
                </a>
                {onAddBetween && (
                  <button
                    type="button"
                    onClick={onAddBetween}
                    className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Add a stop between
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

const STEP_ARROWS: Record<StepTurn, ComponentType<{ className?: string }>> = {
  straight: ArrowUp,
  left: CornerUpLeft,
  right: CornerUpRight,
  uturn: Undo2,
  arrive: FlagArrive,
};

/** The turn a step makes, as the master draws it: an arrow, not a number. */
function StepArrow({ instruction }: { instruction: string }) {
  const Arrow = STEP_ARROWS[stepTurn(instruction)];
  return <Arrow className="mt-px size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

/**
 * The two stops on a small map inside the open card, joined by a dotted line
 * with the walker (or car) half way. Drawn only when both ends are placed.
 */
function LegMiniMap({
  from,
  to,
  walking,
  fromNumber,
}: {
  from: LatLon | null;
  to: LatLon | null;
  walking: boolean;
  fromNumber?: number | undefined;
}) {
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    if (!box) return;
    const measure = () => setWidth(Math.round(box.clientWidth));
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(box);
    return () => watch.disconnect();
  }, [box]);
  if (!from || !to) return null;
  const height = 136;
  const plan = width > 0 ? legMiniMap(from, to, width, height, 20) : null;
  const Mode = walking ? Footprints : Car;
  const tone = (n: number) => `seq-${((n - 1) % 5) + 1}`;
  return (
    <div
      ref={setBox}
      className="relative overflow-hidden border-t border-border bg-elevated"
      style={{ height }}
      aria-hidden
    >
      {plan && (
        <>
          {plan.tiles.map((t) => (
            <img
              key={`${t.z}/${t.x}/${t.y}/${t.left}`}
              src={`/api/tile/${t.z}/${t.x}/${t.y}.png`}
              alt=""
              decoding="async"
              className="art-dim absolute size-64 max-w-none"
              style={{ left: t.left, top: t.top }}
            />
          ))}
          <svg className="absolute inset-0 size-full" aria-hidden>
            <line
              x1={plan.from.x}
              y1={plan.from.y}
              x2={plan.to.x}
              y2={plan.to.y}
              stroke="#2f7bb0"
              strokeWidth={3}
              strokeLinecap="round"
              strokeDasharray="1 7"
            />
          </svg>
          <span
            className="absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-card text-foreground shadow-sm"
            style={{
              left: (plan.from.x + plan.to.x) / 2,
              top: (plan.from.y + plan.to.y) / 2,
            }}
          >
            <Mode className="size-4" />
          </span>
          {[
            { at: plan.from, n: fromNumber },
            { at: plan.to, n: fromNumber != null ? fromNumber + 1 : undefined },
          ].map(({ at, n }, i) => (
            <span
              key={i}
              className={`${n != null ? tone(n) : "bg-primary text-primary-foreground"} absolute grid size-7 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white text-[12px] font-bold shadow`}
              style={{ left: at.x, top: at.y }}
            >
              {n ?? (i === 0 ? "A" : "B")}
            </span>
          ))}
          <span className="absolute bottom-0.5 right-1 rounded bg-card/80 px-1 text-[8.5px] leading-tight text-muted-foreground">
            © OpenStreetMap · Geoapify
          </span>
        </>
      )}
    </div>
  );
}
