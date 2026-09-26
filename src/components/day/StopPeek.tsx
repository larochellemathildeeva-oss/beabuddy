import { ExternalLink, X } from "lucide-react";
import type { ItineraryRow } from "@/hooks/useTrips";
import { isBooked } from "@/lib/bookings";
import { isDone } from "@/lib/companion";
import { recMapsUrl } from "@/lib/reco-open";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail } from "@/lib/timeline-kind";
import { stripEmbeddedMapsUrl } from "@/lib/timeline-directions";

/**
 * One stop, looked at: what a tap on the ribbon or the tracker opens.
 *
 * Looking is not moving. Now and Next stay where "I'm here" and "Leaving"
 * put them; this only shows the stop you tapped — its time, note, place and
 * booking, a way to open it in Maps and a way to edit it — until you close
 * it or tap it again.
 */
export function StopPeek({
  stop,
  number,
  onClose,
  onEdit,
}: {
  stop: ItineraryRow;
  number: number;
  onClose: () => void;
  /** Open the Timeline Editor, where the stop can be changed. */
  onEdit: () => void;
}) {
  const time = timeForRail(stop.time_label);
  const detail = stripEmbeddedMapsUrl(stop.detail);
  const where = [
    stop.address,
    stop.planned_stay_minutes ? `~${stayLabel(stop.planned_stay_minutes)} stay` : "",
  ].filter(Boolean);
  const current = Boolean(stop.arrived_at) && !stop.left_at;
  return (
    <section
      aria-label={`Stop ${number}: ${stop.title}`}
      className="rounded-2xl border border-primary/30 bg-card p-3.5 shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11.5px] font-bold uppercase tracking-wider text-muted-foreground">
          Stop {number}
          {time ? ` · ${time}` : ""}
          {current ? " · you are here" : isDone(stop) ? " · done" : ""}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to now"
          className="-mr-1 -mt-1 inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-muted-foreground"
        >
          <X className="size-3.5" aria-hidden />
          Back to now
        </button>
      </div>
      <h3 className="mt-0.5 break-words font-display text-[21px] leading-tight">{stop.title}</h3>
      {detail ? <p className="mt-1 text-[13.5px] text-muted-foreground">{detail}</p> : null}
      {stop.inside && stop.inside.length > 0 ? (
        <p className="mt-1 text-[13px] text-muted-foreground">
          Inside:{" "}
          {stop.inside.map((entry) => `${entry.done ? "✓ " : ""}${entry.title}`).join(" · ")}
        </p>
      ) : null}
      {where.length > 0 && (
        <p className="mt-1 text-[12.5px] text-muted-foreground">{where.join(" · ")}</p>
      )}
      {isBooked(stop) && (
        <p className="mt-1 text-[12.5px] font-semibold text-nexttime">
          ✓ Booked{stop.booking_ref ? ` · ${stop.booking_ref}` : ""}
          {stop.booking_details ? (
            <span className="block whitespace-pre-line font-normal text-foreground/80">
              {stop.booking_details}
            </span>
          ) : null}
        </p>
      )}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <a
          href={recMapsUrl({
            name: stop.title,
            address: stop.address,
            lat: stop.lat,
            lon: stop.lon,
          })}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 items-center gap-1.5 rounded-xl border border-border px-3 text-[12.5px] font-semibold text-nexttime"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          Open in Maps
        </a>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-9 items-center rounded-xl border border-border px-3 text-[12.5px] font-semibold text-muted-foreground"
        >
          Edit in Timeline Editor
        </button>
      </div>
    </section>
  );
}
