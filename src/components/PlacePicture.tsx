import { useState } from "react";
import { useStopPictures } from "@/hooks/useStopPictures";
import { usePlaceDetails } from "@/hooks/usePlaceDetails";
import { placeArtFor, placeArtUrl } from "@/lib/place-art";
import { photoCredit, type PlacePhoto } from "@/lib/wikimedia";

/**
 * A stop's or a place's picture, as You → Appearance asks: Béa's painting,
 * or — with "Real photos" — the place's own photo from Wikimedia Commons when
 * the map names one. Anything without a photo (not on the map, not matched by
 * name, no Commons tag, a broken file) keeps its painting.
 *
 * A photo always carries its author and licence, as Commons' terms ask. When
 * the picture sits inside a link or a button the credit is plain text (links
 * cannot nest); `linked` makes it a link to the file's Commons page.
 */
export function PlacePicture({
  name,
  category,
  kind,
  lat,
  lon,
  className = "",
  linked = false,
  decoding,
}: {
  name?: string | null | undefined;
  category?: string | null | undefined;
  kind?: string | null | undefined;
  lat?: number | null | undefined;
  lon?: number | null | undefined;
  className?: string;
  linked?: boolean;
  decoding?: "async" | "auto" | "sync";
}) {
  const [pictures] = useStopPictures();
  const { facts } = usePlaceDetails(name, lat, lon, pictures === "photos");
  const [broken, setBroken] = useState<string | null>(null);
  const photo = pictures === "photos" && facts?.photo?.url !== broken ? facts?.photo : undefined;

  if (photo) {
    return (
      <CommonsThumb
        photo={photo}
        className={className}
        linked={linked}
        onError={() => setBroken(photo.url)}
      />
    );
  }
  return (
    <img
      src={placeArtUrl(placeArtFor({ category: category ?? kind, kind, name }))}
      alt=""
      loading="lazy"
      decoding={decoding}
      draggable={false}
      className={`place-art art-dim object-cover ${className}`}
    />
  );
}

function CommonsThumb({
  photo,
  className,
  linked,
  onError,
}: {
  photo: PlacePhoto;
  className: string;
  linked: boolean;
  onError: () => void;
}) {
  const credit = photoCredit(photo);
  const caption =
    "pointer-events-auto absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-px text-[9px] leading-tight text-white";
  return (
    <span className={`place-art relative block overflow-hidden ${className}`} title={credit}>
      <img
        src={photo.url}
        alt=""
        width={photo.width}
        height={photo.height}
        loading="lazy"
        referrerPolicy="no-referrer"
        draggable={false}
        onError={onError}
        className="absolute inset-0 size-full object-cover"
      />
      {linked ? (
        <a href={photo.page} target="_blank" rel="noreferrer" className={`${caption} underline`}>
          {credit}
        </a>
      ) : (
        <span className={caption}>{credit}</span>
      )}
    </span>
  );
}
