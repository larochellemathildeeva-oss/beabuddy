import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Route as RouteIcon } from "lucide-react";
import { buildRoutes, type RouteLeg } from "@/lib/directions.functions";
import { prettyDistance, prettyDuration } from "@/hooks/useOfflineDirections";

type Stop = { title: string; address?: string | null; lat?: number | null; lon?: number | null };

export function ItineraryDirections({ stops, area }: { stops: Stop[]; area?: string }) {
  const run = useServerFn(buildRoutes);
  const [legs, setLegs] = useState<RouteLeg[] | null>(null);
  const [unresolved, setUnresolved] = useState<string[]>([]);
  const [deferred, setDeferred] = useState<string[]>([]);
  const [openLeg, setOpenLeg] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (stops.length < 2) return null;

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't work out the directions.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-guide="itinerary-directions" className="mt-3 rounded-xl border border-border p-3">
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
                    : leg.capped
                      ? "Turn-by-turn paused here — open in maps for this stretch"
                      : "Exact spot unknown — open in maps to search it"}
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
  );
}
