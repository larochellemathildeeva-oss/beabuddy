import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, LocateFixed, MapIcon, ListOrdered } from "@/components/icons";
import { TRIP_PERSPECTIVES, type TripPerspective } from "@/lib/trip-perspective";
import { BAR_POSITIONS, type TripBarPosition } from "@/hooks/useTripBarPosition";
import { TRIP_PICTURES, type TripPicture } from "@/lib/trip-picture";

const icons = { overview: Columns2, companion: LocateFixed, map: MapIcon, timeline: ListOrdered };

export function TripViews({
  position,
  value,
  onChange,
}: {
  position: TripBarPosition;
  value: TripPerspective;
  onChange: (value: TripPerspective) => void;
}) {
  const anchor = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState({ left: 0, width: 0, bottom: 0, top: 0, height: 0 });
  useEffect(() => {
    const main = anchor.current?.closest<HTMLElement>('[data-scroll-restoration-id="app-main"]');
    const measure = () => {
      const r = main?.getBoundingClientRect();
      anchor.current
        ?.closest<HTMLElement>(".trip-shell")
        ?.style.setProperty(
          "--trip-sticky-offset",
          `${position === "top" ? anchor.current.getBoundingClientRect().height : 0}px`,
        );
      setBounds({
        left: r?.left ?? 0,
        width: r?.width ?? innerWidth,
        bottom: innerHeight - (r?.bottom ?? innerHeight),
        top: r?.top ?? 0,
        height: r?.height ?? innerHeight,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (main) observer.observe(main);
    if (anchor.current) observer.observe(anchor.current);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [position]);
  const floating = position !== "top";
  const nav = (
    <nav
      data-guide="trip-tabs"
      data-trip-bar={position}
      role="tablist"
      aria-label="How to look at this trip"
      className={`trip-views trip-views--${position}`}
      style={
        floating
          ? position === "bottom"
            ? { left: bounds.left + 12, width: bounds.width - 24, bottom: bounds.bottom + 8 }
            : {
                left: bounds.left + bounds.width - 68,
                top: bounds.top + bounds.height / 2,
                transform: "translateY(-50%)",
              }
          : undefined
      }
    >
      {TRIP_PERSPECTIVES.map((p) => {
        const Icon = icons[p.id];
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === value}
            aria-label={p.label}
            title={p.label}
            onClick={() => onChange(p.id)}
          >
            <Icon className="size-5 shrink-0" aria-hidden />
            {position !== "side" && <span>{p.label}</span>}
          </button>
        );
      })}
    </nav>
  );
  return (
    <div
      ref={anchor}
      className={
        position === "top" ? "sticky top-0 z-40 px-3 py-2 bg-background/95 backdrop-blur-xl" : "h-0"
      }
    >
      {floating && bounds.width ? createPortal(nav, document.body) : !floating ? nav : null}
    </div>
  );
}

export function TripBarOptions({
  value,
  onChange,
}: {
  value: TripBarPosition;
  onChange: (value: TripBarPosition) => void;
}) {
  return (
    <fieldset className="py-3">
      <legend className="text-[16px] font-semibold">Views bar</legend>
      <p className="mb-2 text-[13px] text-muted-foreground">Position on this device.</p>
      <div
        role="group"
        aria-label="Views bar position"
        className="flex gap-1 rounded-full bg-elevated p-1"
      >
        {BAR_POSITIONS.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={`min-h-11 flex-1 rounded-full px-3 text-[16px] ${value === p ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
          >
            {p.charAt(0).toUpperCase() + p.slice(1)}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function TripPictureOptions({
  value,
  onChange,
}: {
  value: TripPicture;
  onChange: (value: TripPicture) => void;
}) {
  return (
    <fieldset className="py-3">
      <legend className="text-[16px] font-semibold">Trip picture</legend>
      <p className="mb-2 text-[13px] text-muted-foreground">
        The trip&apos;s stops on a map, or a photo of the place. On this device.
      </p>
      <div
        role="group"
        aria-label="Trip picture"
        className="flex gap-1 rounded-full bg-elevated p-1"
      >
        {TRIP_PICTURES.map((p) => (
          <button
            key={p}
            type="button"
            aria-pressed={value === p}
            onClick={() => onChange(p)}
            className={`min-h-11 flex-1 rounded-full px-3 text-[16px] ${value === p ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground"}`}
          >
            {p === "stops" ? "Stops" : "Photo"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
