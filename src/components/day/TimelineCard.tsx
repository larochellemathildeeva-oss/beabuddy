import { PlacePicture } from "@/components/PlacePicture";
import { friendlyError } from "@/lib/friendly-error";
import { useEffect, useState, type ComponentType, type CSSProperties, type ReactNode } from "react";
import {
  ArrowUp,
  Bookmark,
  Bus,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CalendarDays,
  Clock,
  FileText,
  CornerUpLeft,
  CornerUpRight,
  FlagArrive,
  Footprints,
  Hourglass,
  MapIcon,
  MapPin,
  MapPinPlus,
  MoreHorizontal,
  Pencil,
  ExternalLink,
  Plus,
  Send,
  Ticket,
  Trash2,
  Undo2,
} from "@/components/icons";
import { KindChip, KindIcon, StopDisc } from "@/components/day/stop-bits";
import { toast } from "sonner";
import { useLiveLocationReadOnly } from "@/hooks/useLiveLocation";
import { isNearStop } from "@/lib/live-companion";
import {
  addInside,
  insideHasRoom,
  INSIDE_MAX,
  nestPillLabel,
  removeInside,
  toggleInside,
  type InsideEntry,
} from "@/lib/inside-list";
import { PlaceFacts } from "@/components/PlaceFacts";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { SwipeRow } from "@/components/day/SwipeRow";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";
import { Sheet } from "@/components/Sheet";
import { BookingSheet, type BookingPatch } from "@/components/day/BookingSheet";
import {
  PhotoStrip,
  QuickPhoto,
  StopPhotos,
  type StopPhotosProps,
} from "@/components/day/StopPhotos";
import { isBooked } from "@/lib/bookings";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isDone, leaveBy } from "@/lib/companion";
import { itineraryClockMinutes, timeModeFor, type TimeMode } from "@/lib/itinerary-change";
import type { RouteLeg } from "@/lib/directions.functions";
import { legMapsUrl, mapsDirToUrl, mapsPlaceUrl } from "@/lib/direction-stops";
import { rememberPlacePick, type ParsedPlace } from "@/lib/places.functions";
import { placePatchForSavedRow } from "@/lib/place-label";
import { parseStayChoice, stayChoices, stayLabel } from "@/lib/planned-stay";
import { stripEmbeddedMapsUrl, syncDetailDraft, unroutedLegCopy } from "@/lib/timeline-directions";
import {
  glyphChipLabel,
  kindChoiceLabel,
  normaliseKind,
  TIMELINE_KINDS,
  timeForRail,
  timelineGlyph,
  type TimelineKind,
} from "@/lib/timeline-kind";
import { legMiniMap, stepTurn, type LatLon, type StepTurn } from "@/lib/leg-mini-map";

/**
 * The Timeline's left column: the hour beside each card, and the dashed line
 * of the journey beside each leg. Shared so the two always line up.
 */
const TIME_COLUMN = "grid-cols-[3.25rem_minmax(0,1fr)]";

const TIME_MODES: { value: TimeMode; label: string }[] = [
  { value: "fixed", label: "Fixed" },
  { value: "flexible", label: "Flexible" },
  { value: "sequence", label: "Sequence only" },
];

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
  photos,
  canMoveUp = false,
  canMoveDown = false,
  tripStart,
  tripEnd,
  onKeep,
  kept: alreadyKept = false,
  onToggleDone,
  onLocate,
  onSaveBooking,
  stray = false,
  foldInto,
  onFold,
  parentTitle,
  nestedStops = 0,
  onInside,
  flat = false,
  compact = false,
  dragHandle,
  liRef,
  liStyle,
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
        | "time_locked"
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
  /** Travellers' own photos of this stop, and adding one. Absent where photos are not offered. */
  photos?: StopPhotosProps | undefined;
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
  /**
   * The flat view: stops inside another are not tucked under it or counted
   * on its pill. What is inside is a pill either way: a list of names as a
   * line of text could not be opened, ticked, or show where each one is.
   */
  flat?: boolean;
  /** One line a stop (time, name, kind); tapping it shows the whole card. */
  compact?: boolean;
  /** The grip for dragging the stop within its day, when the list offers it. */
  dragHandle?: ReactNode;
  /** For the drag-and-drop list: the row itself, and its moving style. */
  liRef?: ((el: HTMLLIElement | null) => void) | undefined;
  liStyle?: CSSProperties | undefined;
}) {
  const [keptHere, setKept] = useState(false);
  const kept = keptHere || alreadyKept;
  const [flipped, setFlipped] = useState(false);
  /** A compact row opened to its whole card. */
  const [expanded, setExpanded] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  /** The quick actions under the front, opened by ⋯. */
  const [actionsOpen, setActionsOpen] = useState(false);
  /** The pill's list, open on the front of the card. */
  const [insideOpen, setInsideOpen] = useState(false);
  const inside = item.inside ?? [];
  // Editable only once the column exists: the row carries it when it does.
  const canEditInside = Boolean(onInside) && item.inside !== undefined;
  const pill = nestPillLabel(inside.length, flat ? 0 : nestedStops);
  const insideDone = inside.filter((entry) => entry.done).length;
  const booked = isBooked(item);
  const rail = timeForRail(item.time_label);
  const timeMode = timeModeFor(item);
  // The same reading the mode uses: "Morning" shows on the rail but is not a
  // clock Fixed or Flexible can hold; "9h30" and "2pm" are.
  const hasClock = itineraryClockMinutes(item.time_label) != null;
  const done = isDone(item);
  const detail = stripEmbeddedMapsUrl(item.detail);
  const canKeep = Boolean(onKeep) && item.kind !== "note";

  const keep = () => {
    if (!onKeep || kept) return;
    void onKeep(item).then(
      () => setKept(true),
      (e: unknown) => toast.error(friendlyError(e, "Couldn't save that to your places.")),
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
      className="w-full min-w-0 bg-transparent font-display text-[18.5px] leading-snug outline-none"
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
  // Editing every stop turns every card over in place. One stop opens in a
  // sheet over the day instead, so the list stays where it was.
  const back = editing;

  const flip = (open: boolean) => {
    setFlipped(open);
    if (!open) onEdit(null);
  };

  const current = Boolean(item.arrived_at) && !item.left_at;
  // The phone is here, with "Use my location" on in Now or the map.
  const live = useLiveLocationReadOnly();
  const hereNow =
    !current && live.on && !live.stale && live.fix != null && isNearStop(live.fix, item);
  const whereLine = stray ? "" : where && where === detail ? "" : where || "No place yet";
  const pillButton =
    "inline-flex min-h-9 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-1.5 text-[13px] font-medium transition-colors disabled:opacity-40";
  const softButton = `${pillButton} bg-primary-soft text-primary`;
  const lineButton = `${pillButton} border border-border bg-card text-foreground`;
  const dangerButton = `${pillButton} border border-destructive/20 bg-destructive/10 text-destructive`;

  const mapButton = (
    <button
      type="button"
      onClick={onLocate}
      aria-label={`Locate ${item.title} on the map`}
      className={softButton}
    >
      <MapIcon className="hidden size-4 shrink-0 @[17rem]:inline" aria-hidden />
      Map
    </button>
  );
  const saveButton = (
    <button
      type="button"
      onClick={keep}
      disabled={kept}
      aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
      className={`${lineButton} ${kept ? "text-primary" : ""}`}
    >
      <Bookmark
        className="hidden size-4 shrink-0 @[17rem]:inline"
        weight={kept ? "fill" : "regular"}
        aria-hidden
      />
      {kept ? "Saved" : "Save"}
    </button>
  );
  const canLocate = Boolean(onLocate) && placed;
  const canDirect = placed || Boolean(item.address);

  // The quick actions under ⋯, one per line like a menu: where it is first
  // (the map, directions), then the stop itself, then moving and deleting.
  const menuRow =
    "flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-left text-[15px] font-medium transition-colors hover:bg-elevated disabled:opacity-40";
  const menuIcon = "size-[18px] shrink-0 text-muted-foreground";
  const actionRow =
    "flex min-h-14 w-full items-center gap-3 px-3.5 py-2 text-left text-[16px] font-medium disabled:opacity-40";
  const actionBubble = "grid size-10 shrink-0 place-items-center rounded-xl";

  // The front, as the master draws it: the kind in a tile with the stop's
  // number on its corner (the same number as its pin on the Map), the name
  // in the serif, how long and the kind on one line with Booked, and ⋯ for
  // everything else. The time sits outside the card, on the left. Tapping
  // the name opens the stop in a sheet to edit.
  const front = (
    <article
      className={`rounded-[24px] border border-border/60 bg-card p-2.5 shadow-sm transition-shadow ${
        current ? "ring-2 ring-primary/45" : hereNow ? "ring-2 ring-primary/25" : ""
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="relative block shrink-0" aria-hidden>
          <PlacePicture
            name={item.title}
            kind={item.kind}
            lat={item.lat}
            lon={item.lon}
            className="size-[64px] rounded-2xl"
          />
          {number != null ? (
            <StopDisc
              number={number}
              done={done}
              className="absolute -left-2 -top-2 size-6 text-[13px]"
            />
          ) : null}
        </span>
        <button
          type="button"
          onClick={() => flip(true)}
          aria-expanded={false}
          aria-label={`${number != null ? `Stop ${number}, ` : ""}${rail ? `${rail}, ` : ""}${item.title}${done ? ", done" : ""}${parentTitle ? `, in ${parentTitle}` : ""}${where ? `, ${where}` : ""} — tap to edit`}
          className="block min-w-0 flex-1 text-left"
        >
          {parentTitle ? (
            <span className="mb-0.5 block truncate text-[13px] font-semibold text-primary">
              In {parentTitle}
            </span>
          ) : null}
          {showDay && item.day_date ? (
            <span className="block text-[13px] text-muted-foreground">{item.day_date}</span>
          ) : null}
          <span
            className={`block break-words font-display text-[18px] leading-[1.15] ${
              done ? "text-muted-foreground" : ""
            }`}
          >
            {item.title}
            {done ? (
              <Check
                className="ms-1.5 inline-block size-[18px] align-[-2px] text-primary"
                strokeWidth={3}
                aria-hidden
              />
            ) : null}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[14px] text-muted-foreground">
            {item.planned_stay_minutes ? (
              <span className="whitespace-nowrap">{stayLabel(item.planned_stay_minutes)} ·</span>
            ) : null}
            <span className="whitespace-nowrap">{glyphChipLabel(timelineGlyph(item))}</span>
            {booked ? (
              <span className="tile-fill-3 rounded-full px-2 py-0.5 text-[13px] font-semibold text-nexttime">
                Booked
              </span>
            ) : null}
            {booked && item.booking_ref ? (
              <span className="text-[13px]">{item.booking_ref}</span>
            ) : null}
            {current ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-[13px] font-bold text-primary-foreground">
                Now
              </span>
            ) : hereNow ? (
              <span className="rounded-full border border-primary/40 bg-card px-2 py-0.5 text-[13px] font-bold text-foreground">
                You're here
              </span>
            ) : null}
            {!placed && item.kind !== "note" ? (
              <span className="rounded-full bg-elevated px-2 py-0.5 text-[13px] text-muted-foreground">
                Not on the map
              </span>
            ) : null}
          </span>
          {detail ? (
            <span className="mt-1.5 line-clamp-2 break-words text-[14px] leading-snug text-muted-foreground">
              {detail}
            </span>
          ) : null}
          {whereLine && item.address ? (
            <span className="mt-1 flex items-start gap-1.5 text-[14px] leading-snug text-muted-foreground">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span className="line-clamp-1 break-words">{whereLine}</span>
            </span>
          ) : null}
          {stray ? (
            <span className="mt-1 block text-[13px] font-semibold text-destructive">
              ⚠ Pinned far from the rest of this trip. Tap to check the place.
            </span>
          ) : null}
        </button>
        <div className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setActionsOpen((o) => !o)}
            aria-expanded={actionsOpen}
            aria-label={`Actions for ${item.title}`}
            className={`tap-44 grid size-9 shrink-0 place-items-center rounded-full bg-elevated text-foreground transition-colors ${
              actionsOpen ? "bg-primary-soft text-primary" : ""
            }`}
          >
            <MoreHorizontal className="size-4" weight="bold" aria-hidden />
          </button>
          {linkedDocuments > 0 && onOpenDocuments ? (
            <button
              type="button"
              onClick={onOpenDocuments}
              aria-label={`${linkedDocuments === 1 ? "Booking document" : `${linkedDocuments} booking documents`} for ${item.title}`}
              className="tap-44 grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary"
            >
              <FileText className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>
        {/* The grip goes last, so every kind tile sits on the leg line. */}
        {dragHandle}
      </div>
      {/* A stop that already has photos keeps the camera beside them, so
          adding another is one tap; the first photo comes from ⋯. */}
      {photos && photos.photos.length > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <PhotoStrip photos={photos.photos} title={item.title} onOpen={() => flip(true)} />
          <span className="flex shrink-0 gap-1.5">
            <QuickPhoto photos={photos} />
          </span>
        </div>
      )}
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
      {actionsOpen && (
        <div className="mt-2 border-t border-border pt-1.5">
          {canLocate && (
            <button
              type="button"
              onClick={() => {
                setActionsOpen(false);
                onLocate?.();
              }}
              aria-label={`Locate ${item.title} on the map`}
              className={menuRow}
            >
              <MapIcon className={menuIcon} aria-hidden />
              Show on the map
            </button>
          )}
          {canDirect && (
            <a
              href={mapsDirToUrl(item, near ?? "")}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions to ${item.title} in Maps`}
              className={menuRow}
            >
              <Send className={menuIcon} aria-hidden />
              Directions
            </a>
          )}
          <button
            type="button"
            onClick={onToggleDone}
            aria-pressed={done}
            aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
            className={menuRow}
          >
            <Check
              className={`${menuIcon} ${done ? "text-nexttime" : ""}`}
              strokeWidth={done ? 3 : 2}
              aria-hidden
            />
            {done ? "Mark not done" : "Mark done"}
          </button>
          <button
            type="button"
            onClick={() => {
              setActionsOpen(false);
              flip(true);
            }}
            aria-label={`Edit ${item.title}`}
            className={menuRow}
          >
            <Pencil className={menuIcon} aria-hidden />
            Edit stop
          </button>
          {canKeep && (
            <button
              type="button"
              onClick={keep}
              disabled={kept}
              aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
              className={menuRow}
            >
              <Bookmark
                className={`${menuIcon} ${kept ? "text-primary" : ""}`}
                weight={kept ? "fill" : "regular"}
                aria-hidden
              />
              {kept ? "Saved to your places" : "Save to your places"}
            </button>
          )}
          {onSaveBooking && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              aria-label={`Booking for ${item.title}`}
              className={menuRow}
            >
              <Ticket className={`${menuIcon} ${booked ? "text-nexttime" : ""}`} aria-hidden />
              Booking
            </button>
          )}
          {photos && (
            <div className="px-1 py-1">
              <span className="flex flex-wrap gap-2">
                <QuickPhoto photos={photos} label="Add a photo" />
              </span>
            </div>
          )}
          {onMove && (
            <>
              <button
                type="button"
                disabled={!canMoveUp}
                onClick={() => onMove(-1)}
                aria-label={`Move ${item.title} up`}
                className={menuRow}
              >
                <ChevronUp className={menuIcon} aria-hidden />
                Move earlier
              </button>
              <button
                type="button"
                disabled={!canMoveDown}
                onClick={() => onMove(1)}
                aria-label={`Move ${item.title} down`}
                className={menuRow}
              >
                <ChevronDown className={menuIcon} aria-hidden />
                Move later
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
              className={menuRow}
            >
              <CalendarDays className={menuIcon} aria-hidden />
              Move to…
            </button>
          )}
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Delete ${item.title}`}
            className={`${menuRow} text-destructive`}
          >
            <Trash2 className="size-[18px] shrink-0" aria-hidden />
            Delete
          </button>
        </div>
      )}
    </article>
  );

  // The compact row: time, name and kind on one line. Tapping it shows the
  // whole card; "Less" folds it back.
  const compactRow = (
    // A row as the Figma timeline draws it: the name, one line under it, a
    // hairline. The hour sits in the column to its left.
    <article
      className={`flex items-start gap-1.5 border-b border-[var(--rule)] py-3 ${
        current ? "bg-primary-soft/40" : hereNow ? "bg-primary-soft/25" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded(true)}
        aria-expanded={false}
        aria-label={`${number != null ? `Stop ${number}, ` : ""}${rail ? `${rail}, ` : ""}${item.title}${done ? ", done" : ""}${current ? ", you're here" : ""} — show the whole card`}
        className="flex min-h-11 min-w-0 flex-1 flex-col items-start justify-center text-left"
      >
        <span
          className={`flex w-full min-w-0 items-center gap-1.5 text-[16px] leading-[1.4] ${
            done ? "text-muted-foreground" : ""
          }`}
        >
          {done ? (
            <Check className="size-4 shrink-0 text-nexttime" strokeWidth={3} aria-hidden />
          ) : null}
          <span className="min-w-0 truncate">{item.title}</span>
        </span>
        {stray ? (
          // The one warning a row keeps: a pin far from the trip is likely the wrong place.
          <span className="mt-1 block w-full text-[14px] leading-[1.4] text-destructive">
            ⚠ Pinned far from the rest of this trip. Tap to check the place.
          </span>
        ) : (
          <span className="mt-1 block w-full truncate text-[14px] leading-[1.4] text-foreground">
            {where || glyphChipLabel(timelineGlyph(item))}
          </span>
        )}
      </button>
      {dragHandle}
    </article>
  );
  const folded = compact && !expanded;

  const field =
    "block min-h-9 w-full min-w-0 rounded-xl border border-border bg-card px-2 text-[14px] text-foreground";
  const caption = "mb-1 flex items-center gap-1 text-[12px] font-medium text-muted-foreground";
  const timeModeNote =
    timeMode === "fixed"
      ? "Keep this time. Béa won’t move it."
      : timeMode === "flexible"
        ? "Béa may shift this time to keep the day workable."
        : "Keep its place in the day, without a clock time.";

  const chooseTimeMode = (mode: TimeMode) => {
    if (mode === timeMode) return;
    if (mode === "sequence") {
      // Only a clock time is taken away. A label such as "Morning" is the
      // traveller's own words and is already Sequence only.
      onUpdate(hasClock ? { time_label: null, time_locked: null } : { time_locked: null });
      return;
    }
    if (!hasClock) return;
    onUpdate({ time_locked: mode === "fixed" });
  };

  // The back: its # and kind over the fields. Each field is kept to one short
  // line, so a phone sees most of it at once.
  const backHeader = (
    <div className="flex min-w-0 items-center gap-1.5">
      {number != null && (
        <span className="grid h-8 min-w-8 place-items-center rounded-full bg-elevated px-2 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
          #{number}
        </span>
      )}
      <span
        className={`kind-chip kind-${timelineGlyph(item)} grid size-8 place-items-center rounded-full`}
      >
        <KindIcon item={item} />
      </span>
      <span className="label-caps whitespace-nowrap">Edit stop</span>
    </div>
  );

  // Every change to this stop, and its booking, in one place: in a sheet over
  // the day for one stop, or on the card itself when editing every stop.
  const backBody = (
    <>
      <div className={editing ? "" : "plain-card p-3.5"}>
        <div className="mt-2.5 space-y-2">
          <div className="rounded-xl border border-border bg-elevated px-3 py-1">{titleInput}</div>
          <KindPicker item={item} onPick={(kind) => onUpdate({ kind })} />
        </div>

        {/* Three across when the card has room; on a narrow phone (touch fields
          are held at 16px) the date takes its own line, time and duration under it. */}
        <div className="@container mt-2.5">
          <div className="grid grid-cols-2 gap-1.5 @[24rem]:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <label className="col-span-2 min-w-0 @[24rem]:col-span-1">
              <span className={caption}>
                <CalendarDays className="size-3.5" aria-hidden />
                Date
              </span>
              <input
                type="date"
                value={item.day_date ?? ""}
                aria-label={`Day for ${item.title}`}
                {...(tripStart ? { min: tripStart } : {})}
                {...(tripEnd ? { max: tripEnd } : {})}
                onChange={(e) => onUpdate({ day_date: e.target.value || null })}
                className={field}
              />
            </label>
            <label className="min-w-0">
              <span className={caption}>
                <Clock className="size-3.5" aria-hidden />
                Time
              </span>
              <input
                type="time"
                value={rail}
                aria-label={`Time for ${item.title}`}
                onChange={(e) => onUpdate({ time_label: e.target.value || null })}
                className={field}
              />
            </label>
            {/* How long the plan allows here. Companion counts it down once you
            tap "I'm here"; left empty, it only says how long it has been. */}
            <label className="min-w-0">
              <span className={caption}>
                <Hourglass className="size-3.5" aria-hidden />
                Duration
              </span>
              <select
                value={item.planned_stay_minutes ?? ""}
                aria-label={`How long to stay at ${item.title}`}
                onChange={(e) =>
                  onUpdate({ planned_stay_minutes: parseStayChoice(e.target.value) })
                }
                className={field}
              >
                <option value="">—</option>
                {stayChoices(item.planned_stay_minutes).map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {stayLabel(minutes)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <fieldset className="mt-2.5 min-w-0">
          <legend className={caption}>
            <Clock className="size-3.5" aria-hidden />
            Time behavior
          </legend>
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-elevated p-1">
            {TIME_MODES.map((mode) => {
              const active = timeMode === mode.value;
              const disabled = mode.value !== "sequence" && !hasClock;
              return (
                <button
                  key={mode.value}
                  type="button"
                  aria-pressed={active}
                  disabled={disabled}
                  onClick={() => chooseTimeMode(mode.value)}
                  className={`min-h-10 rounded-lg px-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
                    active
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "bg-card text-muted-foreground"
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 px-0.5 text-[12px] leading-snug text-muted-foreground">
            {timeModeNote}
            {!hasClock ? " Add a clock time to choose Fixed or Flexible." : ""}
          </p>
        </fieldset>

        <div className="mt-2.5">
          <span className={caption}>
            <MapPin className="size-3.5" aria-hidden />
            Place
          </span>
          <p
            className={`break-words rounded-xl border border-border bg-card px-2.5 py-1.5 text-[14px] leading-snug ${
              item.address ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {item.address || "No place yet"}
          </p>
          {stray && (
            <p className="mt-1 text-[14px] font-semibold text-destructive">
              ⚠ This pin is far from the rest of the trip, so it may be a different place with the
              same name. Use “Change place” to pick the right one.
            </p>
          )}
          <div className="@container mt-1.5 grid grid-cols-2 gap-1.5">
            <TimelinePlaceEditor
              item={item}
              {...(near ? { near } : {})}
              {...(center ? { center } : {})}
              buttonClassName={softButton}
              onPick={(place) => onUpdate(placePatchForSavedRow(place))}
            />
            {placed && (
              <a
                href={mapsPlaceUrl(item.title, item, item.address)}
                target="_blank"
                rel="noreferrer"
                className={lineButton}
              >
                <Send className="hidden size-4 shrink-0 @[17rem]:inline" aria-hidden />
                Open in Maps
              </a>
            )}
          </div>
        </div>

        <label className="mt-2.5 block">
          <span className={caption}>Notes</span>
          <span className="block rounded-xl border border-border bg-card px-2.5 py-1.5">
            {detailInput}
          </span>
        </label>
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

      {photos && <StopPhotos {...photos} />}

      {canEditInside && onInside && (
        <div className="mt-2">
          <InsideEditor entries={inside} onChange={onInside} />
        </div>
      )}

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

      {/* The same actions the swipe gives, and the rest, as rows. */}
      <div className="plain-card mt-3 divide-y divide-border overflow-hidden">
        <button
          type="button"
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
          className={actionRow}
        >
          <span
            className={`${actionBubble} bg-[color-mix(in_oklab,var(--nexttime)_15%,transparent)]`}
          >
            <Check className="size-5 text-nexttime" strokeWidth={done ? 3 : 2} aria-hidden />
          </span>
          <span className="flex-1">{done ? "Done · mark not done" : "Mark done"}</span>
        </button>
        {canKeep && (
          <button
            type="button"
            onClick={keep}
            disabled={kept}
            aria-label={kept ? "Saved to your places" : `Save ${item.title} to your places`}
            className={actionRow}
          >
            <span className={`${actionBubble} bg-primary-soft`}>
              <Bookmark
                className="size-5 text-primary"
                weight={kept ? "fill" : "regular"}
                aria-hidden
              />
            </span>
            <span className="flex-1">{kept ? "Saved to your places" : "Save to your places"}</span>
          </button>
        )}
        {canLocate && (
          <button
            type="button"
            onClick={onLocate}
            aria-label={`Locate ${item.title} on the map`}
            className={actionRow}
          >
            <span className={`${actionBubble} bg-elevated`}>
              <MapIcon className="size-5" aria-hidden />
            </span>
            <span className="flex-1">Show on the map</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        )}
        {canDirect && (
          <a
            href={mapsDirToUrl(item, near ?? "")}
            target="_blank"
            rel="noreferrer"
            aria-label={`Directions to ${item.title} in Maps`}
            className={actionRow}
          >
            <span className={`${actionBubble} bg-elevated`}>
              <Send className="size-5" aria-hidden />
            </span>
            <span className="flex-1">Directions</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </a>
        )}
        {onSaveBooking && (
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            aria-label={`Booking for ${item.title}`}
            className={actionRow}
          >
            <span className={`${actionBubble} bg-elevated`}>
              <Ticket className={`size-5 ${booked ? "text-nexttime" : ""}`} aria-hidden />
            </span>
            <span className="flex-1">{booked ? "Booking" : "Add a booking"}</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        )}
        {/* Dragging the grip reorders a day; editing every stop at once has
            no grip, so it keeps these. */}
        {onMove && editing && (
          <>
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onMove(-1)}
              aria-label={`Move ${item.title} earlier`}
              className={actionRow}
            >
              <span className={`${actionBubble} bg-elevated`}>
                <ChevronUp className="size-5" aria-hidden />
              </span>
              <span className="flex-1">Move earlier</span>
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onMove(1)}
              aria-label={`Move ${item.title} later`}
              className={actionRow}
            >
              <span className={`${actionBubble} bg-elevated`}>
                <ChevronDown className="size-5" aria-hidden />
              </span>
              <span className="flex-1">Move later</span>
            </button>
          </>
        )}
        {onMoveTo && (
          <button
            type="button"
            onClick={onMoveTo}
            aria-label={`Move ${item.title} to another day or place`}
            className={actionRow}
          >
            <span className={`${actionBubble} bg-elevated`}>
              <CalendarDays className="size-5" aria-hidden />
            </span>
            <span className="flex-1">Move to another day…</span>
            <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${item.title}`}
          className={`${actionRow} text-destructive`}
        >
          <span className={`${actionBubble} bg-destructive/10`}>
            <Trash2 className="size-5 text-destructive" aria-hidden />
          </span>
          <span className="flex-1">Delete stop</span>
        </button>
      </div>
    </>
  );

  const backSide = (
    <article className="card-flip rounded-2xl border-2 border-primary/30 bg-card p-3 shadow-sm">
      {backHeader}
      {backBody}
    </article>
  );

  return (
    <li
      id={`stop-${item.id}`}
      ref={liRef}
      style={liStyle}
      className="relative min-w-0 scroll-mt-16 list-none"
    >
      <div className={`grid gap-x-2 ${TIME_COLUMN}`}>
        {/* The hour, outside the card on the left, as the master draws the
            day. The stop's number is on its kind tile. An open card takes
            the whole width instead; its # says it. */}
        {!back && (
          <span
            aria-hidden
            className={`tabular-nums text-foreground ${folded ? "pt-3.5 text-[16px] leading-[1.4]" : "pt-4 text-[14px] font-semibold"}`}
          >
            {rail}
          </span>
        )}
        <div
          className={`relative min-w-0 ${back ? "z-20 col-span-2" : ""} ${parentTitle && !back ? "ml-5" : ""}`}
        >
          {parentTitle && !back ? (
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
              {folded ? compactRow : front}
            </SwipeRow>
          )}
          {!back && compact && expanded && (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="mt-0.5 px-1 text-[12px] font-semibold text-muted-foreground"
            >
              Less
            </button>
          )}
        </div>
      </div>
      {!editing && (
        <Sheet
          open={flipped}
          onClose={() => flip(false)}
          title={item.title}
          page
          tone={3}
          hint={[
            number != null ? `Stop ${number}` : "",
            item.day_date ? formatTimelineDayLabel(item.day_date) : "",
            rail,
            glyphChipLabel(timelineGlyph(item)),
            booked ? "Booked" : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        >
          {backBody}
          <button
            type="button"
            onClick={() => flip(false)}
            className="btn-primary mt-4 flex w-full items-center justify-center"
          >
            Done
          </button>
        </Sheet>
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
 * The kind as its chip, and a picker over it: tapping opens the stored kinds
 * by their chip names. The chip is what the front of the card shows.
 */
function KindPicker({
  item,
  onPick,
}: {
  item: Pick<ItineraryRow, "kind" | "title">;
  onPick: (kind: TimelineKind) => void;
}) {
  const value = normaliseKind(item.kind);
  return (
    <label className="relative inline-flex items-center gap-1">
      <KindChip item={item} className="min-h-8 pr-7 text-[13px]" />
      <ChevronDown
        className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground"
        aria-hidden
      />
      <select
        value={value}
        aria-label={`Kind of stop for ${item.title}`}
        onChange={(e) => onPick(e.target.value as TimelineKind)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {TIMELINE_KINDS.map((kind) => (
          <option key={kind} value={kind}>
            {kindChoiceLabel(kind)}
          </option>
        ))}
      </select>
    </label>
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
    "inline-flex min-h-7 items-center gap-1 rounded-full border border-primary/35 bg-primary/5 px-2.5 text-[12px] font-bold text-primary";
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
                <span className={entry.done ? "text-muted-foreground" : ""}>{entry.title}</span>
              </button>
              {entry.note || entry.address ? (
                <p className="-mt-1 mb-1 pl-6 text-[12px] leading-snug text-muted-foreground">
                  {entry.note ? <span className="block break-words">{entry.note}</span> : null}
                  {entry.address ? (
                    <a
                      href={mapsPlaceUrl(entry.title, null, entry.address)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-start gap-1 break-words underline decoration-dotted underline-offset-2"
                    >
                      <MapPin className="mt-px size-3 shrink-0" aria-hidden />
                      {entry.address}
                    </a>
                  ) : null}
                </p>
              ) : null}
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
  const [draftNote, setDraftNote] = useState("");
  const [draftAddress, setDraftAddress] = useState("");
  const fits = insideHasRoom(entries, draft, { note: draftNote, address: draftAddress });
  const add = () => {
    if (!fits) return;
    const next = addInside(entries, draft, { note: draftNote, address: draftAddress });
    if (next.length !== entries.length) onChange(next);
    setDraft("");
    setDraftNote("");
    setDraftAddress("");
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
              <span className="min-w-0">
                <span className={entry.done ? "text-muted-foreground" : ""}>
                  {entry.title}
                  {entry.done ? (
                    <Check
                      className="ms-1 inline-block size-3.5 align-[-2px] text-primary"
                      strokeWidth={3}
                      aria-hidden
                    />
                  ) : null}
                </span>
                {entry.note || entry.address ? (
                  <span className="block break-words text-[12px] text-muted-foreground">
                    {[entry.note, entry.address].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
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
        <div className="space-y-1">
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
              className="min-w-0 flex-1 rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[12.5px]"
            />
            <button
              type="button"
              onClick={add}
              disabled={!draft.trim() || !fits}
              className="rounded-lg border border-border bg-card px-2.5 text-[12px] font-semibold disabled:opacity-50"
            >
              Add
            </button>
          </div>
          {draft.trim() && !fits ? (
            <p role="alert" className="text-[14px] text-destructive">
              This list is full. Shorten the note or address, or remove an entry.
            </p>
          ) : null}
          {draft.trim() ? (
            <div className="grid grid-cols-1 gap-1 @[20rem]:grid-cols-2">
              <input
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder="What it's for (optional)"
                aria-label="Note for this entry"
                className="min-w-0 rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[12.5px]"
              />
              <input
                value={draftAddress}
                onChange={(e) => setDraftAddress(e.target.value)}
                placeholder="Address (optional)"
                aria-label="Address for this entry"
                className="min-w-0 rounded-lg border border-[var(--field-border)] bg-card px-2 py-1 text-[12.5px]"
              />
            </div>
          ) : null}
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
export function TimelinePlaceEditor({
  item,
  near,
  center,
  buttonClassName,
  onPick,
}: {
  item: ItineraryRow;
  near?: string | undefined;
  /** The middle of the trip, for chain and category searches. */
  center?: { lat: number; lon: number } | null | undefined;
  buttonClassName: string;
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
        className={buttonClassName}
      >
        <MapPinPlus className="hidden size-4 shrink-0 @[17rem]:inline" aria-hidden />
        {item.address ? "Change place" : "Set place"}
      </button>
    );

  return (
    <div className="col-span-2 w-full space-y-1.5">
      <PlaceSearchInput
        value={query}
        onChange={setQuery}
        onPick={(place) => {
          onPick(place);
          rememberPick(item.title, place);
          setOpen(false);
        }}
        placeholder={`Where is ${item.title}?`}
        {...(near ? { near } : {})}
        {...(center ? { center } : {})}
        stop={{ title: item.title, lat: item.lat, lon: item.lon }}
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

/**
 * The traveller's choice of place for a stop, remembered as their vote for
 * where that name is (resolved-places.ts). Never in the way: the stop is
 * already saved, and a failure is dropped.
 */
export function rememberPick(title: string, place: ParsedPlace) {
  if (place.lat == null || place.lon == null) return;
  const label = [place.name, place.address].filter(Boolean).join(", ").slice(0, 300);
  if (!title.trim() || !label) return;
  void rememberPlacePick({
    data: { name: title.slice(0, 300), lat: place.lat, lon: place.lon, label },
  }).catch(() => {});
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
    <textarea
      value={draft}
      rows={2}
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
      className="block w-full min-w-0 resize-none bg-transparent text-[14px] leading-snug text-foreground outline-none"
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
  fallbackMode,
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
  /** How the Maps link travels while no leg is measured: the traveller's choice, not always a walk. */
  fallbackMode?: RouteLeg["mode"] | undefined;
  area: string;
  /** The walk-times preference: off shows the destination and Maps only. */
  showTime?: boolean;
  /** Add a stop between these two. */
  onAddBetween?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const mode = leg?.mode ?? fallbackMode ?? "walking";
  const href = legMapsUrl(leg, to, area, mode);
  const isMeasured = Boolean(leg && leg.distance > 0);
  const leave = showTime && leg ? leaveBy(to.time_label, leg) : null;
  const steps = leg?.steps ?? [];
  const walking = mode === "walking";
  const how = walking ? "walk" : mode === "transit" ? "transit" : "drive";
  // A journey is a step between two stops, not a stop: one quiet 12px line
  // between the rows, so the rows stay the places and the line the travel.
  return (
    <li className="list-none">
      <div className={`grid gap-x-2 ${TIME_COLUMN}`}>
        <span aria-hidden />
        <div className="min-w-0">
          <div className="flex min-h-11 items-center gap-1.5">
            <div className="min-w-0 flex-1">
              {leg?.farApartKm ? (
                // One of the two pins is wrong; a drive between them would be
                // a confident answer to the wrong question.
                <p className="text-[14px] font-semibold text-destructive">
                  ⚠ {leg.farApartKm} km apart on the map on the same day — one of these stops is
                  probably in the wrong place. Tap it to check.
                </p>
              ) : (
                <p className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-muted-foreground">
                  {showTime && isMeasured && leg ? (
                    <>
                      <span className="whitespace-nowrap text-foreground">
                        {leg.estimated ? "~" : ""}
                        {prettyDuration(leg.duration)} {how}
                      </span>
                      <span className="whitespace-nowrap">· {prettyDistance(leg.distance)}</span>
                    </>
                  ) : (
                    <span className="whitespace-nowrap">
                      {showTime ? "Directions" : "Directions in Maps"}
                    </span>
                  )}
                  {leave?.kind === "time" && (
                    <span className="whitespace-nowrap font-semibold text-primary">
                      · Leave by {leave.at}
                    </span>
                  )}
                  <span className="sr-only">, to {to.title}</span>
                </p>
              )}
            </div>
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={`Directions from ${from.title} to ${to.title} in Maps`}
              title="Open in Maps"
              className="tap-44 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:text-primary"
            >
              <MapIcon className="size-[18px]" aria-hidden />
            </a>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-label={open ? "Hide directions" : "See directions"}
              className="tap-44 grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground"
            >
              <ChevronDown
                className={`size-[18px] transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
          </div>
          <div className={open ? "mb-1.5 overflow-hidden rounded-2xl bg-elevated" : "hidden"}>
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
                transit={mode === "transit"}
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
                          <span className="shrink-0 text-[12px] text-muted-foreground">
                            {prettyDistance(step.distance)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-[12.5px] text-muted-foreground">
                    {leg ? unroutedLegCopy(leg) : "Béa has not measured this walk yet"}. Open in
                    Maps for the full route, or save directions in the trip menu to see the steps
                    here.
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
                  {/* Maps knows the metro: which line, which stop to get on and
                    where to get off. A transit leg's own link already opens it. */}
                  {mode !== "transit" && (
                    <a
                      href={mapsDirToUrl(to, area, "transit")}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[12.5px] font-bold text-primary hover:underline"
                    >
                      <ExternalLink className="size-3.5" aria-hidden />
                      Public transport in Maps
                    </a>
                  )}
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
  transit = false,
  fromNumber,
}: {
  from: LatLon | null;
  to: LatLon | null;
  walking: boolean;
  transit?: boolean;
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
  const Mode = walking ? Footprints : transit ? Bus : Car;
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
