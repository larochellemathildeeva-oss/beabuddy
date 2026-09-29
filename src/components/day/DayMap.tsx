import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type * as Leaflet from "leaflet";
import type { DayMapPin, PinTone } from "@/lib/day-map";
import { curvedLeg } from "@/lib/day-map";
import { TILE_URL_TEMPLATE, TILE_ZOOM_MAX, TILE_ZOOM_MIN } from "@/lib/tile-proxy";
import { GEOAPIFY_ATTRIBUTION } from "@/lib/geo-endpoints";
import { journalStyle, labelLanguage } from "@/lib/journal-style";
import { onVectorTrouble, registerBeaProtocols, vectorMapAvailable } from "@/lib/offline-map";
import { enableRtlText } from "@/lib/rtl-text";
import {
  accuracyRadius,
  farFromDay,
  framesWithDay,
  hereBesideDay,
  lonsBeside,
} from "@/lib/live-location";
import { startLiveLocation, stopLiveLocation, useLiveLocation } from "@/hooks/useLiveLocation";
import { LocateFixed } from "@/components/icons";

/** OpenFreeMap's credit, as it asks for it: linked, beside OpenMapTiles'. */
const OPENFREEMAP_CREDIT =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>';
const OSM_CREDIT =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors';

/** Close enough to read street names, not so close one stop fills the frame. */
const SINGLE_STOP_ZOOM = 15;
/** A fitted day stops here, so two stops across the road do not zoom to 19. */
const FIT_MAX_ZOOM = 16;
const FIT_PADDING: [number, number] = [44, 44];
/** Closer to the border than this and a selected pin is brought into view. Half a pin. */
const PIN_EDGE_MARGIN = 16;
/** How close Focus brings a stop: its street, with the next few around it. */
const FOLLOW_ZOOM = 15;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Discs in the theme accent, numbered. The chosen one is larger and deeper, and
 * that is all it does — no bounce, no pulse, nothing that says "GPS".
 */
function pinClass(selected: boolean, tone: PinTone, nested = false): string {
  return `journal-pin journal-pin--${tone}${nested ? " journal-pin--nested" : ""}${selected ? " journal-pin--on" : ""} grid place-items-center rounded-full font-semibold tabular-nums`;
}

/** "+2": things to see inside the stop, listed on its card. */
function insideBadge(count: number): string {
  return count > 0 ? `<span class="journal-pin-badge">+${count}</span>` : "";
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
 * browser fills it. The base map is vector tiles in the journal style where
 * they can be had (`/api/vtile`, read from the trip's saved copy first), and
 * image tiles through `/api/tile` — the same proxy the Near map uses —
 * otherwise. Either way the provider key stays on the server and the browser
 * talks to nobody new.
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
  follow = false,
  fitSignal = 0,
  insetBottom = 0,
  roundedClass = "rounded-3xl",
  children,
}: {
  pins: DayMapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** What the map shows, for a screen reader: it has no other text. */
  label: string;
  /** How tall the map is; the Map tab's layouts change it. */
  heightClass?: string;
  /**
   * Focus: the map travels to each chosen stop, and back to the whole day
   * when nothing is chosen. Otherwise a choice only nudges a pin that is
   * off the edge into view.
   */
  follow?: boolean;
  /** Bumped by the parent's "Fit route" button to frame the whole day again. */
  fitSignal?: number;
  /** Pixels at the bottom covered by something laid over the map. */
  insetBottom?: number;
  roundedClass?: string;
  /** Laid over the map, above Leaflet's panes (the floating stop card). */
  children?: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const leaflet = useRef<typeof Leaflet | null>(null);
  const map = useRef<Leaflet.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [vector, setVector] = useState(false);

  // The latest handler, so redrawing pins is not also triggered by a parent
  // that passes a fresh closure every render.
  const select = useRef(onSelect);
  select.current = onSelect;

  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | null = null;
    let stopWatching: (() => void) | null = null;

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
      // Vector tiles where they can be had — sharp at every zoom, and what
      // "Keep offline" saves — and the image tiles otherwise: no Geoapify
      // key, no WebGL, or a server that is not answering. The pins do not
      // wait for either; they are Leaflet's, above whichever base is drawn.
      const imageTiles = () =>
        L.tileLayer(TILE_URL_TEMPLATE, {
          minZoom: TILE_ZOOM_MIN,
          maxZoom: TILE_ZOOM_MAX,
          attribution: OSM_CREDIT,
        }).addTo(m);
      void vectorMapAvailable().then(async (vector) => {
        if (cancelled) return;
        if (vector) {
          try {
            const [maplibregl, { MaplibreGL }] = await Promise.all([
              import("maplibre-gl"),
              import("@maplibre/maplibre-gl-leaflet"),
            ]);
            if (cancelled || map.current !== m) return;
            registerBeaProtocols(maplibregl);
            enableRtlText(maplibregl);
            const style = journalStyle(labelLanguage(navigator.language));
            const base = new MaplibreGL({ style, attributionControl: false }).addTo(m);
            const credit = `${OPENFREEMAP_CREDIT} · ${OSM_CREDIT} · ${GEOAPIFY_ATTRIBUTION}`;
            m.attributionControl.addAttribution(credit);
            setVector(true);
            // The server started refusing tiles or fonts after the first
            // check passed: put the image tiles back, once, rather than
            // leave squares or labels missing.
            stopWatching = onVectorTrouble(() => {
              stopWatching?.();
              stopWatching = null;
              if (cancelled || map.current !== m) return;
              m.removeLayer(base);
              m.attributionControl.removeAttribution(credit);
              imageTiles();
              setVector(false);
            });
            return;
          } catch (error) {
            console.error(error);
            if (cancelled || map.current !== m) return;
          }
        }
        imageTiles();
      });

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
      stopWatching?.();
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
  const drawn = pins
    .map(
      (p) =>
        `${p.id}@${p.lat},${p.lon}#${p.number}:${p.title}:${p.tone}:${p.insideCount}:${p.nested}`,
    )
    .join("|");

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
    // Focus with a stop chosen frames that stop instead, below — but the
    // map needs some view before the name tag can be placed, so a map
    // opening on a stop starts on it.
    const followed = follow ? pins.find((p) => p.id === selectedId) : undefined;
    if (followed) {
      if (!Number.isFinite(m.getZoom() as number | undefined)) {
        const at = m.project([followed.lat, followed.lon], FOLLOW_ZOOM).add([0, insetBottom / 2]);
        m.setView(m.unproject(at, FOLLOW_ZOOM), FOLLOW_ZOOM, { animate: false });
      }
      return;
    }
    const animate = !prefersReducedMotion();
    if (pins.length === 1) {
      m.setView([pins[0]!.lat, pins[0]!.lon], SINGLE_STOP_ZOOM, { animate });
    } else {
      m.fitBounds(L.latLngBounds(pins.map((p) => [p.lat, p.lon] as [number, number])), {
        paddingTopLeft: FIT_PADDING,
        paddingBottomRight: [FIT_PADDING[0], FIT_PADDING[1] + insetBottom],
        maxZoom: FIT_MAX_ZOOM,
        animate,
      });
    }
  }, [ready, shape, heightClass, fitSignal, follow && !selectedId]); // eslint-disable-line react-hooks/exhaustive-deps -- `shape` stands for `pins`

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
          html: `<span class="${pinClass(false, pin.tone, pin.nested)}">${escapeHtml(String(pin.number))}</span>${insideBadge(pin.insideCount)}`,
        }),
        // Leaflet sets these as properties, not markup, so a title with
        // angle brackets stays text.
        title: `${pin.number}. ${pin.title}${pin.insideCount ? `, ${pin.insideCount} inside` : ""}`,
        alt: `${pin.number}. ${pin.title}${pin.insideCount ? `, ${pin.insideCount} inside` : ""}`,
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
      const drawnPin = pins.find((p) => p.id === id);
      if (face) face.className = pinClass(on, drawnPin?.tone ?? "sight", drawnPin?.nested);
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
    if (follow) {
      // Centre the stop in the part of the map the card leaves uncovered.
      // A map opened on a stop has no view yet: Leaflet's zoom is unset
      // and it cannot fly from nowhere, so the first frame is set outright.
      const current = m.getZoom() as number | undefined;
      const hasView = typeof current === "number" && Number.isFinite(current);
      const zoom = hasView ? Math.max(current, FOLLOW_ZOOM) : FOLLOW_ZOOM;
      const centre = m.unproject(m.project(target, zoom).add([0, insetBottom / 2]), zoom);
      if (!hasView || prefersReducedMotion()) m.setView(centre, zoom, { animate: false });
      else m.flyTo(centre, zoom, { duration: 0.6 });
      return;
    }
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
  }, [ready, selectedId, follow]); // eslint-disable-line react-hooks/exhaustive-deps -- follows selection only

  // You, when asked for: a dot where the phone is, with its accuracy around
  // it. The first position frames you with the day when you are near it;
  // after that the map is left where the reader puts it. Far from the day the
  // map does not move at all, and says how far you are instead: moving it
  // would ask the tile server for the squares around you.
  const live = useLiveLocation();
  const framedHere = useRef(false);
  const [farM, setFarM] = useState<number | null>(null);
  useEffect(() => {
    if (live.on) return;
    framedHere.current = false;
    setFarM(null);
  }, [live.on]);
  useEffect(() => {
    const L = leaflet.current;
    const m = map.current;
    if (!ready || !L || !m || !live.fix) return;
    const { at: fix, nearestM } = hereBesideDay(live.fix, pins);
    const near = framesWithDay(nearestM);
    setFarM(near ? null : nearestM);
    if (!near) return;

    const layer = L.layerGroup().addTo(m);
    const radius = accuracyRadius(fix);
    if (radius > 0) {
      L.circle([fix.lat, fix.lon], {
        radius,
        className: "journal-here-accuracy",
        interactive: false,
      }).addTo(layer);
    }
    L.marker([fix.lat, fix.lon], {
      interactive: false,
      keyboard: false,
      zIndexOffset: 800,
      icon: L.divIcon({
        className: "",
        iconSize: [18, 18],
        iconAnchor: [9, 9],
        html: `<span class="journal-here${live.stale ? " journal-here--stale" : ""}" aria-hidden="true"></span>`,
      }),
    }).addTo(layer);

    if (!framedHere.current) {
      framedHere.current = true;
      const points = [...lonsBeside(pins, fix), fix].map((p) => [p.lat, p.lon] as [number, number]);
      m.fitBounds(L.latLngBounds(points), {
        paddingTopLeft: FIT_PADDING,
        paddingBottomRight: [FIT_PADDING[0], FIT_PADDING[1] + insetBottom],
        maxZoom: FIT_MAX_ZOOM,
        animate: !prefersReducedMotion(),
      });
    }
    return () => {
      layer.remove();
    };
  }, [ready, live.fix, live.stale, shape]); // eslint-disable-line react-hooks/exhaustive-deps -- `shape` stands for `pins`

  const hereNote = live.error
    ? live.error
    : farM !== null
      ? farFromDay(farM)
      : live.stale
        ? "Your location hasn't updated for a while. The dot shows where you last were."
        : "";

  return (
    // `isolate` keeps Leaflet's pane z-indexes (400 and up) inside this box,
    // so the map cannot draw over the app header or the bottom navigation.
    <div
      role="region"
      aria-label={label}
      className={`journal-map${vector ? " journal-map--vector" : ""} relative isolate overflow-hidden ${roundedClass} ${heightClass}`}
    >
      <div ref={container} className="absolute inset-0" />
      {children}
      {/* Under the zoom buttons, centred on them. */}
      <button
        type="button"
        onClick={() => (live.on ? stopLiveLocation() : startLiveLocation())}
        aria-pressed={live.on}
        aria-label={live.on ? "Stop showing where I am" : "Show where I am"}
        title={live.on ? "Stop showing where I am" : "Show where I am"}
        className={`absolute right-[5px] top-[78px] z-[500] grid size-10 place-items-center rounded-full shadow-[0_1px_3px_rgb(68_61_54/0.2)] backdrop-blur-sm ${
          live.on ? "bg-[#3f6f9a] text-white" : "bg-[rgb(248_245_241/0.95)] text-[#443d36]"
        }`}
      >
        <LocateFixed
          className={`size-4${live.locating ? " animate-pulse motion-reduce:animate-none" : ""}`}
          aria-hidden
        />
      </button>
      {hereNote ? (
        <p
          role="status"
          className="absolute right-[52px] top-[78px] z-[500] max-w-[15rem] rounded-2xl bg-[rgb(248_245_241/0.97)] px-3 py-2 text-[12px] leading-snug text-[#443d36] shadow-[0_1px_3px_rgb(68_61_54/0.2)]"
        >
          {hereNote}
        </p>
      ) : null}
    </div>
  );
}
