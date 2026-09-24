import { useEffect, useState } from "react";
import {
  Bookmark,
  Car,
  Check,
  ChevronDown,
  ChevronUp,
  Footprints,
  MapPinPlus,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PlaceSearchInput } from "@/components/PlaceSearchInput";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { SwipeRow } from "@/components/day/SwipeRow";
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
 * One stop on the Day tab, as a card.
 *
 * The prototype's card shape — time and number down the left, name, note and
 * a mid-dotted line of address, stay and map — over every control the row
 * had before: the name and note still edit in place (tap them), edit mode
 * still opens day, time, stay, order and place for the whole list at once,
 * and Remove and "Save to my places" are where they were. Swiping right
 * marks the stop done, left offers Save and Delete; each also has a button.
 * Shared by the by-day and flat lists so rows stay keyed to the same id.
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
}) {
  const [kept, setKept] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDetail, setEditingDetail] = useState(false);
  const [editingTime, setEditingTime] = useState(false);
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
      autoFocus={editingTitle}
      onFocus={() => onEdit(item.title)}
      onBlur={(e) => {
        onEdit(null);
        setEditingTitle(false);
        if (e.target.value.trim() && e.target.value !== item.title)
          onUpdate({ title: e.target.value.trim() });
      }}
      className="w-full min-w-0 rounded-md bg-transparent text-[15.5px] font-semibold leading-snug outline-none focus:bg-elevated"
    />
  );

  const detailInput = (
    <TimelineDetailInput
      detail={item.detail}
      autoFocus={editingDetail}
      onFocus={() => onEdit(item.title)}
      onCommit={(next) => {
        onEdit(null);
        setEditingDetail(false);
        const prev = stripEmbeddedMapsUrl(item.detail);
        if (next !== prev) onUpdate({ detail: next || null });
      }}
    />
  );

  // Unboxed, mid-dotted: where it is, how long it takes, and a way to it.
  const meta = [
    item.address ? `📍 ${item.address}` : "",
    item.planned_stay_minutes ? `~${stayLabel(item.planned_stay_minutes)} stay` : "",
  ].filter(Boolean);

  return (
    <li className="relative flex min-w-0 list-none items-stretch gap-1.5">
      {/* The prototype's reorder column, always to hand rather than only in
          edit mode. Swaps with the neighbour on the same day. */}
      {onMove && !editing && (
        <div className="flex shrink-0 flex-col justify-center gap-1 rounded-2xl border border-border bg-card px-0.5 py-1">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={() => onMove(-1)}
            aria-label={`Move ${item.title} earlier`}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground disabled:opacity-25"
          >
            <ChevronUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => onMove(1)}
            aria-label={`Move ${item.title} later`}
            className="grid size-8 place-items-center rounded-lg text-muted-foreground disabled:opacity-25"
          >
            <ChevronDown className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <SwipeRow
          done={done}
          disabled={editing}
          onToggleDone={onToggleDone}
          onSave={canKeep && !kept ? keep : undefined}
          onDelete={onRemove}
        >
          <article
            className={`rounded-2xl border bg-card p-3 ${
              done ? "border-nexttime/40" : "border-border/70"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-1">
              {/* One top row: time, number and kind on the left, the
                  actions on the right, so the name below gets the full
                  width of the card. */}
              <div className="flex min-w-0 items-center gap-2">
                {/* Tap the time to change it, as in the prototype's editor. */}
                {editingTime ? (
                  <input
                    type="time"
                    autoFocus
                    defaultValue={rail}
                    aria-label={`Time for ${item.title}`}
                    onBlur={(e) => {
                      setEditingTime(false);
                      if (e.target.value !== rail) onUpdate({ time_label: e.target.value || null });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setEditingTime(false);
                    }}
                    className="w-[4.5rem] rounded-md border border-border bg-elevated px-1 text-[13px] font-bold tabular-nums"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingTime(true)}
                    aria-label={rail ? `${rail} — change the time` : "Set a time"}
                    className={`rounded-md text-left text-[13.5px] font-bold tabular-nums ${rail ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {rail || "–"}
                  </button>
                )}
                {number != null && (
                  <span className="rounded-md bg-elevated px-1.5 text-[11px] font-semibold tabular-nums text-muted-foreground">
                    #{number}
                  </span>
                )}
                <TimelineGlyphMark item={item} />
                {/* Done, save and delete, top right, as in the prototype. The
                    same three the swipe gives. */}
                {!editing && (
                  <div className="-my-1 -mr-1 ml-auto flex shrink-0 items-center">
                    <button
                      type="button"
                      onClick={onToggleDone}
                      aria-pressed={done}
                      aria-label={done ? `Mark ${item.title} not done` : `Mark ${item.title} done`}
                      className={`grid size-8 place-items-center rounded-lg ${done ? "bg-nexttime/15 text-nexttime" : "text-muted-foreground"}`}
                    >
                      <Check className="size-4" strokeWidth={done ? 3 : 2} aria-hidden />
                    </button>
                    {canKeep && (
                      <button
                        type="button"
                        onClick={keep}
                        disabled={kept}
                        aria-label={
                          kept ? "Saved to your places" : `Save ${item.title} to your places`
                        }
                        title={kept ? "Saved to your places" : "Save to my places"}
                        className={`grid size-8 place-items-center rounded-lg ${kept ? "text-primary" : "text-muted-foreground"}`}
                      >
                        <Bookmark
                          className="size-4"
                          fill={kept ? "currentColor" : "none"}
                          aria-hidden
                        />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onRemove}
                      aria-label={`Delete ${item.title}`}
                      className="grid size-8 place-items-center rounded-lg text-muted-foreground"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                {showDay && item.day_date ? (
                  <p className="text-[12px] text-muted-foreground">{item.day_date}</p>
                ) : null}
                <div className="flex min-w-0 items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {editing || editingTitle ? (
                      titleInput
                    ) : (
                      <button
                        type="button"
                        onClick={() => setEditingTitle(true)}
                        aria-label={`${item.title} — edit the name`}
                        className={`block w-full min-w-0 break-words text-left text-[15.5px] font-semibold leading-snug ${
                          done ? "text-muted-foreground line-through" : ""
                        }`}
                      >
                        {item.title}
                      </button>
                    )}
                  </div>
                </div>
                {done && (
                  <span className="mt-0.5 inline-block rounded-full bg-nexttime/15 px-2 py-0.5 text-[11px] font-bold text-nexttime">
                    Done
                  </span>
                )}

                {editing || editingDetail ? (
                  detailInput
                ) : detail ? (
                  <button
                    type="button"
                    onClick={() => setEditingDetail(true)}
                    aria-label="Edit the note"
                    className="mt-0.5 block w-full min-w-0 break-words text-left text-[13px] text-muted-foreground"
                  >
                    {detail}
                  </button>
                ) : null}

                {(meta.length > 0 || (item.lat != null && item.lon != null)) && (
                  <p className="mt-1 break-words text-[12.5px] text-muted-foreground">
                    {meta.join(" · ")}
                    {item.lat != null && item.lon != null && (
                      <>
                        {meta.length > 0 ? " · " : ""}
                        <a
                          href={mapsPlaceUrl(item.title, item)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary underline"
                        >
                          Map
                        </a>
                      </>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/**
             * Changing an entry after it is saved.
             *
             * These open for the whole list at once, from the pencil in the
             * section header, rather than per row: reordering a day means
             * comparing rows, and a mode you turn on once beats opening and
             * closing each entry in turn. The arrows swap position with the
             * neighbour on the same day, and hide at the ends of one, because
             * rows sort by day first and a cross-day swap would move nothing.
             */}
            {editing && (
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
                {/* How long the plan allows here. Now counts it down once you
                  tap "I'm here"; left empty, Now only says how long it has been. */}
                <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  Stay
                  <select
                    value={item.planned_stay_minutes ?? ""}
                    aria-label={`How long to stay at ${item.title}`}
                    onChange={(e) =>
                      onUpdate({ planned_stay_minutes: parseStayChoice(e.target.value) })
                    }
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
                {onMove && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!canMoveUp}
                      onClick={() => onMove(-1)}
                      aria-label={`Move ${item.title} earlier`}
                      className="tap-44 grid size-7 place-items-center rounded-lg border border-border disabled:opacity-30"
                    >
                      <ChevronUp className="size-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      disabled={!canMoveDown}
                      onClick={() => onMove(1)}
                      aria-label={`Move ${item.title} later`}
                      className="tap-44 grid size-7 place-items-center rounded-lg border border-border disabled:opacity-30"
                    >
                      <ChevronDown className="size-3.5" aria-hidden />
                    </button>
                  </div>
                )}
                <TimelinePlaceEditor
                  item={item}
                  {...(near ? { near } : {})}
                  onPick={(place) => onUpdate(placePatchForSavedRow(place))}
                />
              </div>
            )}

            {/* The same actions the swipe gives, for a mouse or a keyboard. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              {!editing && !detail && !editingDetail && (
                <button
                  type="button"
                  onClick={() => setEditingDetail(true)}
                  className="min-h-8 text-[12px] text-muted-foreground underline"
                >
                  Add a note
                </button>
              )}
              {editing && (
                <button
                  type="button"
                  onClick={onRemove}
                  className="min-h-8 text-[12px] text-muted-foreground underline"
                >
                  Remove
                </button>
              )}
            </div>
            {!editing && (
              <p className="mt-1 flex justify-between gap-2 text-[10.5px] text-muted-foreground/70">
                <span>👉 Swipe right to complete</span>
                <span>Swipe left to save or delete 👈</span>
              </p>
            )}
          </article>
        </SwipeRow>
      </div>
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
      <div className="flex flex-col items-center">
        <span aria-hidden className="h-2.5 w-0.5 bg-border" />
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[12.5px] font-semibold shadow-sm"
        >
          <span className="grid size-5 place-items-center rounded-full border border-primary/30 bg-primary/10 text-primary">
            <Plus className="size-3.5" aria-hidden />
          </span>
          Add stop between
        </button>
        <span aria-hidden className="h-2.5 w-0.5 bg-border" />
      </div>
    </li>
  );
}
