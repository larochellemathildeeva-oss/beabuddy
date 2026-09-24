import { useState } from "react";
import { ChevronLeft, ChevronRight, Compass } from "lucide-react";
import { mapsPlaceUrl } from "@/lib/direction-stops";
import { stayLabel } from "@/lib/planned-stay";
import { timeForRail } from "@/lib/timeline-kind";
import { DayMap } from "@/components/day/DayMap";
import { StopCard } from "@/components/day/StopCard";
import type { ItineraryRow } from "@/hooks/useTrips";
import { dayMapCaption, dayMapModel, toggleSelection } from "@/lib/day-map";
import { OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import type { TimelineDayGroup } from "@/lib/timeline-groups";

/**
 * The chosen day as a map and a list that point at the same stop.
 *
 * With every day shown, the stops are numbered straight through rather than
 * restarting each day: the pins share one map, and two pins both saying "1"
 * would leave the reader to work out which card each belongs to.
 */
type MapLayout = "dual" | "peek" | "list";

/** The prototype's three map layouts, as map heights. */
const LAYOUTS: { id: MapLayout; label: string; height: string }[] = [
  { id: "dual", label: "Dual", height: "h-72" },
  { id: "peek", label: "Map + cards", height: "h-[26rem]" },
  { id: "list", label: "List focus", height: "h-40" },
];

export function DayMapView({
  groups,
  area,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  area: string;
}) {
  // Recomputed each render: `groups` is rebuilt upstream every time, and a
  // day's worth of stops costs nothing to walk.
  const model = dayMapModel(groups.flatMap((group) => group.items));
  const caption = dayMapCaption(model);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layout, setLayout] = useState<MapLayout>("dual");
  const stopById = new Map(groups.flatMap((group) => group.items).map((item) => [item.id, item]));
  // The floating card shows the chosen stop, or the day's first one.
  const focus = model.pins.find((pin) => pin.id === selectedId) ?? model.pins[0] ?? null;
  const focusStop = focus ? stopById.get(focus.id) : undefined;
  const focusIndex = focus ? model.pins.indexOf(focus) : 0;
  const step = (by: -1 | 1) => {
    const n = model.pins.length;
    if (n === 0) return;
    setSelectedId(model.pins[(focusIndex + by + n) % n]!.id);
  };

  const pickFromMap = (id: string) => {
    setSelectedId((current) => toggleSelection(current, id));
    // "nearest" leaves the page alone when the card is already in view.
    document.getElementById(`stop-${id}`)?.scrollIntoView({ block: "nearest" });
  };

  // Numbering runs across the days shown, matching the pins.
  const offsets = groups.reduce<number[]>(
    (acc, group, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + groups[i - 1]!.items.length],
    [],
  );

  return (
    <div className="space-y-3">
      {model.plan.kind === "none" ? (
        <div className="card-soft space-y-1 p-4">
          <p className="font-display text-[19px] leading-snug">Nothing to put on the map yet.</p>
          <p className="text-[14px] text-muted-foreground">
            None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to
            a stop in the Day tab and it appears here.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* The prototype's "Map & stops" bar: three layouts, and a row of
              numbered stops to jump to. */}
          <div className="space-y-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[13.5px] font-bold">
                <Compass className="size-4 text-nexttime" aria-hidden />
                Map & stops
                <span className="rounded-full border border-border bg-elevated px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {model.pins.length} on the map
                </span>
              </p>
              <div
                role="group"
                aria-label="Map layout"
                className="flex items-center rounded-xl border border-border bg-elevated p-0.5 text-[11.5px] font-semibold"
              >
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    aria-pressed={layout === l.id}
                    onClick={() => setLayout(l.id)}
                    className={`min-h-8 rounded-lg px-2.5 ${
                      layout === l.id
                        ? l.id === "dual"
                          ? "bg-nexttime font-bold text-white shadow-sm"
                          : "bg-foreground font-bold text-background shadow-sm"
                        : "text-muted-foreground"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto">
              <span className="shrink-0 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
                Jump to:
              </span>
              {model.pins.map((pin) => {
                const on = pin.id === focus?.id;
                const time = timeForRail(stopById.get(pin.id)?.time_label);
                return (
                  <button
                    key={pin.id}
                    type="button"
                    onClick={() => setSelectedId(pin.id)}
                    className={`inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium ${
                      on
                        ? "bg-primary font-bold text-primary-foreground shadow-sm"
                        : "border border-border bg-card text-muted-foreground"
                    }`}
                  >
                    <span className="grid size-4 place-items-center rounded-full bg-foreground/15 text-[9.5px]">
                      {pin.number}
                    </span>
                    {time && <span className="tabular-nums">{time}</span>}
                    <span className="max-w-[90px] truncate">{pin.title.split(" ")[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DayMap
            pins={model.pins}
            selectedId={selectedId}
            onSelect={pickFromMap}
            heightClass={LAYOUTS.find((l) => l.id === layout)!.height}
            label={`Map of ${model.pins.length === 1 ? "one stop" : `${model.pins.length} stops`}`}
          >
            {/* The floating stop card, as in the prototype. Hidden in List
                focus, where the map is only a strip. */}
            {layout !== "list" && focus && focusStop && (
              <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 z-[500]">
                <div className="pointer-events-auto rounded-2xl border border-border bg-card/95 p-2.5 shadow-lg backdrop-blur-md">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-foreground text-[11.5px] font-bold text-background">
                        {focus.number}
                      </span>
                      {timeForRail(focusStop.time_label) && (
                        <span className="text-[13px] font-bold tabular-nums text-primary">
                          {timeForRail(focusStop.time_label)}
                        </span>
                      )}
                      {focusStop.planned_stay_minutes ? (
                        <span className="truncate rounded-full border border-border bg-elevated px-2 py-0.5 text-[11px] text-muted-foreground">
                          ~{stayLabel(focusStop.planned_stay_minutes)} stay
                        </span>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        onClick={() => step(-1)}
                        aria-label="Previous stop"
                        className="grid size-8 place-items-center rounded-xl border border-border bg-elevated"
                      >
                        <ChevronLeft className="size-4" aria-hidden />
                      </button>
                      <span className="text-[11px] tabular-nums text-muted-foreground">
                        {focusIndex + 1}/{model.pins.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => step(1)}
                        aria-label="Next stop"
                        className="grid size-8 place-items-center rounded-xl border border-border bg-elevated"
                      >
                        <ChevronRight className="size-4" aria-hidden />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 truncate text-[14px] font-bold">{focusStop.title}</p>
                  {layout === "peek" && (
                    <div className="mt-1 flex items-center justify-between gap-2 text-[12px] text-muted-foreground">
                      <span className="truncate">{focusStop.address?.trim()}</span>
                      <a
                        href={mapsPlaceUrl(focusStop.title, {
                          lat: focusStop.lat,
                          lon: focusStop.lon,
                        })}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 font-semibold text-nexttime underline"
                      >
                        Directions
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </DayMap>
          {caption && <p className="text-[12.5px] text-muted-foreground">{caption}</p>}
          {/* The credit ODbL asks for, next to the data it applies to. */}
          <p className="text-[11.5px] text-muted-foreground">{OSM_ATTRIBUTION}</p>
          <p className="pt-1 text-[14px] font-bold">Complete itinerary</p>
        </div>
      )}

      {groups.map((group, g) => (
        <section key={group.key || "undated"} className="space-y-2">
          {groups.length > 1 && (
            <h2 className="font-display text-[19px] leading-tight">{group.label}</h2>
          )}
          <div className="space-y-2">
            {group.items.map((item, i) => (
              <StopCard
                key={item.id}
                item={item}
                index={offsets[g]! + i}
                selected={item.id === selectedId}
                onSelect={() => setSelectedId((current) => toggleSelection(current, item.id))}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
