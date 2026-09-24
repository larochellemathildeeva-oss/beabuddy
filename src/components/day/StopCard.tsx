import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { timeForRail } from "@/lib/timeline-kind";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { placed as hasPosition } from "@/lib/trip-map";
import { stayLabel } from "@/lib/planned-stay";
import type { ItineraryRow } from "@/hooks/useTrips";

/**
 * One stop, collapsed to what you need while walking.
 *
 * The timeline's existing row shows everything it has at once, which is the
 * right shape for editing a plan and the wrong one for reading it on a
 * street. A stop is time, name and roughly where — and the rest (the
 * confirmation number, the note, the address) is a tap away rather than in
 * the way.
 *
 * What is deliberately absent is as important as what is here. There is no
 * stay length, no per-stop cost and no "booked" tick, because
 * `itinerary_items` stores none of those. Rendering a placeholder for a
 * column that does not exist is how a screen starts lying about what it
 * knows.
 */
export function StopCard({
  item,
  index,
  onOpenPlace,
  selected = false,
  onSelect,
}: {
  item: ItineraryRow;
  /** Position within the day, for the numbered rail. */
  index: number;
  onOpenPlace?: ((item: ItineraryRow) => void) | undefined;
  /** Whether this is the stop the map is pointing at. */
  selected?: boolean;
  /**
   * Makes the top of the card a control that picks this stop on the map.
   * Only offered for a stop the map can show — selecting something with no
   * pin would move nothing and look broken.
   */
  onSelect?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const time = timeForRail(item.time_label);
  // A stop can be placed, or named, or neither. Each reads differently and
  // only the first can be pointed at on a map — decided by the map's own
  // rule, so a card never offers a pin the map declines to draw.
  const placed = hasPosition(item);
  const hasMore = Boolean(item.detail?.trim() || item.address?.trim());
  const selectable = placed && onSelect != null;

  // Spans throughout, because this sits inside a button when the card is
  // selectable and a button may only hold phrasing content.
  const summary = (
    <span className="flex items-start gap-3 p-3">
      <span className="flex w-11 shrink-0 flex-col items-center gap-1 pt-0.5">
        <span
          className={`text-[13px] font-bold tabular-nums leading-none ${
            time ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {/* An undated row says so rather than borrowing a neighbour's
              time, which is what an em dash in this column would do. */}
          {time || "–"}
        </span>
        <TimelineGlyphMark item={item} />
      </span>

      <span className="block min-w-0 flex-1">
        <span className="block break-words text-[15.5px] font-semibold leading-snug">
          {item.title}
        </span>
        {(item.address?.trim() || item.planned_stay_minutes) && (
          <span className="mt-0.5 block break-words text-[12.5px] leading-snug text-muted-foreground">
            {[
              item.address?.trim(),
              item.planned_stay_minutes ? `~${stayLabel(item.planned_stay_minutes)} stay` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
        {!placed && (
          <span className="mt-1 inline-flex items-center gap-1 rounded-lg bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
            <MapPin className="size-3" aria-hidden />
            Not on the map yet
          </span>
        )}
      </span>

      <span
        className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold tabular-nums ${
          selected ? "bg-primary text-primary-foreground" : "text-muted-foreground"
        }`}
      >
        {index + 1}
      </span>
    </span>
  );

  return (
    <article
      id={`stop-${item.id}`}
      className={`overflow-hidden rounded-2xl border bg-card transition-colors ${
        selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"
      }`}
    >
      {selectable ? (
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="block w-full text-left"
        >
          {summary}
          <span className="sr-only">Show on the map</span>
        </button>
      ) : (
        summary
      )}

      {hasMore && (
        <>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex min-h-11 w-full items-center justify-between gap-2 border-t border-border/60 px-3 text-left text-[12.5px] font-semibold text-muted-foreground"
          >
            <span>{open ? "Hide details" : "Details"}</span>
            <ChevronDown
              className={`size-4 transition-transform duration-(--t-shift) ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {open && (
            <div className="space-y-2 border-t border-border/60 bg-elevated/50 px-3 py-2.5">
              {item.detail?.trim() && (
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">
                  {item.detail}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={mapsPlaceUrl(item.title, { lat: item.lat, lon: item.lon })}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-[13px] font-semibold"
                >
                  <MapPin className="size-3.5" aria-hidden />
                  Open in maps
                </a>
                {onOpenPlace && (
                  <button
                    type="button"
                    onClick={() => onOpenPlace(item)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-border px-3 text-[13px] font-semibold"
                  >
                    {placed ? "Change place" : "Find this place"}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </article>
  );
}
