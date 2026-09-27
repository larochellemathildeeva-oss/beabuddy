import { useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  CalendarDays,
  ExternalLink,
  Navigation,
  Pencil,
  Share2,
} from "@/components/icons";
import { PlaceFacts } from "@/components/PlaceFacts";
import { pinColorClass, pinLabel, type PinType } from "@/data/atlas";
import type { RecoRowDB } from "@/hooks/useRecommendations";
import { formatMetres, metresAway } from "@/lib/near";
import { formatTripLocation } from "@/lib/place-label";
import { recMapsUrl } from "@/lib/reco-open";
import { directionsUrl } from "@/lib/recs-browse";
import { tagsForSave } from "@/lib/reco-tags";
import { isCityLevelPlace, isCountryLevelPlace } from "@/lib/reco-place";
import { PlaceArt, type RecsPlace } from "./RecsParts";

/**
 * One place, large: its picture, what it is, and the four things to do with
 * it — directions, save, add to a trip, share. The overview shows only what
 * Béa actually knows: your note, who told you, its tags, and hours or a
 * website when the map has them.
 */
export function PlaceDetail({
  place,
  row,
  here,
  saving,
  onBack,
  onSave,
  onEditSaved,
  onAddToTrip,
  onEditBeforeSave,
  onRemove,
}: {
  place: RecsPlace;
  row: RecoRowDB | undefined;
  here: { lat: number; lon: number } | null;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onEditSaved: () => void;
  onAddToTrip: () => void;
  onEditBeforeSave: () => void;
  onRemove: () => void;
}) {
  const [shared, setShared] = useState("");
  const saved = Boolean(row);
  const where = formatTripLocation(place.city, place.country);
  const metres =
    here && place.lat != null && place.lon != null
      ? metresAway(here, { lat: place.lat, lon: place.lon })
      : null;
  const kindLine = [place.category, where].filter(Boolean).join(" · ");
  const fields = {
    name: place.name,
    city: place.city ?? null,
    country: place.country ?? null,
    category: place.category ?? null,
  };
  const venue = !isCountryLevelPlace(fields) && !isCityLevelPlace(fields);
  const tags = row ? tagsForSave(row) : [];

  const share = async () => {
    const url = recMapsUrl(place);
    const text = [place.name, where].filter(Boolean).join(", ");
    try {
      if (navigator.share) {
        await navigator.share({ title: place.name, text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShared("Link copied.");
    } catch {
      /* the share sheet was dismissed */
    }
  };

  const action =
    "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-1 py-3 text-[12.5px] font-semibold";

  return (
    <div className="rise space-y-5">
      <div className="relative -mx-4 -mt-2 overflow-hidden sm:mx-0 sm:rounded-[var(--r-card)]">
        <PlaceArt place={place} className="h-60 w-full" />
        <button
          type="button"
          onClick={onBack}
          aria-label="Back"
          className="absolute left-4 top-4 grid size-10 place-items-center rounded-full bg-card/90 shadow-sm"
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="absolute right-4 top-4 flex gap-2">
          <button
            type="button"
            onClick={() => void share()}
            aria-label="Share"
            className="grid size-10 place-items-center rounded-full bg-card/90 shadow-sm"
          >
            <Share2 className="size-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={saved ? onEditSaved : onSave}
            aria-label={saved ? "Saved — edit" : "Save"}
            aria-pressed={saved}
            className="grid size-10 place-items-center rounded-full bg-card/90 shadow-sm"
          >
            <Bookmark
              className={`size-5 ${saved ? "text-primary" : ""}`}
              weight={saved ? "fill" : "regular"}
              aria-hidden
            />
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-display text-[34px] leading-[1.05]">{place.name}</h2>
        {kindLine && <p className="mt-1 text-[14.5px] text-muted-foreground">{kindLine}</p>}
        {metres != null && (
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">{formatMetres(metres)} away</p>
        )}
        {row && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[12.5px]">
            <span
              className={`size-2 rounded-full ${pinColorClass[(row.pin_type ?? "reco") as PinType]}`}
              aria-hidden
            />
            {pinLabel[(row.pin_type ?? "reco") as PinType]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        <a href={directionsUrl(place)} target="_blank" rel="noreferrer" className={action}>
          <Navigation className="size-5 text-primary" aria-hidden />
          Directions
        </a>
        <button
          type="button"
          onClick={saved ? onEditSaved : onSave}
          disabled={saving}
          className={`${action} disabled:opacity-60`}
        >
          <Bookmark
            className="size-5 text-primary"
            weight={saved ? "fill" : "regular"}
            aria-hidden
          />
          {saving ? "Saving…" : saved ? "Saved" : "Save"}
        </button>
        <button type="button" onClick={onAddToTrip} className={action}>
          <CalendarDays className="size-5 text-primary" aria-hidden />
          Add to trip
        </button>
        <button type="button" onClick={() => void share()} className={action}>
          <Share2 className="size-5 text-primary" aria-hidden />
          Share
        </button>
      </div>
      {shared && <p className="text-[13px] text-muted-foreground">{shared}</p>}

      <section className="plain-card space-y-3 p-4">
        <p className="inline-block rounded-full bg-primary-soft px-3 py-1 text-[13px] font-semibold">
          Overview
        </p>
        {row?.notes && <p className="text-[15px] leading-relaxed">{row.notes}</p>}
        {(row?.recommended_by || row?.source) && (
          <p className="text-[13.5px] text-muted-foreground">
            {row.recommended_by ? `Told by ${row.recommended_by}` : ""}
            {row.recommended_by && row.source ? " · " : ""}
            {row.source ?? ""}
          </p>
        )}
        {place.address && <p className="text-[14px]">{place.address}</p>}
        {tags.length > 0 && (
          <p className="text-[12.5px] text-muted-foreground">{tags.join(" · ")}</p>
        )}
        {row && (
          <p className="text-[12.5px] text-muted-foreground">
            Saved {new Date(row.created_at).toLocaleDateString()}
          </p>
        )}
        {venue && place.lat != null && place.lon != null && (
          <PlaceFacts name={place.name} lat={place.lat} lon={place.lon} auto />
        )}
        <a
          href={recMapsUrl(place)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[13.5px] font-semibold text-primary"
        >
          Open in Maps <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </section>

      {saved ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEditSaved}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13.5px] font-semibold"
          >
            <Pencil className="size-4" aria-hidden /> Note, list, who told you
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-full border border-border px-3.5 py-2 text-[13.5px] text-muted-foreground"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={onEditBeforeSave}
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-[13.5px] font-semibold"
        >
          <Pencil className="size-4" aria-hidden /> Check the details before saving
        </button>
      )}
    </div>
  );
}
