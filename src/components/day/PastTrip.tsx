import { Link } from "@tanstack/react-router";
import { useFutureNotes, cityKey } from "@/hooks/useFutureNotes";
import { formatTripLocation } from "@/lib/place-label";
import { ChevronLeft } from "@/components/icons";

/**
 * A trip that is over, as the Figma "A trip to remember" frame draws it: what
 * the trip holds for remembering, in four cards, and two doors back into it.
 */
export function PastTripTop({ country, dates }: { country: string | null; dates: string }) {
  return (
    <div className="space-y-3">
      <div>
        <Link to="/trips" className="text-[12px] text-muted-foreground">
          <ChevronLeft className="inline size-3.5 align-[-2px]" aria-hidden /> Trips · Past
        </Link>
        <h1 className="mt-2 text-[32px] font-bold leading-[1.1]">A trip to remember</h1>
      </div>
      <section className="fr-note">
        <p className="text-[13px] font-semibold">Completed trip</p>
        <p className="mt-2 text-[13px]">
          {[country, dates].filter(Boolean).join(" · ")}. Revisit the plan, collect memories or use
          it to plan another trip.
        </p>
      </section>
    </div>
  );
}

export function PastTripCards({
  city,
  country,
  onImportPhotos,
  onRevisit,
  onAgain,
}: {
  city: string | null;
  country: string | null;
  onImportPhotos: () => void;
  onRevisit: () => void;
  onAgain: () => void;
}) {
  const notes = useFutureNotes();
  const place = city?.split(",")[0]?.trim() ?? "";
  const note = place ? notes.rows.find((n) => cityKey(n.city) === cityKey(place)) : undefined;
  const where = formatTripLocation(place, country);
  return (
    <div className="space-y-3">
      <section className="fd-box">
        <h2 className="text-[18px] font-semibold">Trip photos</h2>
        <p className="mt-2 text-[13px]">
          Your itinerary is here. Your photos are not imported automatically.
        </p>
        <button type="button" onClick={onImportPhotos} className="tm-close mt-3 !bg-card">
          Import photos
        </button>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Choose photos yourself. Review locations before saving; keep photos or locations only.
          Nothing is shared without your choice.
        </p>
      </section>

      {place ? (
        <section className="fd-box">
          <h2 className="text-[18px] font-semibold">{place} · city memories</h2>
          <p className="mt-2 text-[13px]">
            Link moments from this {country ?? ""} trip to {place} in World. City memories stay
            connected to this trip.
          </p>
          <Link to="/memories" className="tm-close mt-3 flex items-center justify-center !bg-card">
            Open {place} city memories
          </Link>
        </section>
      ) : null}

      {place ? (
        <section className="fd-box">
          <h2 className="text-[18px] font-semibold">Future Me · {place}</h2>
          <p className="mt-2 text-[13px]">
            {note
              ? note.note
              : "No note written for this trip yet. Keep what you'd do again, skip or remember next time."}
          </p>
          <Link to="/memories" className="tm-close mt-3 flex items-center justify-center !bg-card">
            {note ? "Open your Future Me note" : "Write a Future Me note"}
          </Link>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Keep this note linked to {where || place} for next time.
          </p>
        </section>
      ) : null}

      <button type="button" onClick={onRevisit} className="tm-close !bg-card">
        Revisit this trip&apos;s Timeline
      </button>
      <button type="button" onClick={onAgain} className="tm-close">
        Plan again · copy to new dates
      </button>
      <p className="px-1 text-[12px] text-muted-foreground">
        Copying opens a new plan for review. This completed trip stays unchanged.
      </p>
    </div>
  );
}
