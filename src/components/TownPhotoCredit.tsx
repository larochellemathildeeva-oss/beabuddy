import { creditedOnPhoto, photoCredit, type PlacePhoto } from "@/lib/wikimedia";

/**
 * The credit a Commons town photo on a trip picture always carries (Pexels
 * photos are credited on the privacy page instead). Plain text: the
 * picture sits inside a link to the trip, and links cannot nest.
 */
export function TownPhotoCredit({
  photo,
  className = "",
}: {
  photo: PlacePhoto;
  className?: string;
}) {
  if (!creditedOnPhoto(photo)) return null;
  const credit = photoCredit(photo);
  return (
    <span
      title={credit}
      className={`absolute bottom-0.5 right-1.5 z-10 max-w-[calc(100%-0.75rem)] truncate text-[9px] leading-tight text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)] ${className}`}
    >
      {credit}
    </span>
  );
}
