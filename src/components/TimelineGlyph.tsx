import { Bed, Footprints, Landmark, Plane, StickyNote, Sparkles, Utensils } from "lucide-react";
import { glyphLabel, timelineGlyph, type TimelineGlyph as Glyph } from "@/lib/timeline-kind";

const ICONS: Record<Glyph, typeof Bed> = {
  meal: Utensils,
  lodging: Bed,
  transport: Plane,
  sight: Landmark,
  walk: Footprints,
  note: StickyNote,
  activity: Sparkles,
};

/**
 * The mark on the timeline spine.
 *
 * One accent colour, not one per kind: the reference apps use five hues and it
 * reads as a dashboard. Here the shape carries the meaning and the colour
 * stays Béa's, held back so a long day does not turn into bunting.
 */
export function TimelineGlyphMark({
  item,
}: {
  item: { kind?: string | null; title?: string | null };
}) {
  const glyph = timelineGlyph(item);
  const Icon = ICONS[glyph];
  return (
    <span
      title={glyphLabel(glyph)}
      className="grid size-7 shrink-0 place-items-center rounded-full bg-primary-soft text-primary/85"
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{glyphLabel(glyph)}</span>
    </span>
  );
}
