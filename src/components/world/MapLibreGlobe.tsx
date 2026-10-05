/**
 * An experimental World globe on MapLibre's globe projection (open it with
 * /world?globe=maplibre, beside the NASA one). A real vector map wrapped on a
 * sphere: sharp at any zoom, the borders and names from the same tiles as the
 * day map, a sky for the glowing rim, and the traveller's cities as one
 * GeoJSON source that `setData` redraws.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Pin } from "@/data/atlas";
import { globeSky, globeStyle, type GlobeMood } from "@/lib/globe-style";
import { labelLanguage } from "@/lib/journal-style";
import { registerBeaProtocols } from "@/lib/offline-map";
import { enableRtlText } from "@/lib/rtl-text";
import { useThemeName } from "@/hooks/useThemeName";

const PIN_PALETTE = ["#4A7BF0", "#F24A70", "#F5A524", "#9B6CF0", "#22A699"];
/** Degrees a second the globe turns while nothing is touched. */
const SPIN = 6;

function collection(pins: Pin[], selectedId: string | null | undefined) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((pin, i) => ({
      type: "Feature" as const,
      id: i,
      geometry: { type: "Point" as const, coordinates: [pin.lon, pin.lat] },
      properties: {
        id: pin.id,
        name: pin.name,
        color: PIN_PALETTE[i % PIN_PALETTE.length],
        selected: pin.id === selectedId ? 1 : 0,
      },
    })),
  };
}

export type MapLibreGlobeProps = {
  pins: Pin[];
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
  mood?: GlobeMood | undefined;
  autoRotate?: boolean | undefined;
};

export function MapLibreGlobe({
  pins,
  selectedId,
  onSelect,
  mood: moodProp,
  autoRotate,
}: MapLibreGlobeProps) {
  const theme = useThemeName();
  const mood: GlobeMood = moodProp ?? theme;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const latest = useRef({ pins, selectedId, onSelect, autoRotate });
  latest.current = { pins, selectedId, onSelect, autoRotate };

  // Make the map once, and again when the mood changes its colours.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let gone = false;
    let frame = 0;
    let instance: MapLibreMap | undefined;
    (async () => {
      const mod = await import("maplibre-gl");
      if (gone) return;
      registerBeaProtocols(mod);
      enableRtlText(mod);
      const maplibregl = "default" in mod && mod.default ? mod.default : mod;
      // A globe of diameter 0.86 of the box: the world is 512 px round at zoom 0.
      const fitZoom = Math.max(0, Math.log2((el.clientWidth * 0.86 * Math.PI) / 512));
      const first = latest.current.pins[0];
      instance = new maplibregl.Map({
        container: el,
        style: globeStyle(mood, labelLanguage(navigator.language)),
        center: first ? [first.lon, first.lat] : [10, 30],
        zoom: fitZoom,
        minZoom: fitZoom - 0.4,
        maxZoom: 8,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
      } as never);
      map.current = instance;
      instance.on("load", () => {
        if (!instance) return;
        instance.setSky(globeSky(mood) as never);
        instance.addSource("pins", {
          type: "geojson",
          data: collection(latest.current.pins, latest.current.selectedId),
        });
        instance.addLayer({
          id: "pin-ring",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 13, 9],
            "circle-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        });
        instance.addLayer({
          id: "pin-dot",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 9, 6],
            "circle-color": ["get", "color"],
          },
        });
        instance.addLayer({
          id: "pin-name",
          type: "symbol",
          source: "pins",
          layout: {
            "text-field": ["get", "name"],
            "text-font": ["Noto Sans Regular"],
            "text-size": 13,
            "text-offset": [0, 1.4],
            "text-anchor": "top",
          },
          paint: {
            "text-color": "#2b2430",
            "text-halo-color": "#ffffff",
            "text-halo-width": 2,
          },
        });
        instance.on("click", "pin-dot", (e) => {
          const id = e.features?.[0]?.properties?.["id"];
          const pin = latest.current.pins.find((p) => p.id === id);
          if (pin) latest.current.onSelect?.(pin);
        });
        instance.on("mouseenter", "pin-dot", () => {
          if (instance) instance.getCanvas().style.cursor = "pointer";
        });
        instance.on("mouseleave", "pin-dot", () => {
          if (instance) instance.getCanvas().style.cursor = "";
        });
      });
      // A gentle turn until someone touches the globe; it comes back after a pause.
      let last = performance.now();
      let touchedAt = -Infinity;
      instance.on("mousedown", () => (touchedAt = performance.now()));
      instance.on("touchstart", () => (touchedAt = performance.now()));
      instance.on("wheel", () => (touchedAt = performance.now()));
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const tick = (now: number) => {
        const dt = (now - last) / 1000;
        last = now;
        if (instance && latest.current.autoRotate && !reduced && now - touchedAt > 2500) {
          const c = instance.getCenter();
          instance.jumpTo({ center: [c.lng + SPIN * dt, c.lat] });
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    })().catch((error: unknown) => console.warn("MapLibreGlobe: could not start.", error));
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      instance?.remove();
      map.current = null;
    };
  }, [mood]);

  // New pins or a new selection: hand the source its data and turn to the pick.
  useEffect(() => {
    const m = map.current;
    const source = m?.getSource("pins") as GeoJSONSource | undefined;
    source?.setData(collection(pins, selectedId));
    const pin = pins.find((p) => p.id === selectedId);
    if (m && pin)
      m.easeTo({ center: [pin.lon, pin.lat], zoom: Math.max(m.getZoom(), 2.6), duration: 900 });
  }, [pins, selectedId]);

  return (
    <div
      ref={box}
      data-earth="maplibre"
      role="img"
      aria-label={
        pins.length === 0
          ? "A globe with no pins on it yet."
          : `A globe showing ${pins.length} pin${pins.length === 1 ? "" : "s"}.`
      }
      className="mx-auto aspect-square w-full max-w-[420px] overflow-hidden rounded-[32px]"
    />
  );
}
