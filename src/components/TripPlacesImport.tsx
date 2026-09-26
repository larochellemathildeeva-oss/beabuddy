import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { pinColorClass, pinLabel } from "@/data/atlas";
import type { NewReco, RecoRowDB } from "@/hooks/useRecommendations";
import { beaLine } from "@/lib/bea-voice";
import { tripDateLine } from "@/lib/trip-card";
import { toLocalISODate } from "@/lib/trip-dates";
import {
  keeperGroups,
  keeperToReco,
  type KeeperItem,
  type KeeperPinType,
  type KeeperTrip,
} from "@/lib/trip-keepers";

const pinChoices: KeeperPinType[] = ["reco", "visited", "nexttime", "wishlist"];

const TRIP_COLS = "id, title, city, country, start_date, end_date";
const ITEM_COLS =
  "id, trip_id, kind, title, detail, address, lat, lon, day_date, position, arrived_at, left_at";

/**
 * Pick the places you loved off your trips' timelines and keep them.
 *
 * Every trip you have been on is already a list of places you chose; this
 * reads them back, marks the ones already in the vault, and saves the ones you
 * tick. Nothing is added unless you pick it.
 */
export function TripPlacesImport({
  signedIn,
  vault,
  onAddMany,
  onSaved,
}: {
  signedIn: boolean;
  vault: readonly RecoRowDB[];
  onAddMany: (rows: NewReco[]) => Promise<void>;
  onSaved?: () => void;
}) {
  const [trips, setTrips] = useState<KeeperTrip[] | null>(null);
  const [items, setItems] = useState<KeeperItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [openTrip, setOpenTrip] = useState<string | null>(null);
  const [pinType, setPinType] = useState<KeeperPinType>("reco");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    void (async () => {
      try {
        const { data: tripRows, error: tripError } = await supabase
          .from("trips")
          .select(TRIP_COLS)
          .order("start_date", { ascending: false });
        if (tripError) throw tripError;
        const found = (tripRows ?? []) as KeeperTrip[];
        let rows: KeeperItem[] = [];
        if (found.length) {
          const { data: itemRows, error: itemError } = await supabase
            .from("itinerary_items")
            .select(ITEM_COLS)
            .in(
              "trip_id",
              found.map((t) => t.id),
            );
          if (itemError) throw itemError;
          rows = (itemRows ?? []) as KeeperItem[];
        }
        if (cancelled) return;
        setTrips(found);
        setItems(rows);
      } catch {
        if (!cancelled) setError("Couldn't load your trips. Try again in a moment.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const groups = useMemo(
    () => (trips ? keeperGroups(trips, items, vault, toLocalISODate(new Date())) : []),
    [trips, items, vault],
  );

  // The most recent trip starts open; the rest are a tap away.
  useEffect(() => {
    if (openTrip === null && groups[0]) setOpenTrip(groups[0].trip.id);
  }, [groups, openTrip]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selection = groups.flatMap((group) =>
    group.places
      .filter((place) => !place.saved && picked.has(place.item.id))
      .map((place) => ({ place, trip: group.trip })),
  );

  const save = async () => {
    if (selection.length === 0) return;
    setSaving(true);
    setError(null);
    try {
      await onAddMany(selection.map(({ place, trip }) => keeperToReco(place.item, trip, pinType)));
      setPicked(new Set());
      const line = beaLine("recs.saved");
      toast.success(line.title, { description: line.body });
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save those places.");
    } finally {
      setSaving(false);
    }
  };

  if (!signedIn) {
    return (
      <p className="mt-3 text-[13px] text-muted-foreground">
        Sign in on the You tab to pick places from your trips.
      </p>
    );
  }
  if (error && !trips) return <p className="mt-3 text-[13px] text-destructive">{error}</p>;
  if (!trips) {
    return <p className="mt-3 text-[14.5px] text-muted-foreground">Looking through your trips…</p>;
  }
  if (groups.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-muted-foreground">
        No places on your trips' timelines yet. Once a trip has stops, you can keep the ones you
        loved from here.
      </p>
    );
  }

  return (
    <div className="mt-3 space-y-3">
      <p className="text-[13px] text-muted-foreground">
        Tick the places you went and loved. They're saved with the trip they came from.
      </p>
      {groups.map(({ trip, places }) => {
        const open = openTrip === trip.id;
        const fresh = places.filter((p) => !p.saved);
        const pickedHere = fresh.filter((p) => picked.has(p.item.id)).length;
        const wentFresh = fresh.filter((p) => p.went);
        return (
          <section key={trip.id} className="rounded-xl border border-border bg-background">
            <button
              type="button"
              onClick={() => setOpenTrip(open ? "" : trip.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14.5px] font-semibold">{trip.title}</span>
                <span className="block text-[12px] text-muted-foreground">
                  {tripDateLine(trip.start_date, trip.end_date)} · {places.length}{" "}
                  {places.length === 1 ? "place" : "places"}
                  {pickedHere ? ` · ${pickedHere} picked` : ""}
                </span>
              </span>
              <ChevronDown
                className={`size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>
            {open && (
              <div className="space-y-1.5 border-t border-border px-3 py-2.5">
                {fresh.length > 1 && (
                  <div className="flex flex-wrap gap-3 pb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          const all = pickedHere === fresh.length;
                          for (const p of fresh) {
                            if (all) next.delete(p.item.id);
                            else next.add(p.item.id);
                          }
                          return next;
                        })
                      }
                      className="text-[12.5px] font-medium text-primary underline"
                    >
                      {pickedHere === fresh.length ? "Clear" : "Pick all"}
                    </button>
                    {wentFresh.length > 0 && wentFresh.length < fresh.length && (
                      <button
                        type="button"
                        onClick={() =>
                          setPicked((prev) => {
                            const next = new Set(prev);
                            for (const p of wentFresh) next.add(p.item.id);
                            return next;
                          })
                        }
                        className="text-[12.5px] font-medium text-primary underline"
                      >
                        Pick the ones marked done
                      </button>
                    )}
                  </div>
                )}
                {places.map(({ item, saved, went }) => {
                  const on = saved || picked.has(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-start gap-2.5 rounded-lg px-1 py-1.5 ${
                        saved ? "opacity-60" : "cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={saved}
                        onChange={() => toggle(item.id)}
                        className="mt-0.5 size-4 shrink-0 accent-primary"
                      />
                      <span className="min-w-0">
                        <span className="block text-[14.5px]">{item.title}</span>
                        {(saved || went || item.address) && (
                          <span className="block truncate text-[12px] text-muted-foreground">
                            {saved ? (
                              "Already in your recs"
                            ) : went ? (
                              <>
                                <Check className="mr-0.5 inline size-3 text-nexttime" aria-hidden />
                                You went{item.address ? ` · ${item.address}` : ""}
                              </>
                            ) : (
                              item.address
                            )}
                          </span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}

      <div>
        <p className="mb-1.5 text-[12px] text-muted-foreground">Save them as</p>
        <div className="flex flex-wrap gap-2">
          {pinChoices.map((t) => {
            const on = pinType === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setPinType(t)}
                aria-pressed={on}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                  on ? "border-primary bg-card" : "border-border/60 text-muted-foreground"
                }`}
              >
                <span className={`size-2 rounded-full ${pinColorClass[t]}`} />
                {pinLabel[t]}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-[13px] text-destructive">{error}</p>}
      <button
        type="button"
        onClick={() => void save()}
        disabled={saving || selection.length === 0}
        className="w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : selection.length === 0
            ? "Pick places to save"
            : `Save ${selection.length} ${selection.length === 1 ? "place" : "places"}`}
      </button>
    </div>
  );
}
