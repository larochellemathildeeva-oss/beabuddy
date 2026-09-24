import { useState } from "react";
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
        <div className="space-y-1.5">
          <DayMap
            pins={model.pins}
            selectedId={selectedId}
            onSelect={pickFromMap}
            label={`Map of ${model.pins.length === 1 ? "one stop" : `${model.pins.length} stops`}`}
          />
          {caption && <p className="text-[12.5px] text-muted-foreground">{caption}</p>}
          {/* The credit ODbL asks for, next to the data it applies to. */}
          <p className="text-[11.5px] text-muted-foreground">{OSM_ATTRIBUTION}</p>
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
