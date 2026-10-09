import { useEffect, useRef, useState, type ReactNode } from "react";
import { DayMap } from "@/components/day/DayMap";
import { MapFootnotes, between, type LegFor } from "@/components/day/DayMapView";
import type { ItineraryRow } from "@/hooks/useTrips";
import { companionState } from "@/lib/companion";
import { dayMapModel, toggleSelection } from "@/lib/day-map";
import { timeForRail } from "@/lib/timeline-kind";
import type { TimelineDayGroup } from "@/lib/timeline-groups";

/**
 * Split, under the Map tab (Figma "trip-map", 116:1060): the map on top, the
 * day tabs under it, then the day as a short timeline — "01 / Coffee near the
 * station", "09:00 / 18 min walk" — and Get directions. A row picks its pin;
 * a pin picks its row. The full Timeline keeps the editing.
 */
export function MapSplit({
  groups,
  ordinals,
  nesting = true,
  focusId,
  legFor,
  dayTabs,
  onDirections,
  directionsBusy = false,
}: {
  groups: TimelineDayGroup<ItineraryRow>[];
  /** "Day 3" for each day's key, counted across the whole trip. */
  ordinals: Record<string, string>;
  nesting?: boolean;
  /** A stop to open on, from "Locate on map" in the Timeline. */
  focusId?: string | null | undefined;
  legFor?: LegFor | undefined;
  /** "Today / All days", between the map and the list. */
  dayTabs?: ReactNode;
  onDirections?: (() => void) | undefined;
  directionsBusy?: boolean;
}) {
  const stops = groups.flatMap((group) => group.items);
  const model = dayMapModel(stops, { nesting });
  const numbers = new Map(model.pins.map((pin) => [pin.id, pin.number]));
  const [selectedId, setSelectedId] = useState<string | null>(focusId ?? null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusId) document.getElementById(`split-${focusId}`)?.scrollIntoView({ block: "nearest" });
  }, [focusId]);

  const pickFromMap = (id: string) => {
    setSelectedId((current) => toggleSelection(current, id));
    document.getElementById(`split-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const pickFromList = (id: string) => {
    setSelectedId((current) => toggleSelection(current, id));
    if (numbers.has(id)) mapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };
  const many = groups.length > 1;

  return (
    <div className="map-split">
      {model.pins.length > 0 ? (
        <div ref={mapRef} className="map-split-map">
          <DayMap
            pins={model.pins}
            selectedId={selectedId}
            onSelect={pickFromMap}
            label={`Map of ${model.pins.length === 1 ? "one place" : `${model.pins.length} places`}`}
            heightClass="h-[320px] w-full"
            roundedClass="rounded-[var(--r-card)]"
          />
        </div>
      ) : (
        <p className="map-split-empty">
          {stops.length
            ? "None of these stops has a location yet. Add an address to a stop in the Timeline and it appears here."
            : "Nothing planned on this day yet."}
        </p>
      )}
      {dayTabs}
      {groups.map((group) => (
        <section key={group.key || "undated"} aria-label={ordinals[group.key] || group.label}>
          {many ? (
            <h3 className="trip-rule-label">
              {[ordinals[group.key], group.label].filter(Boolean).join(" / ")}
            </h3>
          ) : null}
          <ol className="map-split-list">
            {group.items.map((stop, index) => {
              const before = index > 0 ? group.items[index - 1] : undefined;
              const leg = before ? between(before, stop, legFor) : null;
              const number = numbers.get(stop.id) ?? index + 1;
              const note = [
                timeForRail(stop.time_label),
                leg?.text ?? (index === 0 ? stop.address?.split(",")[0]?.trim() : "") ?? "",
              ]
                .filter(Boolean)
                .join(" / ");
              return (
                <li key={stop.id}>
                  <button
                    id={`split-${stop.id}`}
                    type="button"
                    aria-pressed={selectedId === stop.id}
                    onClick={() => pickFromList(stop.id)}
                    className="trip-row"
                  >
                    <span className="trip-row-title">
                      {String(number).padStart(2, "0")} / {stop.title}
                    </span>
                    {note ? <span className="trip-row-note">{note}</span> : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {onDirections ? (
        <button
          type="button"
          onClick={onDirections}
          disabled={directionsBusy}
          className="trip-primary disabled:opacity-60"
        >
          {directionsBusy ? "Finding the way…" : "Get directions"}
        </button>
      ) : null}
      {model.pins.length > 0 ? <MapFootnotes model={model} brief /> : null}
    </div>
  );
}

/**
 * Live's map: the day's pins with the stop you are at, or the next one,
 * picked, so the companion card under it and the map say the same thing.
 */
export function LiveMap({
  stops,
  nesting = true,
  onLook,
}: {
  /** The followed day's stops, in order. */
  stops: ItineraryRow[];
  nesting?: boolean;
  /** Look at a pin's stop without moving Now. */
  onLook?: ((id: string) => void) | undefined;
}) {
  const model = dayMapModel(stops, { nesting });
  const { phase, current, next } = companionState(stops);
  const focus = (phase === "at" ? current : next)?.id ?? null;
  const [selectedId, setSelectedId] = useState<string | null>(focus);
  useEffect(() => setSelectedId(focus), [focus]);
  if (model.pins.length === 0) return null;
  return (
    <div className="map-split-map">
      <DayMap
        pins={model.pins}
        selectedId={selectedId}
        onSelect={(id) => {
          setSelectedId(id);
          if (id !== focus) onLook?.(id);
        }}
        label={`Map of today's ${model.pins.length === 1 ? "stop" : `${model.pins.length} stops`}`}
        heightClass="h-[280px] w-full"
        roundedClass="rounded-[var(--r-card)]"
      />
      <MapFootnotes model={model} brief />
    </div>
  );
}
