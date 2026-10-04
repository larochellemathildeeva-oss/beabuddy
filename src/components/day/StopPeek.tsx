import { ExternalLink, X } from "@/components/icons";
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
  /** Open the Timeline, where the stop can be changed. */
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
      className="rounded-2xl border border-primary/30 bg-primary-soft p-4 text-foreground shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Stop {number}
          {time ? ` · ${time}` : ""}
          {current ? " · you are here" : isDone(stop) ? " · done" : ""}
        </p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Back to now"
          className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[16px] font-semibold text-foreground"
        >
          <X className="size-4" aria-hidden />
          Back to now
        </button>
      </div>
      <h3 className="mt-1 break-words font-display text-[22px] leading-tight">{stop.title}</h3>
      {detail ? <p className="mt-1 text-[16px] leading-snug text-foreground">{detail}</p> : null}
      {stop.inside && stop.inside.length > 0 ? (
        <p className="mt-1 text-[14px] leading-snug text-muted-foreground">
          Inside:{" "}
          {stop.inside.map((entry) => `${entry.done ? "✓ " : ""}${entry.title}`).join(" · ")}
        </p>
      ) : null}
      {where.length > 0 && (
        <p className="mt-1 text-[14px] text-muted-foreground">{where.join(" · ")}</p>
      )}
      {isBooked(stop) && (
        <p className="mt-1 text-[14px] font-semibold text-nexttime">
          Booked{stop.booking_ref ? ` · ${stop.booking_ref}` : ""}
          {stop.booking_details ? (
            <span className="mt-0.5 block whitespace-pre-line font-normal text-foreground">
              {stop.booking_details}
            </span>
          ) : null}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <a
          href={recMapsUrl({
            name: stop.title,
            address: stop.address,
            lat: stop.lat,
            lon: stop.lon,
          })}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-card px-4 text-[16px] font-semibold text-foreground"
        >
          <ExternalLink className="size-4" aria-hidden />
          Open in Maps
        </a>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 items-center rounded-full bg-card px-4 text-[16px] font-semibold text-foreground"
        >
          Edit in Timeline
        </button>
      </div>
    </section>
  );
}
