import { useState } from "react";
import { DayMap } from "@/components/day/DayMap";
import { StopCard } from "@/components/day/StopCard";
import type { ItineraryRow } from "@/hooks/useTrips";
import { dayMapCaption, dayMapModel, toggleSelection } from "@/lib/day-map";
import { GEOAPIFY_ATTRIBUTION, OSM_ATTRIBUTION } from "@/lib/geo-endpoints";
import { placed as hasPosition } from "@/lib/trip-map";
import type { TimelineDayGroup } from "@/lib/timeline-groups";

/**
 * The chosen day as a travel guide: the itinerary first, the map beside it.
 *
 * The map answers "where are my places?", not "how do I get there?" — the
 * itinerary is the source of truth and the map supports it. So the list is
 * the hero (70% on a wide screen, first on a phone), and the map is a quiet
 * journal map beside it: numbered terracotta pins, a soft dotted arc from
 * each stop to the next, and the chosen place named. No layout switches,
 * no jump bar, no distances on the map.
 *
 * With every day shown, the stops are numbered straight through rather than
 * restarting each day: the pins share one map, and two pins both saying "1"
 * would leave the reader to work out which card each belongs to.
 */
export function DayMapView({
  groups,
  area,
  focusId,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  area: string;
  /** A stop to open on, from "Locate on map" in the Timeline. */
  focusId?: string | null | undefined;
}) {
  // Recomputed each render: `groups` is rebuilt upstream every time, and a
  // day's worth of stops costs nothing to walk.
  const model = dayMapModel(groups.flatMap((group) => group.items));
  const caption = dayMapCaption(model);
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);

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

  if (model.plan.kind === "none") {
    return (
      <div className="card-soft space-y-1 p-4">
        <p className="font-display text-[19px] leading-snug">Nothing to put on the map yet.</p>
        <p className="text-[14px] text-muted-foreground">
          None of {area ? `your ${area} stops` : "these stops"} has a location. Add an address to a
          stop in the Timeline Editor and it appears here.
        </p>
      </div>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start lg:gap-8">
      {/* The itinerary: the hero, set like a guide's chapter. */}
      <div className="space-y-10">
        {groups.map((group, g) => {
          const onMap = group.items.filter((item) => hasPosition(item)).length;
          return (
            <section key={group.key || "undated"} aria-label={group.label}>
              <header className="mb-5 px-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                  {groups.length > 1 ? `Day ${g + 1}` : "The day"}
                </p>
                <h2 className="mt-1.5 font-display text-[34px] leading-[1.05] tracking-tight">
                  {group.label}
                </h2>
                <p className="mt-2 text-[13px] text-muted-foreground">
                  {group.items.length} {group.items.length === 1 ? "place" : "places"}
                  {onMap < group.items.length ? ` · ${onMap} on the map` : ""}
                </p>
              </header>
              <div className="space-y-2.5">
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
          );
        })}
      </div>

      {/* The map: beside the list and still while it scrolls on a wide
          screen; after the list on a phone. */}
      <aside className="mt-8 lg:sticky lg:top-28 lg:mt-0">
        <DayMap
          pins={model.pins}
          selectedId={selectedId}
          onSelect={pickFromMap}
          heightClass="h-[22rem] lg:h-[calc(100vh-10rem)]"
          label={`Map of ${model.pins.length === 1 ? "one place" : `${model.pins.length} places`}`}
        />
        {caption && (
          <p className="mt-2 px-1 text-[12px] leading-snug text-muted-foreground">{caption}</p>
        )}
        {/* The credit ODbL asks for, next to the data it applies to. */}
        <p className="mt-1.5 px-1 text-[10.5px] text-muted-foreground/80">
          {OSM_ATTRIBUTION} · {GEOAPIFY_ATTRIBUTION}
        </p>
      </aside>
    </div>
  );
}
