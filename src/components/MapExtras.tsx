import { Bus, Car, ChevronRight, Globe, Plane, Train } from "@/components/icons";
import { PlacePicture } from "@/components/PlacePicture";
import type { ComponentType } from "react";
import type { TransportMode } from "@/lib/trip-overview";
import { formatTimelineDayLabel } from "@/lib/timeline-groups";

const MODES: {
  value: TransportMode | "all";
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: "all", label: "All", icon: Globe },
  { value: "flight", label: "Flights", icon: Plane },
  { value: "train", label: "Trains", icon: Train },
  { value: "bus", label: "Bus", icon: Bus },
  { value: "car", label: "Cars", icon: Car },
];

/** The map's "which way" row (Figma trip map): every journey, or one way of going. */
export function TransportFilter({
  value,
  onChange,
}: {
  value: TransportMode | "all";
  onChange: (mode: TransportMode | "all") => void;
}) {
  return (
    <div role="radiogroup" aria-label="Show journeys by" className="map-modes">
      {MODES.map(({ value: mode, label, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className="map-mode"
        >
          <Icon className="size-5" aria-hidden />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

/** "Next stop · Osaka · Apr 7 · In 2 days": the card under the map. */
export function NextStopCard({
  stop,
  inDays,
  onOpen,
}: {
  stop: {
    title: string;
    day_date: string | null;
    kind?: string | null;
    lat?: number | null;
    lon?: number | null;
  };
  inDays: number;
  onOpen: () => void;
}) {
  const when = inDays <= 0 ? "Today" : inDays === 1 ? "Tomorrow" : `In ${inDays} days`;
  return (
    <button type="button" onClick={onOpen} className="map-next">
      <PlacePicture
        name={stop.title}
        kind={stop.kind}
        lat={stop.lat}
        lon={stop.lon}
        className="map-next-art"
      />
      <span className="map-next-text">
        <span className="map-next-kicker">Next stop</span>
        <span className="map-next-title">{stop.title}</span>
        <span className="map-next-when">
          {[stop.day_date ? formatTimelineDayLabel(stop.day_date) : "", when]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <ChevronRight className="size-4 shrink-0" aria-hidden />
    </button>
  );
}
