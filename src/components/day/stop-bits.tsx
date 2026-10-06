import type { ReactNode } from "react";
import {
  Bed,
  Bus,
  Car,
  Footprints,
  Landmark,
  Plant,
  Plane,
  Sparkles,
  StickyNote,
  Utensils,
} from "@/components/icons";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isBooked } from "@/lib/bookings";
import { PlacePicture } from "@/components/PlacePicture";
import { seqClass } from "@/components/day/stop-words";
import type { LegMode } from "@/lib/travel-mode";
import { glyphChipLabel, timelineGlyph, type TimelineGlyph } from "@/lib/timeline-kind";

const GLYPH_ICON: Record<TimelineGlyph, typeof Bed> = {
  meal: Utensils,
  lodging: Bed,
  transport: Plane,
  sight: Landmark,
  walk: Plant,
  note: StickyNote,
  activity: Sparkles,
};

/**
 * Small pieces the day views share — Companion, Map and Timeline — so a stop
 * reads the same wherever it appears: its picture, its kind as a
 * chip, the numbered disc, a leg as "9 min walk · 426 m", and Béa's bubble.
 */

export function StopArt({
  item,
  className,
}: {
  item: {
    kind?: string | null;
    title?: string | null;
    lat?: number | null;
    lon?: number | null;
  };
  className: string;
}) {
  return (
    <PlacePicture
      name={item.title}
      kind={item.kind}
      lat={item.lat}
      lon={item.lon}
      className={`shrink-0 ${className}`}
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

/** The stop's kind as its icon alone, in the chip's colour where it sits. */
export function KindIcon({
  item,
  className = "size-4",
}: {
  item: { kind?: string | null; title?: string | null };
  className?: string;
}) {
  const Icon = GLYPH_ICON[timelineGlyph(item)];
  return <Icon className={className} aria-hidden />;
}

/**
 * The stop's kind as a chip, tinted by kind (`.kind-chip` in styles.css):
 * food orange, culture violet, nature green. The app keeps one kind per stop.
 */
export function KindChip({
  item,
  className = "",
}: {
  item: { kind?: string | null; title?: string | null };
  className?: string;
}) {
  const glyph = timelineGlyph(item);
  const Icon = GLYPH_ICON[glyph];
  return (
    <span
      className={`kind-chip kind-${glyph} inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {glyphChipLabel(glyph)}
    </span>
  );
}

/**
 * The stop's kind as a chip, and Booked when it is. `before` sits ahead of
 * them on the same line (the timeline card puts the stay there).
 */
export function StopChips({
  item,
  extra,
  before,
}: {
  item: Pick<ItineraryRow, "kind" | "title" | "booked">;
  extra?: ReactNode;
  before?: ReactNode;
}) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
      {before}
      <KindChip item={item} />
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
  mode,
  className = "size-4",
}: {
  walking: boolean;
  /** Transit draws a bus; otherwise `walking` picks feet or a car. */
  mode?: LegMode | undefined;
  className?: string;
}) {
  if (mode === "transit") return <Bus className={className} aria-hidden />;
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
      <div className="relative min-w-0 flex-1 rounded-2xl rounded-tl-md border border-border bg-secondary px-3 py-2">
        <p className="text-[13px] font-bold text-muted-foreground">Béa says:</p>
        <p className="text-[16px] leading-snug">{line}</p>
      </div>
    </div>
  );
}
