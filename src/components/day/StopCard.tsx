import { useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { TimelineGlyphMark } from "@/components/TimelineGlyph";
import { timeForRail } from "@/lib/timeline-kind";
import { mapsPlaceUrl } from "@/lib/direction-stops";
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
}: {
  item: ItineraryRow;
  /** Position within the day, for the numbered rail. */
  index: number;
  onOpenPlace?: ((item: ItineraryRow) => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  const time = timeForRail(item.time_label);
  // A stop can be placed, or named, or neither. Each reads differently and
  // only the first can be pointed at on a map.
  const placed = item.lat != null && item.lon != null;
  const hasMore = Boolean(item.detail?.trim() || item.address?.trim());

  return (
    <article className="overflow-hidden rounded-2xl border border-border/70 bg-card">
      <div className="flex items-start gap-3 p-3">
        <div className="flex w-11 shrink-0 flex-col items-center gap-1 pt-0.5">
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
        </div>

        <div className="min-w-0 flex-1">
          <p className="break-words text-[15.5px] font-semibold leading-snug">{item.title}</p>
          {item.address?.trim() && (
            <p className="mt-0.5 break-words text-[12.5px] leading-snug text-muted-foreground">
              {item.address}
            </p>
          )}
          {!placed && (
            <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-elevated px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              <MapPin className="size-3" aria-hidden />
              Not on the map yet
            </p>
          )}
        </div>

        <span className="shrink-0 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          {index + 1}
        </span>
      </div>

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
