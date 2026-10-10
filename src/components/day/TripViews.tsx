import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Columns2, LocateFixed, MapIcon, ListOrdered } from "@/components/icons";
import { TRIP_PERSPECTIVES, TRIP_TABS, tabOf, type TripPerspective } from "@/lib/trip-perspective";
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
      {TRIP_PERSPECTIVES.filter((p) => TRIP_TABS.includes(p.id)).map((p) => {
        const Icon = icons[p.id];
        return (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={p.id === tabOf(value)}
            aria-label={p.label}
            title={p.label}
            // Map keeps the live Companion side when that is where you were.
            onClick={() => onChange(p.id === "map" && value === "companion" ? "companion" : p.id)}
          >
            {/* On top the design draws words only (Figma "Ruled tabs"). */}
            {position !== "top" && <Icon className="size-5 shrink-0" aria-hidden />}
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
        position === "top" ? "sticky top-0 z-40 px-5 pt-3 bg-background/95 backdrop-blur-xl" : "h-0"
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
  // As Figma "trip-customize" (116:1667): "Views bar: Top" and the others
  // as rows with a dot, the chosen one darker.
  return (
    <div role="radiogroup" aria-label="Views bar position" className="dir-group">
      {BAR_POSITIONS.map((p, i) => (
        <button
          key={p}
          type="button"
          role="radio"
          aria-checked={value === p}
          // One stop in the tab order; the arrows move between the three.
          tabIndex={value === p ? 0 : -1}
          title="Position on this device"
          onClick={() => onChange(p)}
          onKeyDown={(event) => {
            const step =
              event.key === "ArrowDown" || event.key === "ArrowRight"
                ? 1
                : event.key === "ArrowUp" || event.key === "ArrowLeft"
                  ? -1
                  : 0;
            if (!step) return;
            event.preventDefault();
            const next = (i + step + BAR_POSITIONS.length) % BAR_POSITIONS.length;
            onChange(BAR_POSITIONS[next]!);
            const group = event.currentTarget.parentElement;
            requestAnimationFrame(() =>
              group?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus(),
            );
          }}
          className="dir-choice"
        >
          <span aria-hidden className="dir-dot" />
          <span>Views bar: {p.charAt(0).toUpperCase() + p.slice(1)}</span>
        </button>
      ))}
    </div>
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

/**
 * Live | Split, under the Map tab. Live is the companion card (where you
 * are, what is next, when to leave) with the day's map; Split is the map with
 * the day as a short timeline. The ids stay "companion" and "map".
 */
export function MapModeSwitch({
  value,
  onChange,
}: {
  value: TripPerspective;
  onChange: (value: TripPerspective) => void;
}) {
  return (
    <div role="group" aria-label="Live or Split" className="map-mode mb-3">
      {(
        [
          ["companion", "Live"],
          ["map", "Split"],
        ] as const
      ).map(([id, label]) => (
        <button key={id} type="button" aria-pressed={value === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </div>
  );
}
