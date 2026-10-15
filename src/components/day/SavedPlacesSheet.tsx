import { useState } from "react";
import { MapPin, Plus } from "@/components/icons";
import { Sheet } from "@/components/Sheet";
import { useRecommendations, type RecoRowDB } from "@/hooks/useRecommendations";

/**
 * The prototype's Saved Places drawer: places you saved in Recs, with one tap
 * to put them on the day you are looking at.
 *
 * Shows this trip's city first and offers every saved place with one switch,
 * rather than hiding the rest: a place saved as "Tokyo" is still worth
 * finding from a Hiroshima trip. Nothing here writes to your saved places;
 * adding copies the place onto the itinerary.
 */
export function SavedPlacesSheet({
  open,
  onClose,
  city,
  dayLabel,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  /** The trip's city, to show its places first. */
  city: string | null | undefined;
  /** "Wed · Oct 7", or null when no single day is chosen. */
  dayLabel: string | null;
  onAdd: (place: RecoRowDB) => Promise<void>;
}) {
  const { rows, loading } = useRecommendations();
  const [showAll, setShowAll] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const here = (city ?? "").trim().toLowerCase();
  const inCity = (r: RecoRowDB) => {
    const c = (r.city ?? "").trim().toLowerCase();
    return here !== "" && c !== "" && (c.includes(here) || here.includes(c));
  };
  const local = rows.filter(inCity);
  const shown = showAll || local.length === 0 ? rows : local;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      page
      title="Add saved place to trip"
      hint={dayLabel ? `Recs · Add to ${dayLabel}` : "Recs · Pick a day first, or add to the trip"}
      crumb="Back to Timeline"
    >
      <div className="space-y-3">
        {local.length > 0 && local.length < rows.length && (
          <div role="group" aria-label="Which places" className="flex gap-1.5">
            {[
              [false, `In ${city} (${local.length})`],
              [true, `All (${rows.length})`],
            ].map(([all, label]) => (
              <button
                key={String(all)}
                type="button"
                aria-pressed={showAll === all}
                onClick={() => setShowAll(all as boolean)}
                className={`min-h-11 rounded-[var(--r-card)] border px-4 text-[14px] font-semibold ${
                  showAll === all
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-card text-foreground"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-[14px] text-muted-foreground">Loading your places…</p>
        ) : shown.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            No saved places yet. Save places in Recs, or with "Save to my places" on a stop, and
            they appear here.
          </p>
        ) : (
          <ul className="space-y-3">
            {shown.map((place) => {
              const done = added.has(place.id);
              return (
                <li key={place.id} className="fe-card flex items-center gap-3">
                  <MapPin className="size-5 shrink-0" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[16px] font-semibold">{place.name}</p>
                    <p className="truncate text-[14px] text-muted-foreground">
                      {[place.category, place.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={done}
                    onClick={() => {
                      setError("");
                      void onAdd(place).then(
                        () => setAdded((prev) => new Set(prev).add(place.id)),
                        () => setError(`Couldn't add ${place.name}. Try again.`),
                      );
                    }}
                    className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-[var(--r-card)] border border-border bg-card px-4 text-[14px] font-semibold disabled:text-muted-foreground"
                  >
                    {done ? (
                      "Added"
                    ) : (
                      <>
                        <Plus className="size-3.5" aria-hidden />
                        Add
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
