import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Route as RouteIcon } from "lucide-react";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";
import { legsToTimelineItems, unroutedLegCopy, type DirectionStop } from "@/lib/timeline-directions";

type TimelineAdd = {
  day_date?: string;
  time_label?: string;
  kind: string;
  title: string;
  detail?: string;
  address?: string;
  lat?: number;
  lon?: number;
};

export function ItineraryDirections({
  stops,
  area,
  existingTitles = [],
  onAddToTimeline,
}: {
  stops: DirectionStop[];
  area?: string;
  existingTitles?: string[];
  onAddToTimeline?: (items: TimelineAdd[]) => Promise<void>;
}) {
  const run = useServerFn(buildRoutes);
  const [legs, setLegs] = useState<RouteLeg[] | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [openLeg, setOpenLeg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);

  if (stops.length < 2) return null;

  const addLegs = async () => {
    if (!legs || !onAddToTimeline) return;
    const items = legsToTimelineItems(legs, stops, existingTitles);
    if (items.length === 0) {
      setAdded(true);
      return;
    }
    setAdding(true);
    setError("");
    try {
      await onAddToTimeline(items);
      setAdded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add those to the timeline.");
    } finally {
      setAdding(false);
    }
  };

  const load = async () => {
    setBusy(true);
    setError("");
    try {
      const result = (await run({
        data: { stops, ...(area ? { area } : {}) },
      })) as { legs: RouteLeg[]; unresolved: string[]; deferred?: string[] };
      setLegs(result.legs);
      setUnresolved(result.unresolved);
      setDeferred(result.deferred ?? []);
      setAdded(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't work out the directions.");
    } finally {
      setBusy(false);
    }
  };

  const showAddBanner = Boolean(legs && legs.length > 0 && onAddToTimeline);

  return (
    <>
      <div data-guide="itinerary-directions" className="mb-3 rounded-xl border border-border p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-1.5 text-[13px] font-medium">
              <RouteIcon className="size-3.5" /> Directions between stops
            </p>
            <p className="text-[11.5px] text-muted-foreground">
              How to get from each timeline stop to the next, with walking or driving time.
            </p>
          </div>
          <button
            onClick={() => void load()}
            disabled={busy}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Working…" : legs ? "Refresh" : "Get directions"}
          </button>
        </div>

        {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}

        {legs && legs.length === 0 && !busy && (
          <p className="mt-2 text-[12px] text-muted-foreground">
            Béa couldn't place these stops on the map yet — add an address to them and try again.
          </p>
        )}

        {legs && legs.length > 0 && (
          <ul className="mt-3 space-y-2">
            {legs.map((leg, i) => (
              <li key={`${leg.from}-${leg.to}-${i}`} className="rounded-xl bg-elevated p-2.5">
                <button
                  onClick={() => setOpenLeg(openLeg === i ? null : i)}
                  className="w-full text-left"
                >
                  <p className="text-[12.5px] font-medium">
                    {leg.from} → {leg.to}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">
                    {leg.distance > 0
                      ? `${leg.mode === "walking" ? "Walk" : "Drive"} · ${prettyDistance(leg.distance)} · ${prettyDuration(leg.duration)}`
                      : unroutedLegCopy(leg)}
                  </p>
                </button>
                {openLeg === i && (
                  <>
                    {leg.steps.length > 0 && (
                    <ol className="mt-2 space-y-1 border-l border-border pl-3">
                      {leg.steps.map((step, s) => (
                        <li key={s} className="text-[11.5px] text-muted-foreground">
                          {step.instruction}
                          {step.distance > 0 && ` · ${prettyDistance(step.distance)}`}
                        </li>
                      ))}
                    </ol>
                    )}
                    <a
                      href={leg.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[11.5px] font-semibold text-primary underline"
                    >
                      Open in maps
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

        {unresolved.length > 0 && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Couldn't find: {unresolved.join(", ")}
          </p>
        )}
        {(deferred.length > 0 || legs?.some((leg) => leg.capped)) && (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            Later stretches open in maps — Béa stops looking after a long list so the rest of the trip stays usable.
          </p>
        )}
      </div>

      {showAddBanner && (
        <div
          data-guide="add-directions-timeline"
          className="mb-3 rounded-xl border border-border p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="label-caps text-foreground">Add these legs</p>
              <p className="text-[11px] text-muted-foreground">
                Saves each walk or drive as a timeline stop. Turn-by-turn stays on this phone only
                after you download Offline directions in trip settings.
              </p>
            </div>
            <button
              type="button"
              disabled={adding}
              onClick={() => void addLegs()}
              className="shrink-0 rounded-xl border border-border px-3 py-2 text-[12px] font-semibold disabled:opacity-50"
            >
              {adding ? "Adding…" : added ? "On the timeline" : "Add to timeline"}
            </button>
          </div>
          {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
        </div>
      )}
    </>
  );
}
