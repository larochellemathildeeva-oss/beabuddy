import { Check, MapPin } from "lucide-react";
import { Sheet } from "@/components/Sheet";
import { TimelinePlaceEditor } from "@/components/day/TimelineCard";
import type { ItineraryRow } from "@/hooks/useTrips";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import type { ParsedPlace } from "@/lib/places.functions";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";

/**
 * Behind the trip's "!": every stop whose place Béa was unsure of, with why,
 * to review one by one. "Looks right" approves the pin as it is; "Change
 * place" sets another. Either clears the stop's note, and it leaves the list.
 */
export function PinReviewSheet({
  open,
  onClose,
  stops,
  anchorsFor,
  onApprove,
  onChangePlace,
}: {
  open: boolean;
  onClose: () => void;
  /** The stops with a note to check, in timeline order (pinsToCheck). */
  stops: readonly ItineraryRow[];
  /** The search anchors for a stop's day, as the timeline's place editor takes them. */
  anchorsFor: (day: string | null) => {
    near?: string;
    center?: { lat: number; lon: number } | null;
  };
  onApprove: (item: ItineraryRow) => void;
  onChangePlace: (item: ItineraryRow, place: ParsedPlace) => void;
}) {
  const softButton =
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 text-[13px] font-semibold";
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Places to confirm"
      hint={
        stops.length
          ? `${stops.length} ${stops.length === 1 ? "stop" : "stops"} Béa was unsure of`
          : "Nothing left to check"
      }
      width="md"
    >
      {stops.length === 0 ? (
        <p className="px-1 py-6 text-center text-[14px] text-muted-foreground">
          Every stop's place is checked. The ! leaves the trip until an import brings a new one.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {stops.map((item) => {
            const placed = item.lat != null && item.lon != null;
            const when = [
              item.day_date ? formatTimelineDayLabel(item.day_date) : "",
              item.time_label ?? "",
            ]
              .filter(Boolean)
              .join(" · ");
            const anchors = anchorsFor(item.day_date);
            return (
              <li key={item.id} className="rounded-2xl border border-border bg-elevated p-3">
                {when ? <p className="text-[12px] text-muted-foreground">{when}</p> : null}
                <p className="break-words font-display text-[17px] leading-tight">{item.title}</p>
                <p className="mt-1 break-words text-[13px] leading-snug text-foreground">
                  {item.pin_check}
                </p>
                <p className="mt-1 flex items-start gap-1.5 break-words text-[12.5px] text-muted-foreground">
                  <MapPin className="mt-px size-3.5 shrink-0" aria-hidden />
                  {item.address || (placed ? "Pinned, no address" : "No place yet")}
                </p>
                <div className="@container mt-2 grid grid-cols-2 gap-1.5">
                  {placed ? (
                    <button
                      type="button"
                      onClick={() => onApprove(item)}
                      className={`${softButton} border-primary/40 bg-primary/10 text-primary`}
                    >
                      <Check className="size-4" aria-hidden />
                      Looks right
                    </button>
                  ) : null}
                  <TimelinePlaceEditor
                    item={item}
                    {...(anchors.near ? { near: anchors.near } : {})}
                    {...(anchors.center ? { center: anchors.center } : {})}
                    buttonClassName={softButton}
                    onPick={(place) => onChangePlace(item, place)}
                  />
                  {placed ? (
                    <a
                      href={mapsPlaceUrl(item.title, item, item.address)}
                      target="_blank"
                      rel="noreferrer"
                      className={`${softButton} col-span-2 text-muted-foreground`}
                    >
                      See the pin in Maps
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}
