import type { ReactNode } from "react";
import {
  Bed,
  Car,
  Footprints,
  Landmark,
  Plane,
  Sparkles,
  StickyNote,
  Utensils,
} from "@/components/icons";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isBooked } from "@/lib/bookings";
import { seqClass, stopArtUrl } from "@/components/day/stop-words";
import { glyphLabel, timelineGlyph, type TimelineGlyph } from "@/lib/timeline-kind";

const GLYPH_ICON: Record<TimelineGlyph, typeof Bed> = {
  meal: Utensils,
  lodging: Bed,
  transport: Plane,
  sight: Landmark,
  walk: Footprints,
  note: StickyNote,
  activity: Sparkles,
};

/**
 * Small pieces the day views share — Companion, Map and Timeline — so a stop
 * reads the same wherever it appears: its painted picture, its kind as a
 * chip, the numbered disc, a leg as "9 min walk · 426 m", and Béa's bubble.
 */

export function StopArt({
  item,
  className,
}: {
  item: { kind?: string | null; title?: string | null };
  className: string;
}) {
  return (
    <img
      src={stopArtUrl(item)}
      alt=""
      loading="lazy"
      className={`art-dim shrink-0 object-cover ${className}`}
    />
  );
}

export function StopDisc({
  number,
  className = "size-7 text-[12.5px]",
  done = false,
}: {
  number: number;
  className?: string;
  done?: boolean;
}) {
  return (
    <span
      className={`${seqClass(number)} grid shrink-0 place-items-center rounded-full font-bold tabular-nums ring-2 ring-background ${
        done ? "opacity-60" : ""
      } ${className}`}
    >
      {number}
    </span>
  );
}

/**
 * The stop's kind as a chip — the app keeps one kind per stop — and Booked
 * when it is. Small pastel pills, as in the master.
 */
export function StopChips({
  item,
  extra,
}: {
  item: Pick<ItineraryRow, "kind" | "title" | "booked">;
  extra?: ReactNode;
}) {
  const glyph = timelineGlyph(item);
  const Icon = GLYPH_ICON[glyph];
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="tile-fill-2 inline-flex items-center gap-1 rounded-full border border-border/60 px-2 py-0.5 text-[11.5px] font-medium">
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        {glyphLabel(glyph)}
      </span>
      {isBooked(item) && (
        <span className="tile-fill-3 rounded-full border border-border/60 px-2 py-0.5 text-[11.5px] font-semibold text-nexttime">
          Booked
        </span>
      )}
      {extra}
    </span>
  );
}

export function LegIcon({
  walking,
  className = "size-4",
}: {
  walking: boolean;
  className?: string;
}) {
  return walking ? (
    <Footprints className={className} aria-hidden />
  ) : (
    <Car className={className} aria-hidden />
  );
}

/** Béa's bubble, with her small face. The line is always third person. */
export function BeaSays({ line, className = "" }: { line: string; className?: string }) {
  return (
    <div className={`flex items-start gap-2.5 ${className}`}>
      <img
        src="/bea/bea-think-static.png"
        alt=""
        className="size-11 shrink-0 rounded-full border border-border bg-card object-cover"
      />
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-md bg-primary-soft px-3 py-2">
        <p className="text-[12.5px] font-bold text-primary">Béa says:</p>
        <p className="text-[13.5px] leading-snug">{line}</p>
      </div>
    </div>
  );
}
