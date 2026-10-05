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
import { singlePlaceShareReco, singlePlaceShareText } from "@/lib/reco-share";
import { createRecoShare } from "@/hooks/useRecoShares";
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
  uid,
  myName,
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
  /** Signed in: the place can go as a Béa code, not only a Maps link. */
  uid: string | null;
  myName: string;
  saving: boolean;
  onBack: () => void;
  onSave: () => void;
  onEditSaved: () => void;
  onAddToTrip: () => void;
  onEditBeforeSave: () => void;
  onRemove: () => void;
}) {
  const [shared, setShared] = useState("");
  const [choosing, setChoosing] = useState(false);
  const [making, setMaking] = useState(false);
  /** A code made and waiting to be sent. */
  const [ready, setReady] = useState<string | null>(null);
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

  /** Tapping Share asks how, when there is a choice; signed out it is the link. */
  const share = () => {
    setShared("");
    setReady(null);
    if (uid) setChoosing((open) => !open);
    else void deliver(null);
  };

  /**
   * Open the share sheet, or copy when there is none. Only ever called
   * straight from a tap: a browser refuses the share sheet once a network
   * wait has used up the tap, which is why a code is made first and sent from
   * a second tap.
   */
  const deliver = async (code: string | null) => {
    const url = recMapsUrl(place);
    const text = singlePlaceShareText({
      name: place.name,
      where,
      mapsUrl: url,
      ...(code ? { code } : {}),
    });
    try {
      if (navigator.share) {
        // The link rides inside the text when there is a code, so the code is
        // never dropped by an app that keeps only one of the two.
        await navigator.share(
          code
            ? { title: place.name, text }
            : { title: place.name, text: [place.name, where].filter(Boolean).join(", "), url },
        );
        return;
      }
      await navigator.clipboard.writeText(text);
      setShared(code ? "Copied, with the code." : "Link copied.");
    } catch (e) {
      // Dismissing the sheet is not a failure; anything else falls back to copying.
      if (e instanceof DOMException && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        setShared(code ? "Copied, with the code." : "Link copied.");
      } catch {
        setShared(code ? `Couldn't open sharing — the code is ${code}.` : "Couldn't share that.");
      }
    }
  };

  /**
   * Put the rec itself behind a one-place share, the same kind "Send places"
   * makes. Your note stays behind, as it does there.
   */
  const makeCode = async () => {
    if (!uid) return;
    setMaking(true);
    setShared("");
    try {
      const made = await createRecoShare(uid, {
        recos: [singlePlaceShareReco(place, row)],
        title: place.name,
        sharedByName: myName,
      });
      setReady(made.code);
      setChoosing(false);
    } catch (e) {
      setShared(e instanceof Error ? e.message : "Couldn't make a code for this place.");
    } finally {
      setMaking(false);
    }
  };

  const action =
    "flex flex-col items-center gap-1.5 rounded-2xl border border-border bg-card px-1 py-3 text-[13px] font-semibold";

  return (
    <div className="rise space-y-5">
      <div className="relative -mx-4 -mt-2 overflow-hidden sm:mx-0 sm:rounded-[var(--r-card)]">
        <PlaceArt place={place} className="h-60 w-full" linked />
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
            onClick={share}
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
        {kindLine && <p className="mt-1 text-[15px] text-muted-foreground">{kindLine}</p>}
        {metres != null && (
          <p className="mt-0.5 text-[13.5px] text-muted-foreground">{formatMetres(metres)} away</p>
        )}
        {row && (
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[13px]">
            <span
              className={`size-2 rounded-full ${pinColorClass[(row.pin_type ?? "reco") as PinType]}`}
              aria-hidden
            />
            {pinLabel[(row.pin_type ?? "reco") as PinType]}
          </p>
        )}
      </div>

      <div className="recs-actions grid grid-cols-4 gap-2">
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
        <button
          type="button"
          onClick={share}
          aria-expanded={uid ? choosing : undefined}
          className={action}
        >
          <Share2 className="size-5 text-primary" aria-hidden />
          Share
        </button>
      </div>
      {choosing && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void makeCode()}
            disabled={making}
            className="rounded-xl bg-primary px-3 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {making ? "Making a code…" : "As a Béa rec, with a code"}
          </button>
          <button
            type="button"
            onClick={() => {
              setChoosing(false);
              void deliver(null);
            }}
            disabled={making}
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
          >
            Just the Maps link
          </button>
        </div>
      )}
      {ready && (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-3">
          <span className="min-w-0 flex-1">
            <span className="block font-mono text-[16.5px] tracking-widest">{ready}</span>
            <span className="block text-[13px] text-muted-foreground">
              Works for 30 days. Sent with the Maps link.
            </span>
          </span>
          <button
            type="button"
            onClick={() => void deliver(ready)}
            className="shrink-0 rounded-xl bg-primary px-4 py-2 text-[13.5px] font-semibold text-primary-foreground"
          >
            Send it
          </button>
        </div>
      )}
      {shared && <p className="text-[13px] text-muted-foreground">{shared}</p>}

      <section className="recs-box space-y-3 p-4">
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
        {tags.length > 0 && <p className="text-[13px] text-muted-foreground">{tags.join(" · ")}</p>}
        {row && (
          <p className="text-[13px] text-muted-foreground">
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
