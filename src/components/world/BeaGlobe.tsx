/**
 * BeaGlobe — the World tab's globe, upgraded: a photoreal WebGL Earth (NASA
 * day / night imagery, embossed relief, atmosphere rim, a few clouds) under
 * the same SVG and pin layers Globe.tsx has.
 *
 * A NEW component. It does not replace or edit src/components/Globe.tsx; it
 * takes the same props, so a page can render one or the other (see the
 * package README for wiring it in behind a flag or on a new route).
 *
 * Every Globe.tsx interaction is kept:
 *   drag to spin (with a fling), pinch / wheel / + / − to zoom (0.7–2.6×), arrow keys
 *   (Shift for bigger steps), + / − keys, Home resets, a "Reset the view"
 *   button, tap a pin → onSelect, tap a country → onCountrySelect, a drag that
 *   ends over a pin or country is not a tap (6px slop), selecting a pin that is
 *   round the back turns the globe to it, visited-country shading (from pins
 *   and/or visitedCountries), province/state shading (regions), country ring
 *   markers with names (countryMarks), scrollFriendly (vertical swipes scroll
 *   the page, pinch zooms the page), autoSpin (turns until first touch),
 *   reduced motion (no spin, no fling), and it pauses off-screen.
 * New:
 *   gentle auto-rotation that pauses while you hold it and resumes after
 *   (`autoRotate="resume"`, the default unless `autoSpin` is set), inertia
 *   that settles back into that turn, frosted pin labels that follow the
 *   surface and fade at the limb, unlabelled places as small glowing dots.
 *
 * three.js is the one new dependency, loaded lazily (never during SSR).
 * Without WebGL (or until the textures arrive) it draws Globe.tsx's plain
 * vector globe, with every interaction working.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { geoContains, geoOrthographic, geoPath } from "d3-geo";
import type { Feature, GeoJsonProperties, Geometry } from "geojson";
import { coarseWorld, loadDetailedWorld, pinCountryKeys, type WorldGeo } from "./world-geo";
import { Minus, Pause, Play, Plus, RotateCcw } from "@/components/icons";
import type { Pin } from "@/data/atlas";
import { useThemeName } from "@/hooks/useThemeName";
import { countryKey } from "@/lib/country-names";
import { cn } from "@/lib/utils";
import {
  HOME_ROTATION,
  RADIUS_AT_ZOOM_1,
  clampTilt,
  clampZoom,
  countryLabelRect,
  degDelta,
  labelBudget,
  limbFade,
  pillRect,
  placeLabels,
  project,
  rotationFacing,
  stepSpin,
  type LabelBox,
  type LabelCandidate,
  type Rotation,
  type Spin,
} from "@/lib/bea-globe";
import type { EarthEngine, EarthTextures } from "./bea-earth-gl";
import { DEFAULT_EARTH_TEXTURES, type GlobeMood } from "./globe-looks";
import { PinTag } from "./GlobePinMarker";

export type { EarthTextures } from "./bea-earth-gl";
export type { GlobeMood } from "./globe-looks";

const SPHERE = { type: "Sphere" } as const;

/** Pin colours in list order, as in the mockups (blue, accent, amber, violet, teal). */
const PIN_PALETTE = ["#4A7BF0", "var(--acc2, #F24A70)", "#F5A524", "#9B6CF0", "#22A699"];

const DRAG_SLOP = 6;
const KEY_STEP = 12;
/** Globe.tsx's auto-spin: 0.006°/ms. */
const AUTO_SPEED = 6;
/** Seconds after the last touch before the gentle turn comes back ("resume"). */
const RESUME_AFTER = 2.5;
/** The canvas overhangs the box so the atmosphere is not clipped. */
const OVERHANG = 1.24;

type Region = { id: string; name: string; feature: Feature<Geometry, GeoJsonProperties> };
type CountryMark = { key: string; name: string; lat: number; lon: number };

export type BeaGlobeProps = {
  pins: Pin[];
  regions?: Region[] | undefined;
  visitedCountries?: ReadonlySet<string> | undefined;
  shadePinCountries?: boolean | undefined;
  countryMarks?: CountryMark[] | undefined;
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
  onCountrySelect?: ((countryName: string) => void) | undefined;
  className?: string | undefined;
  /** Accepted for parity with Globe.tsx; BeaGlobe always has the "open" World look. */
  variant?: "framed" | "open" | undefined;
  scrollFriendly?: boolean | undefined;
  /** Globe.tsx semantics: turn until the first touch, never come back. */
  autoSpin?: boolean | undefined;
  /** Overrides autoSpin. Default "resume" (or "until-touch" with autoSpin). */
  autoRotate?: "resume" | "until-touch" | "off" | undefined;
  /** Defaults to the app theme (useThemeName). */
  mood?: GlobeMood | undefined;
  clouds?: boolean | undefined;
  textures?: EarthTextures | undefined;
  /** Colour of a pin's head; default cycles PIN_PALETTE in list order. */
  pinColor?: ((pin: Pin, index: number) => string) | undefined;
  /** Hide the +/−/reset stack (e.g. a hero globe). Default true. */
  controls?: boolean | undefined;
  /** Fill the width the page gives it, rather than stopping at 440px. */
  fullWidth?: boolean | undefined;
  /** Adds a turn / hold button to the controls; the page keeps the choice. */
  spinToggle?: { on: boolean; onChange: (on: boolean) => void } | undefined;
  /** Start somewhere other than Globe.tsx's home view. */
  initialRotation?: Rotation | undefined;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

export function BeaGlobe({
  pins,
  regions,
  visitedCountries,
  shadePinCountries = true,
  countryMarks,
  selectedId,
  onSelect,
  onCountrySelect,
  className,
  scrollFriendly = false,
  autoSpin = false,
  autoRotate,
  mood: moodProp,
  clouds = true,
  textures = DEFAULT_EARTH_TEXTURES,
  pinColor,
  controls = true,
  fullWidth = false,
  spinToggle,
  initialRotation = HOME_ROTATION,
}: BeaGlobeProps) {
  const theme = useThemeName();
  const mood: GlobeMood = moodProp ?? theme;
  const rotateMode = autoRotate ?? (autoSpin ? "until-touch" : "resume");

  const frameRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const sphereRef = useRef<SVGPathElement | null>(null);
  const landRef = useRef<SVGPathElement | null>(null);
  const bordersRef = useRef<SVGPathElement | null>(null);
  const visitedRef = useRef<SVGPathElement | null>(null);
  const regionsRef = useRef<SVGPathElement | null>(null);
  const pinEls = useRef(new Map<string, { root: HTMLElement; tag: HTMLElement }>());
  const markEls = useRef(new Map<string, { root: HTMLElement; label: HTMLElement }>());

  const engine = useRef<EarthEngine | null>(null);
  const [earthReady, setEarthReady] = useState(false);
  const readyRef = useRef(false);
  readyRef.current = earthReady;

  const spin = useRef<Spin>({ rotation: initialRotation, vLam: 0, vPhi: 0 });
  const zoomRef = useRef(1);
  const sizeRef = useRef(0);
  const target = useRef<Rotation | null>(null);
  const drift = useRef(0);
  const idleFor = useRef(Infinity);
  const spinStopped = useRef(rotateMode === "off");
  const visible = useRef(true);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const moved = useRef(0);
  const consumed = useRef(false);
  const didPinch = useRef(false);
  const dragV = useRef<[number, number]>([0, 0]);
  const lastMove = useRef(0);

  // Latest props for the imperative loop.
  const latest = useRef({ pins, selectedId, onSelect, onCountrySelect, clouds, scrollFriendly });
  latest.current = { pins, selectedId, onSelect, onCountrySelect, clouds, scrollFriendly };

  // The coarse outline draws at once; the 50m one replaces it when it arrives.
  const [geo, setGeo] = useState<WorldGeo>(coarseWorld);
  const geoRef = useRef(geo);
  geoRef.current = geo;
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

  const visitedFeatures = useMemo(() => {
    const keys = shadePinCountries ? pinCountryKeys(pins) : new Set<string>();
    for (const key of visitedCountries ?? []) keys.add(key);
    return {
      type: "FeatureCollection" as const,
      features: geo.world.features.filter(
        (f) => f.properties?.name && keys.has(countryKey(f.properties.name)),
      ),
    };
  }, [pins, visitedCountries, shadePinCountries, geo]);
  const regionFeatures = useMemo(
    () => ({ type: "FeatureCollection" as const, features: (regions ?? []).map((r) => r.feature) }),
    [regions],
  );
  const shapes = useRef({ visitedFeatures, regionFeatures, countryMarks });
  shapes.current = { visitedFeatures, regionFeatures, countryMarks };

  const colorOf = (pin: Pin, i: number) =>
    pinColor?.(pin, i) ?? PIN_PALETTE[i % PIN_PALETTE.length]!;

  /* ------------------------------------------------------------- drawing */

  const projection = () => {
    const size = sizeRef.current;
    return geoOrthographic()
      .scale(RADIUS_AT_ZOOM_1 * zoomRef.current * size)
      .translate([size / 2, size / 2])
      .rotate([spin.current.rotation[0], spin.current.rotation[1]])
      .clipAngle(90);
  };

  const draw = () => {
    const size = sizeRef.current;
    if (!size) return;
    const zoom = zoomRef.current;
    const rot = spin.current.rotation;
    const R = RADIUS_AT_ZOOM_1 * zoom * size;
    const ready = readyRef.current;
    if (ready)
      engine.current?.render(rot, R / (size * OVERHANG), drift.current, latest.current.clouds);

    const path = geoPath(projection());
    sphereRef.current?.setAttribute("d", path(SPHERE) ?? "");
    if (!ready) landRef.current?.setAttribute("d", path(geoRef.current.world) ?? "");
    bordersRef.current?.setAttribute("d", path(geoRef.current.borders) ?? "");
    visitedRef.current?.setAttribute("d", path(shapes.current.visitedFeatures) ?? "");
    regionsRef.current?.setAttribute("d", path(shapes.current.regionFeatures) ?? "");

    // Pins: front side only, labels placed greedily (selected first, then nearest).
    const { pins: ps, selectedId: sel } = latest.current;
    const front: (LabelCandidate & { facing: number })[] = [];
    for (const pin of ps) {
      const el = pinEls.current.get(pin.id);
      if (!el) continue;
      const p = project(pin.lat, pin.lon, rot, size, R);
      if (p.facing <= 0) {
        el.root.style.visibility = "hidden";
        el.root.tabIndex = -1;
        continue;
      }
      el.root.style.visibility = "visible";
      el.root.tabIndex = 0;
      el.root.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      el.root.style.opacity = String(0.25 + 0.75 * limbFade(p.facing, 0, 0.25));
      front.push({ id: pin.id, name: pin.city || pin.name, x: p.x, y: p.y, facing: p.facing });
    }
    front.sort((a, b) => (a.id === sel ? -1 : b.id === sel ? 1 : b.facing - a.facing));
    // The selected place is always named; the rest fit around it.
    const selFront = front.find((c) => c.id === sel);
    const taken: LabelBox[] = selFront ? [pillRect(selFront.name, selFront.x, selFront.y)] : [];
    const labelled = placeLabels(
      front.filter((c) => c.id !== sel && limbFade(c.facing) > 0.5),
      labelBudget(zoom) - (selFront ? 1 : 0),
      taken,
      undefined,
      front,
    );
    if (selFront) labelled.add(selFront.id);
    for (const c of front) {
      const el = pinEls.current.get(c.id)!;
      const on = labelled.has(c.id);
      el.tag.style.display = on ? "" : "none";
      // Named places sit above bare dots, the selected one above all, so a tap lands on what you see.
      el.root.style.zIndex = String(
        (c.id === sel ? 3000 : on ? 2000 : 0) + Math.round(c.facing * 1000),
      );
    }

    // Country rings, named where there is room.
    const marks = shapes.current.countryMarks ?? [];
    const markFront: (LabelCandidate & { facing: number })[] = [];
    for (const m of marks) {
      const el = markEls.current.get(m.key);
      if (!el) continue;
      const p = project(m.lat, m.lon, rot, size, R);
      if (p.facing <= 0.02) {
        el.root.style.visibility = "hidden";
        continue;
      }
      el.root.style.visibility = "visible";
      el.root.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
      el.root.style.opacity = String(limbFade(p.facing, 0.02, 0.3));
      markFront.push({ id: m.key, name: m.name, x: p.x, y: p.y, facing: p.facing });
    }
    markFront.sort((a, b) => b.facing - a.facing);
    const named = placeLabels(
      markFront,
      8,
      taken,
      (c) => countryLabelRect(c.name, c.x, c.y),
      front,
    );
    for (const c of markFront)
      markEls.current.get(c.id)!.label.style.display = named.has(c.id) ? "" : "none";
  };

  /* ---------------------------------------------------------- animation */

  const autoOn = () => !spinStopped.current && !prefersReducedMotion();

  const tick = (now: number) => {
    raf.current = null;
    const dt = Math.min(0.05, last.current == null ? 1 / 60 : (now - last.current) / 1000);
    last.current = now;
    const holding = pointers.current.size > 0;
    if (!holding) idleFor.current += dt;
    const s = spin.current;
    let busy = false;

    if (target.current) {
      const [tl, tp] = target.current;
      const k = 1 - Math.exp(-7 * dt);
      const dl = degDelta(s.rotation[0], tl);
      const dp = tp - s.rotation[1];
      spin.current = {
        rotation: [s.rotation[0] + dl * k, s.rotation[1] + dp * k],
        vLam: 0,
        vPhi: 0,
      };
      if (Math.abs(dl) < 0.05 && Math.abs(dp) < 0.05) {
        spin.current.rotation = [tl, tp];
        target.current = null;
      }
      busy = true;
    } else if (!holding) {
      const auto = autoOn() && (rotateMode !== "resume" || idleFor.current > RESUME_AFTER);
      const next = stepSpin(s, dt, { autoSpeed: AUTO_SPEED, idle: auto });
      spin.current = next;
      busy = auto || Math.abs(next.vLam) > 0.05 || Math.abs(next.vPhi) > 0.05;
      if (!busy) spin.current = { ...next, vLam: 0, vPhi: 0 };
      // "resume" waits out its pause with the loop running, so the turn comes back.
      if (!busy && rotateMode === "resume" && autoOn()) busy = true;
    }
    if (busy && autoOn()) drift.current += dt * 0.004;
    draw();
    if (busy && visible.current) schedule();
    else last.current = null;
  };

  const schedule = () => {
    if (raf.current == null && typeof window !== "undefined")
      raf.current = requestAnimationFrame(tick);
  };

  const requestDraw = () => {
    if (raf.current == null) requestAnimationFrame(() => raf.current == null && draw());
  };

  /** Something the person did: the until-touch spin stops for good; "resume" restarts its pause. */
  const touched = () => {
    idleFor.current = 0;
    if (rotateMode !== "resume") spinStopped.current = true;
  };

  const turnBy = (dLam: number, dPhi: number) => {
    target.current = null;
    const [l, p] = spin.current.rotation;
    spin.current = { rotation: [l + dLam, clampTilt(p + dPhi)], vLam: 0, vPhi: 0 };
    draw();
    schedule();
  };

  const zoomTo = (z: number) => {
    zoomRef.current = clampZoom(z);
    draw();
    schedule();
  };

  const goTo = (rotation: Rotation, zoom?: number) => {
    spin.current = { ...spin.current, vLam: 0, vPhi: 0 };
    if (zoom != null) zoomRef.current = clampZoom(zoom);
    if (prefersReducedMotion()) {
      spin.current.rotation = rotation;
      target.current = null;
      draw();
      return;
    }
    target.current = rotation;
    schedule();
  };

  const resetView = () => {
    touched();
    goTo(HOME_ROTATION, 1);
  };

  /* -------------------------------------------------------------- effects */

  // Size: the canvas and overlays follow the frame.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const ro = new ResizeObserver(() => {
      const size = frame.clientWidth;
      if (!size || size === sizeRef.current) return;
      sizeRef.current = size;
      svgRef.current?.setAttribute("viewBox", `0 0 ${size} ${size}`);
      engine.current?.setSize(Math.round(size * OVERHANG));
      draw();
    });
    ro.observe(frame);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The WebGL Earth: lazy three.js, falls back to the vector globe on any failure.
  useEffect(() => {
    let live = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    void (async () => {
      let building: { dispose: () => void } | null = null;
      try {
        const { createEarthEngine } = await import("./bea-earth-gl");
        if (!live) return;
        const e = await createEarthEngine(
          canvas,
          Math.min(window.devicePixelRatio || 1, 2),
          textures,
        );
        building = e;
        if (!live) return e.dispose();
        e.setSize(Math.round((sizeRef.current || frameRef.current?.clientWidth || 320) * OVERHANG));
        await e.setLook(mood);
        if (!live) return e.dispose();
        building = null;
        engine.current = e;
        setEarthReady(true);
      } catch (err) {
        building?.dispose();
        console.warn("BeaGlobe: WebGL Earth unavailable, using the vector globe.", err);
      }
    })();
    return () => {
      live = false;
      engine.current?.dispose();
      engine.current = null;
      setEarthReady(false);
    };
    // Textures are fixed for a mount; the mood is swapped in place below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    void e.setLook(mood).then(requestDraw);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood, earthReady]);

  // Redraw when anything drawn changes.
  useEffect(() => {
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [earthReady, geo, visitedFeatures, regionFeatures, countryMarks, pins, selectedId, clouds]);

  // Start turning; pause off-screen and in background tabs; reduced motion stops the spin.
  useEffect(() => {
    spinStopped.current = rotateMode === "off";
    const frame = frameRef.current;
    const io =
      frame && "IntersectionObserver" in window
        ? new IntersectionObserver(([entry]) => {
            visible.current = !!entry?.isIntersecting && document.visibilityState === "visible";
            if (visible.current) schedule();
          })
        : null;
    if (frame) io?.observe(frame);
    const onVis = () => {
      visible.current = document.visibilityState === "visible";
      if (visible.current) schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => schedule();
    motion?.addEventListener?.("change", onMotion);
    schedule();
    return () => {
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      motion?.removeEventListener?.("change", onMotion);
      if (raf.current != null) cancelAnimationFrame(raf.current);
      raf.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rotateMode]);

  // Selecting a pin that is round the back (from the list, a country tap, a search) turns the globe to it.
  const selectedPin = pins.find((p) => p.id === selectedId);
  useEffect(() => {
    if (!selectedPin || !sizeRef.current) return;
    const p = project(selectedPin.lat, selectedPin.lon, spin.current.rotation, 2, 1);
    if (p.facing > 0.15) return;
    touched();
    goTo(rotationFacing(selectedPin.lat, selectedPin.lon));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPin?.lat, selectedPin?.lon]);

  // Wheel / trackpad pinch zooms, as in Globe.tsx (non-passive, so the page does not scroll as well).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      touched();
      zoomTo(zoomRef.current + (e.deltaY > 0 ? -0.12 : 0.12));
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------------------- gestures */

  const degPerPx = () =>
    180 / Math.PI / Math.max(1, RADIUS_AT_ZOOM_1 * zoomRef.current * sizeRef.current);

  const endPointer = (id: number) => {
    if (!pointers.current.delete(id)) return;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size > 0) return;
    idleFor.current = 0;
    const fresh = performance.now() - lastMove.current < 80;
    if (!didPinch.current && fresh && consumed.current && !prefersReducedMotion()) {
      spin.current = { ...spin.current, vLam: dragV.current[0], vPhi: dragV.current[1] };
    } else {
      spin.current = { ...spin.current, vLam: 0, vPhi: 0 };
    }
    schedule();
  };

  // A pointer released outside the globe (or lost to a blur) before it became a drag
  // would stay in the map and turn the next press into a pinch.
  const endPointerRef = useRef(endPointer);
  endPointerRef.current = endPointer;
  useEffect(() => {
    const done = (e: PointerEvent) => endPointerRef.current(e.pointerId);
    const blur = () => {
      for (const id of [...pointers.current.keys()]) endPointerRef.current(id);
    };
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
      window.removeEventListener("blur", blur);
    };
  }, []);

  const tryCountryTap = (clientX: number, clientY: number) => {
    const onCountry = latest.current.onCountrySelect;
    const frame = frameRef.current;
    if (!onCountry || !frame) return;
    const box = frame.getBoundingClientRect();
    const lonLat = projection().invert?.([clientX - box.left, clientY - box.top]);
    if (!lonLat) return;
    const size = sizeRef.current;
    const R = RADIUS_AT_ZOOM_1 * zoomRef.current * size;
    if (Math.hypot(clientX - box.left - size / 2, clientY - box.top - size / 2) > R) return;
    const hit = geoRef.current.world.features.find(
      (f) => f.properties?.name && geoContains(f, lonLat),
    );
    if (hit?.properties?.name) onCountry(hit.properties.name);
  };

  /* --------------------------------------------------------------- render */

  return (
    <div className={cn("select-none", className)}>
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label="Interactive globe. Arrow keys rotate, plus and minus zoom, Home resets the view."
        data-earth={earthReady ? "webgl" : "vector"}
        className={cn(
          "relative mx-auto aspect-square w-full cursor-grab",
          !fullWidth && "max-w-[440px]",
          " rounded-full outline-none active:cursor-grabbing",
          "focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-4 focus-visible:ring-offset-(--background)",
          scrollFriendly ? "touch-pan-y touch-pinch-zoom" : "touch-none",
        )}
        onKeyDown={(e) => {
          const step = e.shiftKey ? KEY_STEP * 2 : KEY_STEP;
          if (e.key === "ArrowLeft") turnBy(-step, 0);
          else if (e.key === "ArrowRight") turnBy(step, 0);
          else if (e.key === "ArrowUp") turnBy(0, step);
          else if (e.key === "ArrowDown") turnBy(0, -step);
          else if (e.key === "+" || e.key === "=") zoomTo(zoomRef.current + 0.2);
          else if (e.key === "-" || e.key === "_") zoomTo(zoomRef.current - 0.2);
          else if (e.key === "Home") resetView();
          else return;
          e.preventDefault();
          touched();
        }}
        onPointerDown={(e) => {
          if ((e.target as Element | null)?.closest?.("[data-globe-control]")) return;
          touched();
          target.current = null;
          spin.current = { ...spin.current, vLam: 0, vPhi: 0 };
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pointers.current.size === 1) {
            moved.current = 0;
            consumed.current = false;
            didPinch.current = false;
            dragV.current = [0, 0];
          } else {
            consumed.current = true;
            didPinch.current = true;
            const [a, b] = [...pointers.current.values()];
            if (a && b)
              pinch.current = {
                distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
                zoom: zoomRef.current,
              };
          }
          schedule();
        }}
        onPointerMove={(e) => {
          const prev = pointers.current.get(e.pointerId);
          if (!prev) return;
          const next = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, next);
          if (pointers.current.size >= 2) {
            consumed.current = true;
            didPinch.current = true;
            if (scrollFriendly) return; // the page takes the pinch
            const [a, b] = [...pointers.current.values()];
            if (!a || !b) return;
            const distance = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
            if (!pinch.current) pinch.current = { distance, zoom: zoomRef.current };
            else zoomTo(pinch.current.zoom * (distance / pinch.current.distance));
            return;
          }
          let dx = next.x - prev.x;
          let dy = next.y - prev.y;
          // On a scrolling page only sideways drags turn the globe (touch-pan-y hands vertical swipes to the browser).
          if (scrollFriendly && e.pointerType === "touch") dy = 0;
          moved.current += Math.abs(dx) + Math.abs(dy);
          if (!consumed.current && moved.current > DRAG_SLOP) {
            consumed.current = true;
            // Capture only once it is a drag, so a tap still clicks the pin under it.
            (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
          }
          if (!consumed.current) return;
          const k = degPerPx();
          const now = performance.now();
          const dt = Math.max(1, now - lastMove.current) / 1000;
          lastMove.current = now;
          const v: [number, number] = [(dx * k) / dt, (-dy * k) / dt];
          // Smooth the release speed over the last few moves.
          dragV.current = [
            dragV.current[0] * 0.6 + v[0] * 0.4,
            dragV.current[1] * 0.6 + v[1] * 0.4,
          ];
          dx *= k;
          dy *= k;
          turnBy(dx, -dy);
        }}
        onLostPointerCapture={(e) => endPointer(e.pointerId)}
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={(e) => endPointer(e.pointerId)}
        onClick={(e) => {
          if (consumed.current || moved.current > DRAG_SLOP) return;
          if ((e.target as Element | null)?.closest?.("[data-globe-control],[data-globe-pin]"))
            return;
          tryCountryTap(e.clientX, e.clientY);
        }}
      >
        {/* Vector globe: the fallback, and what shows while the Earth loads. */}
        <svg
          ref={svgRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[1] size-full overflow-visible"
          viewBox="0 0 320 320"
        >
          <defs>
            <radialGradient id="bea-globe-sea" cx="38%" cy="32%" r="75%">
              <stop
                offset="0%"
                style={{
                  stopColor: "color-mix(in oklab, var(--visited, #4A7BF0) 10%, var(--card, #fff))",
                }}
              />
              <stop
                offset="100%"
                style={{
                  stopColor: "color-mix(in oklab, var(--visited, #4A7BF0) 32%, var(--card, #fff))",
                }}
              />
            </radialGradient>
          </defs>
          <path
            ref={sphereRef}
            fill={earthReady ? "none" : "url(#bea-globe-sea)"}
            style={{
              stroke: earthReady
                ? "none"
                : "color-mix(in oklab, var(--visited, #4A7BF0) 25%, var(--border, #ddd))",
            }}
          />
          {!earthReady && (
            <path
              ref={landRef}
              style={{
                fill: "color-mix(in oklab, var(--foreground, #111) 16%, var(--card, #fff))",
              }}
            />
          )}
          <path
            ref={bordersRef}
            fill="none"
            stroke={earthReady ? "#FFFFFF" : "var(--card, #fff)"}
            strokeOpacity={earthReady ? (mood === "dark" ? 0.22 : 0.3) : 1}
            strokeWidth={0.6}
            strokeLinejoin="round"
          />
          <path
            ref={visitedRef}
            style={{
              fill: earthReady
                ? "color-mix(in oklab, var(--visited, #4A7BF0) 30%, transparent)"
                : "color-mix(in oklab, var(--visited, #4A7BF0) 72%, var(--card, #fff))",
              stroke: "color-mix(in oklab, var(--visited, #4A7BF0) 60%, #fff)",
            }}
            strokeWidth={0.8}
            strokeOpacity={0.7}
          />
          <path
            ref={regionsRef}
            style={{ fill: "var(--visited, #4A7BF0)", stroke: "var(--card, #fff)" }}
            strokeWidth={0.5}
            opacity={earthReady ? 0.5 : 0.9}
          />
        </svg>

        {/* The WebGL Earth: under the shading layer above, which drops its sea once the Earth is drawn. */}
        <canvas
          ref={canvasRef}
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-1/2 top-1/2 size-[124%] -translate-x-1/2 -translate-y-1/2 transition-opacity duration-(--t-arrive)",
            earthReady ? "opacity-100" : "opacity-0",
          )}
          style={{ zIndex: 0 }}
        />

        {/* Country rings with names. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[5]">
          {(countryMarks ?? []).map((m) => (
            <div
              key={m.key}
              ref={(el) => {
                if (!el) return void markEls.current.delete(m.key);
                markEls.current.set(m.key, { root: el, label: el.lastElementChild as HTMLElement });
              }}
              className="absolute left-0 top-0 "
              style={{ visibility: "hidden" }}
            >
              <span className="absolute -left-[5px] -top-[5px] size-[10px] rounded-full border-2 border-white bg-(--visited)/70 shadow-[0_0_0_1px_rgb(0_0_0/0.15)]" />
              <span className="absolute left-[8px] top-[-9px] whitespace-nowrap text-[13px] font-semibold leading-[18px] text-white [font-family:var(--world-font-sans,var(--font-sans))] [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">
                {m.name}
              </span>
            </div>
          ))}
        </div>

        {/* Places: a glowing dot each (mockup .gdot) and a frosted tag where there is room (.gtag). */}
        <div className="pointer-events-none absolute inset-0 z-10">
          {pins.map((pin, i) => {
            const selected = pin.id === selectedId;
            const name = pin.city || pin.name;
            return (
              <button
                key={pin.id}
                type="button"
                data-globe-pin
                aria-label={[name, pin.country].filter(Boolean).join(", ")}
                aria-pressed={selected}
                ref={(el) => {
                  if (!el) return void pinEls.current.delete(pin.id);
                  pinEls.current.set(pin.id, {
                    root: el,
                    tag: el.querySelector<HTMLElement>("[data-tag]")!,
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (consumed.current || moved.current > DRAG_SLOP) return;
                  latest.current.onSelect?.(pin);
                }}
                className="group pointer-events-auto absolute left-0 top-0 size-0 rounded-full outline-none"
                style={{ visibility: "hidden" } as CSSProperties}
              >
                {/* A 44px target on the dot; a named place's whole tag is tappable too. */}
                <span className="absolute -left-[22px] -top-[22px] size-[44px] rounded-full group-focus-visible:ring-2 group-focus-visible:ring-(--acc)" />
                <span className="absolute -left-[4px] -top-[4px] size-[8px] rounded-full bg-white shadow-[0_0_8px_3px_rgb(255_255_255/0.7)]" />
                <span data-tag className="contents">
                  <PinTag name={name} color={colorOf(pin, i)} selected={selected} />
                </span>
              </button>
            );
          })}
        </div>

        {controls && (
          <div
            data-globe-control
            className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 flex-col overflow-hidden rounded-full border border-(--border) bg-(--card)/85 shadow-sm backdrop-blur"
          >
            <button
              type="button"
              aria-label="Zoom in"
              className="grid size-11 place-items-center text-(--foreground)"
              onClick={() => (touched(), zoomTo(zoomRef.current + 0.2))}
            >
              <Plus className="size-5" aria-hidden />
            </button>
            <span className="h-px bg-(--border)" />
            <button
              type="button"
              aria-label="Zoom out"
              className="grid size-11 place-items-center text-(--foreground)"
              onClick={() => (touched(), zoomTo(zoomRef.current - 0.2))}
            >
              <Minus className="size-5" aria-hidden />
            </button>
            <span className="h-px bg-(--border)" />
            <button
              type="button"
              aria-label="Reset the view"
              title="Reset the view"
              className="grid size-11 place-items-center text-(--foreground)"
              onClick={resetView}
            >
              <RotateCcw className="size-[18px]" aria-hidden />
            </button>
            {spinToggle && (
              <>
                <span className="h-px bg-(--border)" />
                <button
                  type="button"
                  aria-label={spinToggle.on ? "Stop the globe turning" : "Let the globe turn"}
                  aria-pressed={spinToggle.on}
                  title={spinToggle.on ? "Stop turning" : "Turn on its own"}
                  className="grid size-11 place-items-center text-(--foreground)"
                  onClick={() => spinToggle.onChange(!spinToggle.on)}
                >
                  {spinToggle.on ? (
                    <Pause className="size-[18px]" aria-hidden />
                  ) : (
                    <Play className="size-[18px]" aria-hidden />
                  )}
                </button>
              </>
            )}
          </div>
        )}
        {/* Globe.tsx's description, kept for screen readers. */}
        <p className="sr-only">
          {pins.length === 0
            ? "A globe with no pins on it yet."
            : `A globe showing ${pins.length} pin${pins.length === 1 ? "" : "s"} across ${
                new Set(pins.map((p) => p.country).filter(Boolean)).size
              } countries. Every pin is also listed below the globe.`}{" "}
          Drag to spin · pinch or +/− to zoom.
        </p>
      </div>
    </div>
  );
}
