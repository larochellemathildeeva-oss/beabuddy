import { useSignedPhoto, type TripPhotoRow } from "@/hooks/useTripPhotos";
import { TripMap } from "@/components/TripMap";
import {
  countdownLabel,
  fallbackTint,
  isUnderway,
  photoCreditLine,
  tripDateLine,
  tripLengthLabel,
  tripMonogram,
  tripPlacesLine,
} from "@/lib/trip-card";

/**
 * The top of a trip card: your own photo of the place, the title over it, and
 * how soon it is.
 *
 * The photo is the point. Other travel apps put stock destination photography
 * here; Béa has something better sitting in photo_memories, so a trip to Kyoto
 * shows the Kyoto you already saw. Somewhere new gets a quiet tint instead —
 * quiet on purpose, because it is a placeholder waiting for a photograph, not
 * a colour swatch asking to be looked at.
 */
export function TripBanner({
  title,
  city,
  country,
  cities,
  startDate,
  endDate,
  tentative,
  photo,
  companions,
  stops = [],
  note,
  viewTransitionName,
}: {
  title: string;
  city?: string | null;
  country?: string | null;
  cities: string[];
  startDate?: string | null;
  endDate?: string | null;
  tentative?: boolean;
  photo: TripPhotoRow | null;
  companions?: string;
  /**
   * The trip's stops, for the map that stands in for a photograph. Passing
   * none simply falls back to the monogram, as before.
   */
  stops?: { title: string; lat?: number | null | undefined; lon?: number | null | undefined }[];
  /** Béa's line about this trip, when she has one worth saying. */
  note?: string | null;
  /**
   * Names this banner for a cross-document-free view transition. The card in
   * the list and the page it opens pass the same name, and the browser tweens
   * the photograph between them instead of cutting.
   *
   * It must be unique within the document: two banners sharing a name silently
   * disables the transition for both, which is why it is keyed by trip id and
   * never by anything a second trip could also be.
   */
  viewTransitionName?: string | undefined;
}) {
  const url = useSignedPhoto(photo?.storage_path ?? null);
  const tint = fallbackTint(title || city || "Béa");
  const soon = countdownLabel(startDate);
  const now = isUnderway(startDate, endDate);
  const where = tripPlacesLine(cities, [city, country].filter(Boolean).join(", "));
  const length = tripLengthLabel(startDate, endDate);

  // Three short lines beat one long one: at phone width a single joined line
  // truncated the dates away, which is the part the card exists to tell you.
  const placeLine = [where, length].filter(Boolean).join(" · ");
  const whenLine = [tripDateLine(startDate, endDate), companions].filter(Boolean).join(" · ");

  const pill = now ? "Underway" : soon ? soon : tentative ? "Tentative" : "";
  // Only worth drawing a map when there is something on it.
  const hasPlacedStop = stops.some(
    (stop) => typeof stop.lat === "number" && typeof stop.lon === "number",
  );

  if (!url) {
    return (
      <div
        className="relative h-[136px] w-full overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(150deg, ${tint.from}, ${tint.to})`,
          ...(viewTransitionName ? { viewTransitionName } : {}),
        }}
      >
        {/**
         * A photograph if there is one, the trip's own shape if not, and only
         * then a letter.
         *
         * The monogram was the largest thing on the card and said the least —
         * one character of the title, in the most valuable space there is. A
         * map of the actual stops says where you are going, costs no request
         * and no provider, and is drawn from the same bundled topology the
         * globe uses. It stays faint: this is a backdrop, not the subject.
         */}
        {hasPlacedStop ? (
          <span
            aria-hidden
            className="pointer-events-none absolute right-2 top-1/2 w-[44%] -translate-y-1/2 opacity-30"
          >
            <TripMap stops={stops} compact />
          </span>
        ) : (
          <span
            aria-hidden
            className="absolute right-3 top-1 font-display text-[92px] leading-none text-foreground/10"
          >
            {tripMonogram(title, city)}
          </span>
        )}
        <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-[21px] leading-tight">{title}</p>
            <p className="truncate text-[12.5px] text-foreground/70">{placeLine}</p>
            <p className="truncate text-[12.5px] text-foreground/60">{whenLine}</p>
            {note ? (
              <p className="mt-1 line-clamp-2 text-[12.5px] text-foreground/75">{note}</p>
            ) : null}
          </div>
          {pill ? (
            <span className="shrink-0 rounded-full border border-foreground/25 bg-card/70 px-2.5 py-1 text-[11.5px] font-semibold">
              {pill}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative h-[136px] w-full overflow-hidden"
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      {/* eager, not lazy: a transition cannot tween an image the browser has
          not decoded yet, and it would land as a grey box that fills in after. */}
      <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      {/* Dark at the bottom only, so the title stays legible over any
          photograph while the top of the picture stays the picture. */}
      <span
        aria-hidden
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to top, rgba(23,16,12,0.80), rgba(23,16,12,0.28) 45%, rgba(23,16,12,0.02) 78%)",
        }}
      />
      <div className="absolute inset-x-0 bottom-0 flex items-end gap-2 p-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-[21px] leading-tight text-white">{title}</p>
          <p className="truncate text-[12.5px] text-white/80">{placeLine}</p>
          <p className="truncate text-[12.5px] text-white/70">{whenLine}</p>
          {note ? <p className="mt-1 line-clamp-2 text-[12.5px] text-white/80">{note}</p> : null}
        </div>
        {pill ? (
          <span className="shrink-0 rounded-full bg-white/85 px-2.5 py-1 text-[11.5px] font-semibold text-foreground">
            {pill}
          </span>
        ) : null}
      </div>
      {photo ? (
        <span className="absolute right-2.5 top-2.5 rounded-full bg-black/25 px-2 py-0.5 text-[10.5px] text-white/85">
          {photoCreditLine(photo)}
        </span>
      ) : null}
    </div>
  );
}
