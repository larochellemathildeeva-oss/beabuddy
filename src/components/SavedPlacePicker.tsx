import { useMemo, useState } from "react";
import { formatTripLocation } from "@/lib/place-label";
import { Bookmark } from "lucide-react";
import { useRecommendations } from "@/hooks/useRecommendations";
import { capturedFromReco, findDuplicate, type CapturedPlace } from "@/lib/captured-place";
import { fuzzyRank } from "@/lib/fuzzy";
import { pinColorClass, pinLabel, type PinType } from "@/data/atlas";

/**
 * Pick from what you already saved.
 *
 * The product's own litmus test is that a plan is assembled from saved ideas,
 * but until now nothing on a trip screen could read a recommendation — the
 * only way to get a saved place into a trip was to type it again from memory.
 */
export function SavedPlacePicker({
  near,
  alreadyHere = [],
  onPick,
  onClose,
}: {
  /** City or country to put first — usually where the trip is. */
  near?: string | undefined;
  /** What the trip already has, so saved places do not get added twice. */
  alreadyHere?: {
    name?: string;
    title?: string;
    city?: string;
    lat?: number | null;
    lon?: number | null;
  }[];
  onPick: (place: CapturedPlace) => void | Promise<void>;
  onClose: () => void;
}) {
  const vault = useRecommendations();
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState("");

  const rows = useMemo(() => {
    const all = vault.rows.map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city ?? "",
      country: r.country ?? "",
      notes: r.notes ?? "",
      category: r.category ?? "",
      type: (r.pin_type ?? "reco") as PinType,
      lat: r.lat,
      lon: r.lon,
      row: r,
    }));
    const searched = query.trim()
      ? fuzzyRank(all, query, (r) => [r.name, r.city, r.country, r.notes])
      : all;
    if (!near?.trim() || query.trim()) return searched;
    // With no search, float the ones where the trip actually is.
    const needle = near.toLowerCase();
    // Guard the empty string: "".includes() is always true, which floated
    // every place with no city recorded above the trip's actual city.
    const mentions = (value: string) =>
      value.trim().length > 1 && needle.includes(value.toLowerCase());
    const here = searched.filter((r) => mentions(r.city) || mentions(r.country));
    const rest = searched.filter((r) => !here.includes(r));
    return [...here, ...rest];
  }, [vault.rows, query, near]);

  const add = async (row: (typeof rows)[number]) => {
    setBusyId(row.id);
    try {
      await onPick(capturedFromReco(row.row));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div className="space-y-2 rounded-xl bg-elevated p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[14.5px] font-medium">
            <Bookmark className="size-3.5 text-primary" aria-hidden /> From your saved places
          </p>
          <p className="text-[12px] text-muted-foreground">
            {near ? `Places near ${near} first.` : "Everything you've saved."} Adding one keeps its
            address and map pin.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-lg border border-border px-2.5 py-1 text-[12px]"
        >
          Close
        </button>
      </div>

      {vault.loading && <p className="text-[13px] text-muted-foreground">Fetching your places…</p>}

      {!vault.loading && vault.rows.length === 0 && (
        <p className="text-[13px] text-muted-foreground">
          Nothing saved yet. Anything you keep on the Recs tab shows up here.
        </p>
      )}

      {vault.rows.length > 0 && (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your saved places"
            aria-label="Search your saved places"
            className="w-full rounded-xl border border-border bg-card px-3 py-2 text-[14.5px]"
          />
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {rows.slice(0, 40).map((row) => {
              const already = findDuplicate(alreadyHere, {
                name: row.name,
                city: row.city,
                lat: row.lat,
                lon: row.lon,
              });
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    disabled={Boolean(busyId)}
                    onClick={() => void add(row)}
                    className="flex w-full items-center gap-2 rounded-lg border border-border/60 px-2.5 py-2 text-left disabled:opacity-50"
                  >
                    <span
                      className={`size-2 shrink-0 rounded-full ${pinColorClass[row.type] ?? pinColorClass.reco}`}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{row.name}</span>
                      <span className="block truncate text-[12px] text-muted-foreground">
                        {formatTripLocation(row.city, row.country) ||
                          pinLabel[row.type] ||
                          "Saved place"}
                        {row.lat == null ? " · no map pin" : ""}
                      </span>
                    </span>
                    <span className="shrink-0 text-[11.5px] uppercase tracking-wider text-muted-foreground">
                      {busyId === row.id ? "Adding…" : already ? "Already added" : "Add"}
                    </span>
                  </button>
                </li>
              );
            })}
            {rows.length === 0 && (
              <li className="px-1 py-2 text-[13px] text-muted-foreground">
                Nothing saved matches that.
              </li>
            )}
          </ul>
        </>
      )}
    </div>
  );
}
