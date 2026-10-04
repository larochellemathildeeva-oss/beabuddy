import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Heart } from "@/components/icons";
import { PlacePicture } from "@/components/PlacePicture";
import { supabase } from "@/integrations/supabase/client";
import { placeKey } from "@/lib/past-you";

type SavedPlace = {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  category: string | null;
  lat: number | null;
  lon: number | null;
  visited: boolean | null;
};

/**
 * Places already saved whose town is on this trip. The same town match Past
 * You uses, so a recommendation in another city stays on Recs. Nothing is
 * invented when none match: the way to save one is the link.
 */
export function SavedForTrip({
  places,
  country,
}: {
  places: readonly { city: string | null; country: string | null }[];
  country?: string | null | undefined;
}) {
  const recs = useSavedPlaces(places, country);

  return (
    <section aria-labelledby="saved-for-trip">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h2 id="saved-for-trip" className="font-display text-[22px] leading-tight">
          Saved for this trip
        </h2>
        <Link
          to="/recommendations"
          className="inline-flex min-h-11 shrink-0 items-center gap-0.5 text-[14px] font-semibold text-primary"
        >
          See all
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      {recs == null ? null : recs.length === 0 ? (
        <p className="text-[16px] leading-snug text-muted-foreground">
          Nothing saved in these cities yet.
        </p>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {recs.map((place) => (
            <Link
              key={place.id}
              to="/recommendations"
              aria-label={place.name}
              className="w-28 shrink-0"
            >
              <span className="relative block">
                <PlacePicture
                  name={place.name}
                  category={place.category}
                  lat={place.lat}
                  lon={place.lon}
                  className="h-28 w-28 rounded-2xl"
                />
                <Heart
                  className="absolute right-1.5 top-1.5 size-4 text-primary drop-shadow"
                  aria-hidden
                />
              </span>
              <span className="mt-1 block text-[14px] font-semibold leading-snug">
                {place.name}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

const SHOWN = 12;

function useSavedPlaces(
  places: readonly { city: string | null; country: string | null }[],
  country: string | null | undefined,
): SavedPlace[] | null {
  const [recs, setRecs] = useState<SavedPlace[] | null>(null);
  const key = `${country ?? ""}|${places.map((p) => `${p.city ?? ""}/${p.country ?? ""}`).join("|")}`;
  useEffect(() => {
    let active = true;
    void supabase
      .from("recommendations")
      .select("id, name, city, country, category, lat, lon, visited")
      .then(({ data }) => {
        if (!active) return;
        const rows = (data ?? []) as SavedPlace[];
        setRecs(
          rows.filter((row) => !row.visited && matches(places, country, row)).slice(0, SHOWN),
        );
      });
    return () => {
      active = false;
    };
    // `key` stands for the towns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return recs;
}

function matches(
  places: readonly { city: string | null; country: string | null }[],
  country: string | null | undefined,
  row: { city: string | null; country: string | null },
): boolean {
  const towns = new Set(places.map((p) => placeKey(p.city)).filter(Boolean));
  if (towns.size) return towns.has(placeKey(row.city));
  const tripCountry = placeKey(country);
  return Boolean(tripCountry) && placeKey(row.country) === tripCountry;
}
