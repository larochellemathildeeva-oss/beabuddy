import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Sheet } from "@/components/Sheet";
import { RecoListImport } from "@/components/RecoListImport";
import { pinLabel, type PinType } from "@/data/atlas";
import type { NewReco, RecoRowDB } from "@/hooks/useRecommendations";

export type SheetLocation = { name: string; city: string | null; country: string | null };

/**
 * A city or country on World, with the recs saved for it (place-lists.ts):
 * each opens in Recs, where businesses, landmarks and attractions live, and
 * an article can be read to add more.
 */
export function LocationSheet({
  location,
  recs,
  open,
  onClose,
  signedIn,
  onAddMany,
  actions,
  finder,
}: {
  location: SheetLocation;
  recs: readonly RecoRowDB[];
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  onAddMany: (rows: NewReco[]) => Promise<void>;
  /** The location's own actions (Been there, …), under its recs. */
  actions?: ReactNode;
  /** "Find recs for …", when Béa can search. */
  finder?: (openArticle: (url: string) => void) => ReactNode;
}) {
  const [reading, setReading] = useState<{ url: string } | null>(null);
  const where = { city: location.city, country: location.country };
  return (
    <Sheet
      open={open}
      onClose={() => {
        setReading(null);
        onClose();
      }}
      title={location.name}
      hint={
        recs.length > 0
          ? `${recs.length} ${recs.length === 1 ? "rec" : "recs"} saved`
          : "No recs saved yet"
      }
    >
      <div className="space-y-5">
        {recs.length > 0 && (
          <ul className="divide-y divide-border border-y border-border">
            {recs.map((rec) => (
              <li key={rec.id}>
                <Link
                  to="/recommendations"
                  className="flex min-h-14 items-center justify-between gap-3 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[16px] font-semibold">{rec.name}</span>
                    <span className="block truncate text-[14px] text-muted-foreground">
                      {[rec.category, pinLabel[(rec.pin_type ?? "reco") as PinType]]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {finder?.((url) => setReading({ url }))}

        {reading ? (
          <RecoListImport
            key={reading.url}
            signedIn={signedIn}
            onAddMany={onAddMany}
            place={where}
            initialPageUrl={reading.url}
            onSaved={() => setReading(null)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setReading({ url: "" })}
            className="min-h-12 w-full rounded-[var(--r-button)] border border-[var(--field-border)] px-4 text-[16px] font-semibold"
          >
            Paste an article link
          </button>
        )}

        {actions}
      </div>
    </Sheet>
  );
}
