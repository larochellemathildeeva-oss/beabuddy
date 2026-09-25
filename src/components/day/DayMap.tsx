import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as Leaflet from "leaflet";
import type { DayMapPin } from "@/lib/day-map";
import { curvedLeg } from "@/lib/day-map";
import { TILE_URL_TEMPLATE, TILE_ZOOM_MAX, TILE_ZOOM_MIN } from "@/lib/tile-proxy";

/** Close enough to read street names, not so close one stop fills the frame. */
const SINGLE_STOP_ZOOM = 15;
/** A fitted day stops here, so two stops across the road do not zoom to 19. */
const FIT_MAX_ZOOM = 16;
const FIT_PADDING: [number, number] = [44, 44];
/** Closer to the border than this and a selected pin is brought into view. Half a pin. */
const PIN_EDGE_MARGIN = 16;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Warm terracotta discs, numbered. The chosen one is larger and deeper, and
 * that is all it does — no bounce, no pulse, nothing that says "GPS".
 */
function pinClass(selected: boolean): string {
  return selected
    ? "journal-pin journal-pin--on grid place-items-center rounded-full font-semibold tabular-nums"
    : "journal-pin grid place-items-center rounded-full font-semibold tabular-nums";
}

/** The chosen place's name beside its pin, set like a caption in a guide. */
function nameTag(title: string, toLeft: boolean): string {
  return `<span class="journal-tag${toLeft ? " journal-tag--left" : ""}">${escapeHtml(title)}</span>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/**
 * The day's stops on a street map, moving with the list beside it.
 *
 * Leaflet reads `window` the moment it is imported, so it is loaded inside an
 * effect and never on the server; the server renders the empty frame and the
 * browser fills it. Tiles come through Béa's own `/api/tile` proxy — the same
 * one the Near map uses — so the provider token stays on the server and the
 * browser talks to nobody new.
 *
 * Pins carry the card's number rather than the title. A title on every pin is
 * unreadable on a phone once three stops share a street, and the number is
 * what joins the pin to its card, which has the rest.
 */
export function DayMap({
  pins,
  selectedId,
  onSelect,
  label,
  heightClass = "h-72",
  children,
}: {
  pins: DayMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** What the map shows, for a screen reader: it has no other text. */
  label: string;
  /** How tall the map is; the Map tab's layouts change it. */
  heightClass?: string;
  /** Laid over the map, above Leaflet's panes (the floating stop card). */
  children?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [ready, setReady] = useState(false);

  // The latest handler, so redrawing pins is not also triggered by a parent
  // that passes a fresh closure every render.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;

    void import("leaflet").then((mod) => {
      const L = (mod as { default?: typeof Leaflet }).default ?? (mod as typeof Leaflet);
      if (cancelled || !container.current) return;

      const m = L.map(container.current, {
        // Zoom stays (a map you cannot zoom is a picture) but sits quietly
        // in the corner; everything else Leaflet offers is left off.
        zoomControl: false,
        attributionControl: true,
        minZoom: TILE_ZOOM_MIN,
        maxZoom: TILE_ZOOM_MAX,
        // A map inside a scrolling page should not take the scroll wheel
        // from it; pinch and the zoom buttons still work.
        scrollWheelZoom: false,
      });
      m.attributionControl.setPrefix(false);
      L.control.zoom({ position: "topright" }).addTo(m);
      L.tileLayer(TILE_URL_TEMPLATE, {
        minZoom: TILE_ZOOM_MIN,
        maxZoom: TILE_ZOOM_MAX,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
      }).addTo(m);

      // The frame can change size without the window doing so — a tab
      // switch, the chips wrapping — and Leaflet only notices the window.
      observer = new ResizeObserver(() => m.invalidateSize());
      observer.observe(container.current);

      leaflet.current = L;
      map.current = m;
      setReady(true);
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      map.current?.remove();
      map.current = null;
      leaflet.current = null;
    };
  }, []);

  // Where the pins are, as a value, so the view is refitted when the day
  // changes and not when a parent re-renders the same day.
  const shape = pins.map((p) => `${p.id}@${p.lat},${p.lon}`).join("|");
  // Everything a pin draws, so a renamed or renumbered stop is redrawn too.
  const drawn = pins.map((p) => `${p.id}@${p.lat},${p.lon}#${p.number}:${p.title}`).join("|");

  const markers = useRef(new Map<string, Leaflet.Marker>());

  // Frame the whole day when the day changes. Declared before the drawing
  // below on purpose: effects run in order, and a Leaflet map has no view —
  // so cannot place the distance labels — until this has run once.
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m || pins.length === 0) return;
    // A layout change resizes the box; measure it before fitting to it.
    m.invalidateSize();
    const animate = !prefersReducedMotion();
    if (pins.length === 1) {
      m.setView([pins[0]!.lat, pins[0]!.lon], SINGLE_STOP_ZOOM, { animate });
    } else {
      m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number])), {
        padding: FIT_PADDING,
        maxZoom: FIT_MAX_ZOOM,
        animate,
      });
    }
  }, [ready, shape, heightClass]); // eslint-disable-line react-hooks/exhaustive-deps -- `shape` stands for `pins`

  // Pins, route and distances.
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m) return;

    const layer = L.layerGroup().addTo(m);
    const byId = markers.current;

    // The day as a story: each stop joined to the next by a soft dotted arc
    // in the accent colour. Not the streets, not a route to follow — the
    // itinerary is the source of truth, and this only says "then here".
    for (let i = 0; i < pins.length - 1; i++) {
      L.polyline(curvedLeg(pins[i]!, pins[i + 1]!, i), {
        className: "journal-route",
        color: "#d96b43",
        weight: 2.5,
        opacity: 0.9,
        dashArray: "0.5 7",
        lineCap: "round",
        lineJoin: "round",
        interactive: false,
        smoothFactor: 0,
      }).addTo(layer);
    }

    for (const pin of pins) {
      const marker = L.marker([pin.lat, pin.lon], {
        icon: L.divIcon({
          className: "",
          iconSize: [34, 34],
          iconAnchor: [17, 17],
          // The number is an integer this file made, but escape it anyway:
          // this string becomes markup.
          html: `<span class="${pinClass(false)}">${escapeHtml(String(pin.number))}</span>`,
        }),
        // Leaflet sets these as properties, not markup, so a title with
        // angle brackets stays text.
        title: `${pin.number}. ${pin.title}`,
        alt: `${pin.number}. ${pin.title}`,
        keyboard: true,
        riseOnHover: true,
      })
        .on("click", () => select.current(pin.id))
        // Leaflet gives a pin role="button" and a tab stop, but no key
        // handling, so Enter and Space would otherwise do nothing.
        .on("keydown", (e: Leaflet.LeafletKeyboardEvent) => {
          const key = e.originalEvent.key;
          if (key !== "Enter" && key !== " ") return;
          e.originalEvent.preventDefault();
          select.current(pin.id);
        })
        .addTo(layer);
      byId.set(pin.id, marker);
    }

    return () => {
      layer.remove();
      byId.clear();
    };
  }, [ready, drawn]); // eslint-disable-line react-hooks/exhaustive-deps -- `drawn` stands for `pins`

  // Mark the chosen pin by restyling it in place. Redrawing it would move
  // keyboard focus off the pin someone just pressed Enter on.
  const tag = useRef<Leaflet.Marker | null>(null);
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m) return;
    for (const [id, marker] of markers.current) {
      const on = id === selectedId;
      const face = marker.getElement()?.firstElementChild;
      if (face) face.className = pinClass(on);
      marker.setZIndexOffset(on ? 1000 : 0);
    }
    // Only the chosen place is named on the map; the rest are numbers that
    // match the list. A name on every pin is a map product, not a guide.
    const pin = pins.find((p) => p.id === selectedId);
    if (pin) {
      // On the side with room, so a pin near the right edge is not named
      // off the map.
      const at = m.latLngToContainerPoint([pin.lat, pin.lon]);
      const toLeft = at.x > m.getSize().x * 0.55;
      tag.current = L.marker([pin.lat, pin.lon], {
        interactive: false,
        keyboard: false,
        zIndexOffset: 900,
        icon: L.divIcon({ className: "", iconSize: [0, 0], html: nameTag(pin.title, toLeft) }),
      }).addTo(m);
    }
    return () => {
      tag.current?.remove();
      tag.current = null;
    };
  }, [ready, drawn, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- `drawn` stands for `pins`

  // Bring the chosen stop into view without losing the zoom the reader chose.
  useEffect(() => {
    const m = map.current;
    if (!ready || !m || !selectedId) return;
    const pin = pins.find((p) => p.id === selectedId);
    if (!pin) return;
    const target: [number, number] = [pin.lat, pin.lon];
    // Only when the pin is actually at or past the edge. A fitted day puts
    // its outermost pins FIT_PADDING in from the border, and an earlier
    // "inner 70%" test counted those as out of view — so choosing the first
    // or last stop recentred the map and pushed the rest of the day off it.
    const at = m.latLngToContainerPoint(target);
    const size = m.getSize();
    const margin = PIN_EDGE_MARGIN;
    if (at.x < margin || at.y < margin || at.x > size.x - margin || at.y > size.y - margin) {
      m.panTo(target, { animate: !prefersReducedMotion() });
    }
  }, [ready, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- follows selection only

  return (
    // `isolate` keeps Leaflet's pane z-indexes (400 and up) inside this box,
    // so the map cannot draw over the app header or the bottom navigation.
    <div
      role="region"
      aria-label={label}
      className={`journal-map relative isolate overflow-hidden rounded-3xl ${heightClass}`}
    >
      <div ref={container} className="absolute inset-0" />
      {children}
    </div>
  );
}
