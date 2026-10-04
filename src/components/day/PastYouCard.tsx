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
        <p id="past-you" className="label-caps">
          Past You in {found.place}
        </p>
        {line && <p className="mt-1 font-display text-[22px] leading-tight">{line}</p>}
      </div>

      {found.notes.length > 0 && (
        <ul className="space-y-2">
          {found.notes.map((note) => (
            <li key={note.id} className="rounded-xl bg-primary-soft px-3 py-2">
              <p className="font-display text-[18px] leading-snug">“{note.note}”</p>
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
          <p className="mt-0.5 text-[16px] leading-snug text-muted-foreground">
            {found.recs.map((r) => r.name).join(" · ")}
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

type PastData = {
  notes: PastNote[];
  photos: PastPhoto[];
  trips: PastTrip[];
  recs: PastRec[];
};

/** Everything Past You left, read once when the trip opens. */
function usePastData(): PastData | null {
  const [data, setData] = useState<PastData | null>(null);
  useEffect(() => {
    let active = true;
    // Own photos only: other travellers' photos on a shared trip's stops are
    // readable too, and are not Past You's.
    const load = (uid: string) =>
      Promise.all([
        supabase.from("future_notes").select("id, city, country, note, created_at"),
        supabase
          .from("photo_memories")
          .select("id, storage_path, city, country, taken_at")
          .eq("user_id", uid),
        supabase.from("trips").select("id, title, city, country, start_date, end_date"),
        supabase.from("recommendations").select("id, name, city, country, visited"),
      ]).then(([notes, photos, trips, recs]) => {
        if (!active) return;
        setData({
          notes: (notes.data ?? []) as PastNote[],
          photos: (photos.data ?? []) as PastPhoto[],
          trips: (trips.data ?? []) as PastTrip[],
          recs: (recs.data ?? []) as PastRec[],
        });
      });
    void supabase.auth.getSession().then(({ data: auth }) => {
      const uid = auth.session?.user.id;
      if (active && uid) void load(uid);
    });
    return () => {
      active = false;
    };
  }, []);
  return data;
}

function usePhotoUrls(photos: readonly PastPhoto[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = photos.map((p) => p.id).join(",");
  useEffect(() => {
    if (!photos.length) return;
    let active = true;
    void supabase.storage
      .from("photo-memories")
      .createSignedUrls(
        photos.map((p) => p.storage_path),
        3600,
      )
      .then(({ data }) => {
        if (!active || !data) return;
        const next: Record<string, string> = {};
        data.forEach((entry, i) => {
          if (entry.signedUrl) next[photos[i]!.id] = entry.signedUrl;
        });
        setUrls(next);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for the list
  }, [key]);
  return urls;
}
