import { useState } from "react";
import { MapPin, Plus } from "lucide-react";
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
      title="Saved places"
      hint={dayLabel ? `Add to ${dayLabel}` : "Pick a day first to add to it, or add to the trip"}
      width="sm"
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
                className={`min-h-9 rounded-lg px-3 text-[12.5px] font-semibold ${
                  showAll === all
                    ? "bg-foreground text-background"
                    : "border border-border bg-elevated text-muted-foreground"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p className="text-[13.5px] text-muted-foreground">Loading your places…</p>
        ) : shown.length === 0 ? (
          <p className="text-[13.5px] text-muted-foreground">
            No saved places yet. Save places in Recs, or with "Save to my places" on a stop, and
            they appear here.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {shown.map((place) => {
              const done = added.has(place.id);
              return (
                <li key={place.id} className="flex items-center gap-3 py-2.5">
                  <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold">{place.name}</p>
                    <p className="truncate text-[12px] text-muted-foreground">
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
                    className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-xl border border-border bg-card px-3 text-[12.5px] font-semibold text-primary disabled:text-nexttime"
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
          <p role="alert" className="text-[13px] font-semibold text-destructive">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  );
}
