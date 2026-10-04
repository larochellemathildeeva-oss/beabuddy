import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import {
  pastYouFor,
  visitLine,
  type PastNote,
  type PastPhoto,
  type PastRec,
  type PastTrip,
} from "@/lib/past-you";

/**
 * "Past You has been here before": the Future Me notes, photos, earlier
 * trips and still-unvisited saved places for this trip's towns, on the
 * trip's Overview. Quiet — nothing at all — when there is nothing.
 */
export function PastYouCard({
  trip,
  places,
}: {
  trip: PastTrip;
  places: readonly { city: string | null; country: string | null }[];
}) {
  const data = usePastData();
  const found = useMemo(() => (data ? pastYouFor(trip, places, data) : null), [data, trip, places]);
  const urls = usePhotoUrls(found?.photos ?? []);
  if (!found) return null;
  const line = visitLine(found.visits, found.photos);

  return (
    <section aria-labelledby="past-you" className="plain-card space-y-3 p-3.5">
      <div>
        <p
          id="past-you"
          className="text-[13px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
        >
          Past You in {found.place}
        </p>
        {line && <p className="mt-0.5 font-display text-[22px] leading-tight">{line}</p>}
      </div>

      {found.notes.length > 0 && (
        <ul className="space-y-2">
          {found.notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-primary-soft px-3 py-2">
              <p className="font-display text-[17px] leading-snug">“{note.note}”</p>
              <p className="mt-0.5 text-[14px] text-muted-foreground">
                Past You, {new Date(note.created_at).getFullYear()}
              </p>
            </li>
          ))}
        </ul>
      )}

      {found.photos.length > 0 && (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {found.photos.map((photo) =>
            urls[photo.id] ? (
              <img
                key={photo.id}
                src={urls[photo.id]}
                alt={`Your photo from ${found.place}`}
                className="size-20 shrink-0 rounded-xl object-cover"
                loading="lazy"
              />
            ) : (
              <span key={photo.id} className="size-20 shrink-0 rounded-xl bg-elevated" />
            ),
          )}
        </div>
      )}

      {found.recs.length > 0 && (
        <div>
          <p className="text-[16px] font-semibold">Saved and not yet visited</p>
          <p className="mt-0.5 text-[14px] leading-snug text-muted-foreground">
            {found.recs.map((r) => r.name).join(" \u00b7 ")}
          </p>
        </div>
      )}

      <Link
        to="/memories"
        className="inline-flex min-h-11 items-center gap-1 text-[16px] font-semibold text-primary"
      >
        All your memories
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
