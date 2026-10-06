/**
 * An experimental World globe on MapLibre's globe projection (open it with
 * /world?globe=maplibre, beside the NASA one). A real vector map wrapped on a
 * sphere: sharp at any zoom, the borders and names from the same tiles as the
 * day map, a sky for the glowing rim, visited countries and provinces shaded,
 * and the traveller's cities as one GeoJSON source that `setData` redraws.
 */
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";
import { geoContains } from "d3-geo";
import type { Feature, Geometry, GeoJsonProperties } from "geojson";
import type { Map as MapLibreMap, GeoJSONSource } from "maplibre-gl";
import type { Pin } from "@/data/atlas";
import { Pause, Play } from "@/components/icons";
import { countryKey } from "@/lib/country-names";
import { GEOAPIFY_ATTRIBUTION } from "@/lib/geo-endpoints";
import { GLOBE_PALETTES, globeSky, globeStyle, type GlobeMood } from "@/lib/globe-style";
import { labelLanguage } from "@/lib/journal-style";
import { OPENFREEMAP_CREDIT, OSM_CREDIT } from "@/lib/map-credits";
import { onVectorTrouble, registerBeaProtocols } from "@/lib/offline-map";
import { enableRtlText } from "@/lib/rtl-text";
import { useThemeName } from "@/hooks/useThemeName";
import { coarseWorld, loadDetailedWorld, pinCountryKeys, type WorldGeo } from "./world-geo";

const PIN_PALETTE = ["#4A7BF0", "#F24A70", "#F5A524", "#9B6CF0", "#22A699"];
/** Degrees a second the globe turns while nothing is touched. */
const SPIN = 6;
/** Seconds after the last touch before the gentle turn comes back. */
const RESUME_MS = 2500;
/** A pin's tappable circle, in CSS pixels: 44 across. */
const HIT_RADIUS = 22;

type Region = { id: string; name: string; feature: Feature<Geometry, GeoJsonProperties> };

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

function reducedMotion(): boolean {
  return !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

export type MapLibreGlobeProps = {
  pins: Pin[];
  regions?: Region[] | undefined;
  visitedCountries?: ReadonlySet<string> | undefined;
  shadePinCountries?: boolean | undefined;
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
  onCountrySelect?: ((countryName: string) => void) | undefined;
  mood?: GlobeMood | undefined;
  autoRotate?: boolean | undefined;
  spinToggle?: { on: boolean; onChange: (on: boolean) => void } | undefined;
  /** The vector tiles stopped answering: the page puts the NASA globe back. */
  onFail?: (() => void) | undefined;
};

export function MapLibreGlobe({
  pins,
  regions,
  visitedCountries,
  shadePinCountries,
  selectedId,
  onSelect,
  onCountrySelect,
  mood: moodProp,
  autoRotate,
  spinToggle,
  onFail,
}: MapLibreGlobeProps) {
  const theme = useThemeName();
  const mood: GlobeMood = moodProp ?? theme;
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  // Counts each time a map finishes loading, so data and selection are applied to the new one.
  const [loaded, setLoaded] = useState(0);
  const [geo, setGeo] = useState<WorldGeo>(coarseWorld);
  const geoRef = useRef(geo);
  geoRef.current = geo;
  const latest = useRef({ pins, selectedId, onSelect, onCountrySelect, autoRotate, onFail });
  latest.current = { pins, selectedId, onSelect, onCountrySelect, autoRotate, onFail };

  useEffect(() => {
    let live = true;
    loadDetailedWorld().then(
      (g) => live && setGeo(g),
      () => {},
    );
    return () => {
      live = false;
    };
  }, []);

  // The vector map stopped working on this page: hand the page back to the NASA globe.
  useEffect(() => onVectorTrouble(() => latest.current.onFail?.()), []);

  // Make the map once, and again when the mood changes its colours.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let gone = false;
    let frame = 0;
    let instance: MapLibreMap | undefined;
    let visible = true;
    let interacting = false;
    let touchedAt = -Infinity;
    let last = performance.now();
    const cleanups: (() => void)[] = [];

    const tick = (now: number) => {
      frame = 0;
      const dt = (now - last) / 1000;
      last = now;
      if (
        instance &&
        latest.current.autoRotate &&
        !reducedMotion() &&
        !interacting &&
        now - touchedAt > RESUME_MS
      ) {
        const c = instance.getCenter();
        instance.jumpTo({ center: [c.lng + SPIN * dt, c.lat] });
      }
      run();
    };
    // Only turn while the globe is on screen and the tab is showing.
    const run = () => {
      if (frame || gone || !visible || document.hidden) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    (async () => {
      const mod = await import("maplibre-gl");
      if (gone) return;
      registerBeaProtocols(mod);
      enableRtlText(mod);
      const maplibregl = "default" in mod && mod.default ? mod.default : mod;
      // A globe of diameter 0.86 of the box: the world is 512 px round at zoom 0.
      const fitZoom = Math.max(0, Math.log2((el.clientWidth * 0.86 * Math.PI) / 512));
      const start =
        latest.current.pins.find((p) => p.id === latest.current.selectedId) ??
        latest.current.pins[0];
      const m = new maplibregl.Map({
        container: el,
        style: globeStyle(mood, labelLanguage(navigator.language)),
        center: start ? [start.lon, start.lat] : [10, 30],
        zoom: fitZoom,
        minZoom: fitZoom - 0.4,
        maxZoom: 8,
        attributionControl: false,
        pitchWithRotate: false,
        dragRotate: false,
        touchPitch: false,
      } as never);
      instance = m;
      map.current = m;
      m.addControl(
        new maplibregl.AttributionControl({
          compact: true,
          customAttribution: [OPENFREEMAP_CREDIT, OSM_CREDIT, GEOAPIFY_ATTRIBUTION],
        }),
        "bottom-right",
      );
      const p = GLOBE_PALETTES[mood];
      m.on("load", () => {
        m.setSky(globeSky(mood) as never);
        m.addSource("visited", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addSource("regions", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        m.addSource("pins", { type: "geojson", data: collection([], null) });
        m.addLayer({
          id: "visited-fill",
          type: "fill",
          source: "visited",
          paint: { "fill-color": p.shade, "fill-opacity": 0.38 },
        });
        m.addLayer({
          id: "region-fill",
          type: "fill",
          source: "regions",
          paint: { "fill-color": p.shade, "fill-opacity": 0.3 },
        });
        m.addLayer({
          id: "region-line",
          type: "line",
          source: "regions",
          paint: { "line-color": p.shade, "line-width": 1.2 },
        });
        m.addLayer({
          id: "pin-ring",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 13, 9],
            "circle-color": "#ffffff",
            "circle-opacity": 0.95,
          },
        });
        m.addLayer({
          id: "pin-dot",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": ["case", ["==", ["get", "selected"], 1], 9, 6],
            "circle-color": ["get", "color"],
          },
        });
        // A 44 px target round every pin, invisible, so a thumb can hit it.
        m.addLayer({
          id: "pin-hit",
          type: "circle",
          source: "pins",
          paint: {
            "circle-radius": HIT_RADIUS,
            "circle-color": "#000000",
            "circle-opacity": 0.001,
          },
        });
        m.addLayer({
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
          paint: { "text-color": p.ink, "text-halo-color": p.halo, "text-halo-width": 2 },
        });
        m.on("click", (e) => {
          const hit = m.queryRenderedFeatures(e.point, { layers: ["pin-hit"] })[0];
          const id = hit?.properties?.["id"];
          const pin = latest.current.pins.find((q) => q.id === id);
          if (pin) {
            latest.current.onSelect?.(pin);
            return;
          }
          const at: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          const country = geoRef.current.world.features.find(
            (f) => f.properties?.name && geoContains(f, at),
          );
          if (country?.properties?.name) latest.current.onCountrySelect?.(country.properties.name);
        });
        m.on("mousemove", (e) => {
          const over = m.queryRenderedFeatures(e.point, { layers: ["pin-hit"] }).length > 0;
          m.getCanvas().style.cursor = over ? "pointer" : "";
        });
        setLoaded((n) => n + 1);
      });

      // A turn that waits for a finger to lift, then a pause before it resumes.
      const down = () => (interacting = true);
      const up = () => {
        if (!interacting) return;
        interacting = false;
        touchedAt = performance.now();
      };
      const wheel = () => (touchedAt = performance.now());
      el.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      el.addEventListener("wheel", wheel, { passive: true });
      cleanups.push(() => {
        el.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        el.removeEventListener("wheel", wheel);
      });

      // Follow the box when the layout changes without the window resizing.
      const resize = new ResizeObserver(() => m.resize());
      resize.observe(el);
      cleanups.push(() => resize.disconnect());
      const seen = new IntersectionObserver((entries) => {
        visible = entries.some((entry) => entry.isIntersecting);
        run();
      });
      seen.observe(el);
      cleanups.push(() => seen.disconnect());
      const shown = () => run();
      document.addEventListener("visibilitychange", shown);
      cleanups.push(() => document.removeEventListener("visibilitychange", shown));
      run();
    })().catch((error: unknown) => {
      console.warn("MapLibreGlobe: could not start.", error);
      latest.current.onFail?.();
    });
    return () => {
      gone = true;
      cancelAnimationFrame(frame);
      for (const undo of cleanups) undo();
      instance?.remove();
      map.current = null;
    };
  }, [mood]);

  // Visited countries and provinces, and the pins: hand the sources their data.
  useEffect(() => {
    const m = map.current;
    if (!m || !m.getSource("pins")) return;
    const keys = shadePinCountries ? pinCountryKeys(pins) : new Set<string>();
    for (const key of visitedCountries ?? []) keys.add(key);
    (m.getSource("visited") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: geo.world.features.filter(
        (f) => f.properties?.name && keys.has(countryKey(f.properties.name)),
      ),
    } as never);
    (m.getSource("regions") as GeoJSONSource).setData({
      type: "FeatureCollection",
      features: (regions ?? []).map((r) => r.feature),
    } as never);
    (m.getSource("pins") as GeoJSONSource).setData(collection(pins, selectedId));
  }, [pins, selectedId, regions, visitedCountries, shadePinCountries, geo, loaded]);

  // Turn to the chosen city, at once when motion is reduced.
  useEffect(() => {
    const m = map.current;
    const pin = pins.find((p) => p.id === selectedId);
    if (!m || !pin) return;
    const to = { center: [pin.lon, pin.lat] as [number, number], zoom: Math.max(m.getZoom(), 2.6) };
    if (reducedMotion()) m.jumpTo(to);
    else m.easeTo({ ...to, duration: 900 });
    // Only a new choice moves the camera, not new data for the same one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, loaded]);

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[420px]">
      <div
        ref={box}
        data-earth="maplibre"
        role="group"
        aria-label={
          pins.length === 0
            ? "A globe with no pins on it yet."
            : `A globe showing ${pins.length} pin${pins.length === 1 ? "" : "s"}. Drag to turn it; the cities are listed below it.`
        }
        className="size-full overflow-hidden rounded-[32px]"
      />
      {/* The same cities as buttons, for a keyboard or a screen reader. */}
      <ul className="sr-only">
        {pins.map((pin) => (
          <li key={pin.id}>
            <button
              type="button"
              aria-pressed={pin.id === selectedId}
              onClick={() => onSelect?.(pin)}
            >
              {pin.name}
              {pin.country ? `, ${pin.country}` : ""}
            </button>
          </li>
        ))}
      </ul>
      {spinToggle && (
        <button
          type="button"
          aria-label={spinToggle.on ? "Stop the globe turning" : "Let the globe turn"}
          aria-pressed={spinToggle.on}
          title={spinToggle.on ? "Stop turning" : "Turn on its own"}
          className="absolute bottom-3 left-3 grid size-11 place-items-center rounded-full bg-(--card) text-(--foreground) shadow"
          onClick={() => spinToggle.onChange(!spinToggle.on)}
        >
          {spinToggle.on ? (
            <Pause className="size-[18px]" aria-hidden />
          ) : (
            <Play className="size-[18px]" aria-hidden />
          )}
        </button>
      )}
    </div>
  );
}
