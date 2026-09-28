import { useState } from "react";
import { Accessibility, Clock, Globe, Phone } from "@/components/icons";
import { usePlaceDetails } from "@/hooks/usePlaceDetails";
import { closedWarning, isOpenAt } from "@/lib/opening-hours";
import { photoCredit, type PlacePhoto } from "@/lib/wikimedia";

/**
 * A photo of the place from Wikimedia Commons, always with its author and
 * licence under it and a link to its page — the terms it is shared on.
 */
function CommonsPhoto({ photo }: { photo: PlacePhoto }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="space-y-0.5">
      <img
        src={photo.url}
        alt=""
        width={photo.width}
        height={photo.height}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-28 w-full rounded-lg object-cover"
      />
      <figcaption className="truncate text-[10.5px]">
        <a
          href={photo.page}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          {photoCredit(photo)}
        </a>
      </figcaption>
    </figure>
  );
}

/**
 * Hours, website, phone and step-free access for a place, from Geoapify,
 * and a photo of it from Wikimedia Commons when the map names one.
 *
 * `auto` looks it up as soon as it is shown (a stop being edited, the next
 * stop in Companion); otherwise a small button asks, so a long list of recs
 * does not spend a lookup per card. With a day and time, it says whether the
 * place looks open then. Shows nothing when the place isn't on the map, and
 * nothing it isn't sure of.
 */
export function PlaceFacts({
  name,
  lat,
  lon,
  day,
  time,
  auto = false,
  tone = "light",
}: {
  name: string;
  lat: number | null | undefined;
  lon: number | null | undefined;
  /** "YYYY-MM-DD" and "HH:MM" of the planned visit, for the open/closed check. */
  day?: string | null | undefined;
  time?: string | null | undefined;
  auto?: boolean;
  tone?: "light" | "dark";
}) {
  const [asked, setAsked] = useState(auto);
  const { placed, facts, loading } = usePlaceDetails(name, lat, lon, asked);
  if (!placed) return null;
  const muted = tone === "dark" ? "text-background/70" : "text-muted-foreground";

  if (!asked) {
    return (
      <button
        type="button"
        onClick={() => setAsked(true)}
        className={`inline-flex items-center gap-1 text-[12px] font-semibold underline underline-offset-2 ${muted}`}
      >
        <Clock className="size-3" aria-hidden />
        Hours & details
      </button>
    );
  }
  if (loading) return <p className={`text-[11.5px] ${muted}`}>Looking up hours…</p>;
  if (!facts || (!facts.openingHours && !facts.website && !facts.phone && !facts.photo)) {
    return auto ? null : (
      <p className={`text-[11.5px] ${muted}`}>No hours listed for this place.</p>
    );
  }

  const warning = closedWarning(facts.openingHours, day, time);
  const openNow = !day && !time ? isOpenAt(facts.openingHours, new Date()) : null;
  const site = (() => {
    try {
      return facts.website ? new URL(facts.website).hostname.replace(/^www\./, "") : "";
    } catch {
      return "";
    }
  })();

  return (
    <div className={`space-y-1 text-[12px] ${muted}`}>
      {facts.photo && <CommonsPhoto key={facts.photo.url} photo={facts.photo} />}
      {facts.openingHours && (
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <Clock className="size-3 shrink-0" aria-hidden />
          <span className="break-words">{facts.openingHours.replace(/;\s*/g, " · ")}</span>
          {openNow !== null && (
            <span className={`font-bold ${openNow ? "text-nexttime" : "text-destructive"}`}>
              {openNow ? "Open now" : "Closed now"}
            </span>
          )}
        </p>
      )}
      {warning && (
        <p role="note" className="font-semibold text-destructive">
          ⚠ {warning}
        </p>
      )}
      {(site || facts.phone || facts.wheelchair === "yes") && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
          {site && (
            <a
              href={facts.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              <Globe className="size-3" aria-hidden />
              {site}
            </a>
          )}
          {facts.phone && (
            <a
              href={`tel:${facts.phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 font-semibold underline underline-offset-2"
            >
              <Phone className="size-3" aria-hidden />
              {facts.phone}
            </a>
          )}
          {facts.wheelchair === "yes" && (
            <span className="inline-flex items-center gap-1">
              <Accessibility className="size-3" aria-hidden />
              Step-free
            </span>
          )}
        </p>
      )}
    </div>
  );
}
