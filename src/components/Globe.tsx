import { useEffect, useId, useMemo, useRef, useState } from "react";
import { LocateFixed, Minus, Plus, RotateCcw } from "@/components/icons";
import { geoOrthographic, geoPath, geoGraticule10, geoRotation } from "d3-geo";
import { feature } from "topojson-client";
import type { Feature, FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import worldTopo from "world-atlas/countries-110m.json";
import type { Pin } from "@/data/atlas";
import { countryKey } from "@/lib/country-names";
import { PIN_HEAD_Y, labelBudget, pillBox, placeCityLabels } from "@/lib/globe-labels";
import { paintGlobe, viewAxes, type EarthMap } from "@/lib/earth-globe";
import { loadEarthMap } from "@/lib/earth-globe-load";
import { useThemeName } from "@/hooks/useThemeName";

const PIN_FILL: Record<Pin["type"], string> = {
  visited: "var(--visited)",
  nexttime: "var(--nexttime)",
  wishlist: "var(--wishlist)",
  reco: "var(--reco)",
};

type AnyTopology = Parameters<typeof feature>[0];
const topo = worldTopo as unknown as AnyTopology;
const world = feature(topo, topo.objects["countries"]!) as unknown as FeatureCollection<
  Geometry,
  { name?: string }
>;

/**
 * The countries the visited pins are in, as ISO codes — so a pin saved as
 * "Japon" or "日本" shades Japan like one saved as "Japan" does.
 */
function visitedCountryKeySet(pins: Pin[]): Set<string> {
  const keys = new Set<string>();
  for (const pin of pins) {
    if (pin.type !== "visited" && !pin.visited) continue;
    if (!pin.country?.trim()) continue;
    keys.add(countryKey(pin.country));
  }
  return keys;
}

function featureVisited(name: string | undefined, visited: Set<string>): boolean {
  return Boolean(name) && visited.has(countryKey(name));
}

const SIZE = 320;
const ZOOM_MIN = 0.7;
const ZOOM_MAX = 2.6;

/** Pointer travel (px) past which a pointerup is a rotate, not a country/pin click. */
const DRAG_SLOP = 6;

/** Degrees per arrow-key press — the keyboard equivalent of a small drag. */
const KEY_STEP = 12;

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pin type is encoded by shape as well as colour — colour alone is unreadable
 * for the ~8% of men with a colour-vision deficiency, and these four hues are
 * blue / green / amber / purple.
 */
function pinTypeWord(type: Pin["type"]): string {
  if (type === "visited") return "visited";
  if (type === "nexttime") return "next time";
  if (type === "wishlist") return "wishlist";
  return "recommendation";
}

function pinShape(type: Pin["type"]): { d: string; label: string } {
  switch (type) {
    case "visited":
      // Filled disc.
      return { d: "M0,-2.9 A2.9,2.9 0 1,1 0,2.9 A2.9,2.9 0 1,1 0,-2.9 Z", label: "circle" };
    case "nexttime":
      // Diamond.
      return { d: "M0,-3.4 L3.4,0 L0,3.4 L-3.4,0 Z", label: "diamond" };
    case "wishlist":
      // Triangle.
      return { d: "M0,-3.4 L3.1,2.3 L-3.1,2.3 Z", label: "triangle" };
    default:
      // Square, for recommendations.
      return { d: "M-2.6,-2.6 L2.6,-2.6 L2.6,2.6 L-2.6,2.6 Z", label: "square" };
  }
}

type ActivePointer = { x: number; y: number };

function pinchDistance(a: ActivePointer, b: ActivePointer) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function Globe({
  pins,
  selectedId,
  onSelect,
  onCountrySelect,
  regions,
  visitedCountries,
  shadePinCountries = true,
  countryMarks,
  className,
  variant = "framed",
  scrollFriendly = false,
  autoSpin = false,
}: {
  pins: Pin[];
  /**
   * Provinces or states to fill, drawn over their country in a deeper tone:
   * the World tab's "where you have been", one level down from countries.
   */
  regions?:
    { id: string; name: string; feature: Feature<Geometry, GeoJsonProperties> }[] | undefined;
  /**
   * Countries to shade, as `countryKey`s, when the caller knows better than
   * the pins' own names — the World tab adds the countries its provinces
   * found, for cities saved without one.
   */
  visitedCountries?: ReadonlySet<string> | undefined;
  /**
   * False to shade only `visitedCountries`, not the countries the pins are
   * in — the World tab's Cities and Provinces views show those alone.
   */
  shadePinCountries?: boolean | undefined;
  /**
   * Countries to name on the globe, with a ring marker: the World tab's
   * countries you have been to, each one, whether or not it has city dots.
   */
  countryMarks?: { key: string; name: string; lat: number; lon: number }[] | undefined;
  selectedId?: string | null | undefined;
  onSelect?: ((pin: Pin) => void) | undefined;
  onCountrySelect?: ((countryName: string) => void) | undefined;
  /** Extra classes on the outer frame — e.g. full-bleed on large screens. */
  className?: string | undefined;
  /**
   * "framed" (default): the globe in a bordered panel with a stacked control
   * strip. "open": the World tab's master look — no panel, a larger globe on
   * the page, and round separate controls down the right.
   */
  variant?: "framed" | "open" | undefined;
  /**
   * In a page that scrolls past it (the welcome page): an up-and-down swipe
   * scrolls the page, and only sideways drags turn the globe. Without it a
   * thumb that started on the globe could not scroll on. Pinch then zooms
   * the page, as everywhere else; the globe's zoom buttons still work.
   */
  scrollFriendly?: boolean | undefined;
  /**
   * Turn slowly on its own until someone touches it — the welcome page's
   * globe, so it reads as a world rather than a picture. Never with reduced
   * motion, and it stops for good on the first drag, key or button.
   */
  autoSpin?: boolean | undefined;
}) {
  const open = variant === "open";
  const uid = useId().replace(/:/g, "");
  const oceanId = `globe-ocean-${uid}`;
  const shadeId = `globe-shade-${uid}`;
  const glowId = `globe-glow-${uid}`;
  const shineId = `globe-shine-${uid}`;
  const airId = `globe-air-${uid}`;
  const [rotation, setRotation] = useState<[number, number]>([-10, -18]);
  const [zoom, setZoom] = useState(1);
  /**
   * The World globe is the real Earth (by night in Dark); the others keep
   * their plain land. It is a canvas behind the SVG, never inside it: Safari
   * lays a canvas in <foreignObject> out at the wrong size and place.
   */
  const look = useThemeName() === "dark" ? "night" : "day";
  const [earth, setEarth] = useState<{ look: "day" | "night"; map: EarthMap } | null>(null);
  const earthCanvas = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (!open) return;
    let live = true;
    void loadEarthMap(look).then((map) => {
      if (live) setEarth(map ? { look, map } : null);
    });
    return () => {
      live = false;
    };
  }, [open, look]);
  const relief = earth !== null;
  const pointers = useRef<Map<number, ActivePointer>>(new Map());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const velocity = useRef<[number, number]>([0, 0]);
  const pending = useRef<[number, number] | null>(null);
  /**
   * The rotation the pointer has produced so far. `rotation` state lags by a
   * frame, so reading it as the base during a fast drag drops movement.
   */
  const live = useRef<[number, number]>([-10, -18]);
  /** Live zoom for pinch — state lags a frame the same way rotation does. */
  const liveZoom = useRef(1);
  /** Pointer travel since the gesture began (single-finger only). */
  const moved = useRef(0);
  /**
   * Once a gesture is a drag or pinch, ignore the trailing click.
   * Cleared on the next pointerdown — not on pointerup, because click fires after.
   */
  const gestureConsumed = useRef(false);
  /** True if this gesture used two fingers — no fling after release. */
  const didPinch = useRef(false);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const rafDrag = useRef<number | null>(null);
  const rafInertia = useRef<number | null>(null);
  const rafSpin = useRef<number | null>(null);
  /** Set by the first touch, key or button: the auto-spin never comes back. */
  const spinStopped = useRef(false);

  const visitedKeys = useMemo(() => {
    const keys = shadePinCountries ? visitedCountryKeySet(pins) : new Set<string>();
    for (const key of visitedCountries ?? []) keys.add(key);
    return keys;
  }, [pins, visitedCountries, shadePinCountries]);

  // Stable country ids — never Math.random() (that remounts paths every render).
  const countries = useMemo(
    () =>
      world.features.map((f) => ({
        id: String(f.id ?? f.properties?.name ?? "unknown"),
        name: f.properties?.name ?? "",
        feature: f,
      })),
    [],
  );

  const { countryPaths, regionPaths, graticulePath, spherePath, projection, radius } =
    useMemo(() => {
      const proj = geoOrthographic()
        .scale(150 * zoom)
        .translate([SIZE / 2, SIZE / 2])
        .rotate([rotation[0], rotation[1]]);
      const path = geoPath(proj);
      return {
        projection: proj,
        countryPaths: countries.map((c) => ({
          id: c.id,
          name: c.name,
          d: path(c.feature) ?? "",
          visited: featureVisited(c.name, visitedKeys),
        })),
        regionPaths: (regions ?? []).map((r) => ({
          id: r.id,
          name: r.name,
          d: path(r.feature) ?? "",
        })),
        radius: proj.scale(),
        graticulePath: path(geoGraticule10()) ?? "",
        spherePath: path({ type: "Sphere" }) ?? "",
      };
    }, [rotation, zoom, countries, visitedKeys, regions]);

  const clipTest = useMemo(() => {
    const c: [number, number] = [-rotation[0], -rotation[1]];
    return (lon: number, lat: number) => {
      const toRad = Math.PI / 180;
      const cosd =
        Math.sin(c[1] * toRad) * Math.sin(lat * toRad) +
        Math.cos(c[1] * toRad) * Math.cos(lat * toRad) * Math.cos((lon - c[0]) * toRad);
      return cosd >= 0;
    };
  }, [rotation]);

  // The terrain is drawn small while the globe moves, sharp once it rests.
  useEffect(() => {
    const canvas = earthCanvas.current;
    if (!canvas || !earth) return;
    const rotationInverse = geoRotation([rotation[0], rotation[1]]);
    const axes = viewAxes((p) => rotationInverse.invert(p) as [number, number]);
    const draw = (px: number) => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      if (canvas.width !== px) {
        canvas.width = px;
        canvas.height = px;
      }
      const image = ctx.createImageData(px, px);
      paintGlobe(image.data, px, (150 * zoom * px) / SIZE, axes, earth.map, earth.look);
      ctx.putImageData(image, 0, 0);
    };
    draw(SIZE);
    const sharp = window.setTimeout(
      // The globe shows up to 1.4× its SVG size, so the sharp copy is that big.
      () => draw(Math.round(Math.min(2, window.devicePixelRatio || 1) * 1.4 * SIZE)),
      140,
    );
    return () => window.clearTimeout(sharp);
  }, [earth, rotation, zoom]);

  const projected = useMemo(() => {
    return pins
      .map((pin) => {
        const p = projection([pin.lon, pin.lat]);
        if (!p || !clipTest(pin.lon, pin.lat)) return null;
        return { pin, x: p[0], y: p[1] };
      })
      .filter(Boolean) as { pin: Pin; x: number; y: number }[];
  }, [pins, projection, clipTest]);

  // Labels are placed, not just counted: two pins a few pixels apart used to
  // print over each other ("TcMontreal", Porto inside Lisbon).
  const cityLabels = useMemo(() => {
    const placed = placeCityLabels(
      projected.map(({ pin, x, y }) => ({ id: pin.id, city: pin.city, x, y })),
      { max: labelBudget(zoom), pill: open },
    );
    const byId = new Map(projected.map((point) => [point.pin.id, point]));
    return placed.map((label) => byId.get(label.id)!).filter(Boolean);
  }, [projected, zoom, open]);

  // Country names go right of their ring, or left when a city's name is
  // already there, or not at all — the ring still marks the country.
  const countryLabels = useMemo(() => {
    type Box = { x0: number; x1: number; y0: number; y1: number };
    const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
    const taken: Box[] = cityLabels.map(({ pin, x, y }) => {
      if (open) {
        const b = pillBox(pin.city ?? "", x, y);
        return { x0: b.left, x1: b.right, y0: b.top, y1: b.bottom };
      }
      return { x0: x + 7, x1: x + 7 + pin.city.length * 6, y0: y - 15, y1: y - 2 };
    });
    return (countryMarks ?? [])
      .map((mark) => {
        const p = projection([mark.lon, mark.lat]);
        if (!p || !clipTest(mark.lon, mark.lat)) return null;
        const [x, y] = p;
        const width = mark.name.length * 6.2;
        const right: Box = { x0: x + 6, x1: x + 6 + width, y0: y - 5, y1: y + 6 };
        const left: Box = { x0: x - 6 - width, x1: x - 6, y0: y - 5, y1: y + 6 };
        const side = !taken.some((t) => overlaps(t, right))
          ? "right"
          : !taken.some((t) => overlaps(t, left))
            ? "left"
            : null;
        if (side) taken.push(side === "right" ? right : left);
        return { mark, x, y, side };
      })
      .filter(Boolean) as {
      mark: { key: string; name: string };
      x: number;
      y: number;
      side: "right" | "left" | null;
    }[];
  }, [countryMarks, projection, clipTest, cityLabels, open]);

  const flushRotation = () => {
    rafDrag.current = null;
    if (!pending.current) return;
    const next = pending.current;
    pending.current = null;
    setRotation(next);
  };

  const applyDelta = (dLam: number, dPhi: number) => {
    const [lam, phi] = live.current;
    const next: [number, number] = [lam + dLam, Math.max(-85, Math.min(85, phi + dPhi))];
    live.current = next;
    scheduleRotation(next);
  };

  const scheduleRotation = (next: [number, number]) => {
    pending.current = next;
    if (rafDrag.current == null) {
      rafDrag.current = requestAnimationFrame(flushRotation);
    }
  };

  const clampZoom = (z: number) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));

  const applyZoom = (next: number) => {
    stopSpin();
    const z = clampZoom(next);
    liveZoom.current = z;
    setZoom(z);
  };

  // React attaches `wheel` as a passive listener at the root, so an onWheel
  // preventDefault() is ignored and the page scrolls as well as the globe.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stopSpin();
      const next = clampZoom(liveZoom.current + (e.deltaY > 0 ? -0.12 : 0.12));
      liveZoom.current = next;
      setZoom(next);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  useEffect(() => {
    return () => {
      if (rafDrag.current != null) cancelAnimationFrame(rafDrag.current);
      if (rafInertia.current != null) cancelAnimationFrame(rafInertia.current);
      if (rafSpin.current != null) cancelAnimationFrame(rafSpin.current);
    };
  }, []);

  // About a turn a minute: enough to show it is a globe, slow enough to read.
  useEffect(() => {
    if (!autoSpin || typeof window === "undefined" || prefersReducedMotion()) return;
    let last = 0;
    let owed = 0;
    const tick = (now: number) => {
      owed += last ? Math.min(now - last, 64) : 0;
      last = now;
      // Each turn redraws every country, so step about twenty times a second
      // rather than every frame: still smooth at this speed, a third the work.
      if (owed >= 50) {
        applyDelta(owed * 0.006, 0);
        owed = 0;
      }
      rafSpin.current = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (rafSpin.current != null) cancelAnimationFrame(rafSpin.current);
      rafSpin.current = null;
    };
    const resume = () => {
      if (spinStopped.current || rafSpin.current != null) return;
      last = 0;
      rafSpin.current = requestAnimationFrame(tick);
    };
    resume();

    // Scrolled past, it is not worth a frame.
    const io =
      typeof IntersectionObserver === "function" && frameRef.current
        ? new IntersectionObserver(([entry]) => (entry?.isIntersecting ? resume() : pause()))
        : null;
    if (io && frameRef.current) io.observe(frameRef.current);

    // Reduced motion switched on while the page is open stops it too.
    const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const onMotion = () => {
      if (motion?.matches) stopSpin();
    };
    motion?.addEventListener?.("change", onMotion);

    return () => {
      pause();
      io?.disconnect();
      motion?.removeEventListener?.("change", onMotion);
    };
    // applyDelta and stopSpin read refs only; the spin starts once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSpin]);

  function stopSpin() {
    spinStopped.current = true;
    if (rafSpin.current != null) {
      cancelAnimationFrame(rafSpin.current);
      rafSpin.current = null;
    }
  }

  /**
   * Jump straight to a rotation, dropping any turn a drag or the spin had
   * queued for the next frame — or it lands after, and undoes, the jump.
   */
  const jumpTo = (next: [number, number]) => {
    if (rafDrag.current != null) cancelAnimationFrame(rafDrag.current);
    rafDrag.current = null;
    pending.current = null;
    live.current = next;
    setRotation(next);
  };

  const stopInertia = () => {
    stopSpin();
    if (rafInertia.current != null) {
      cancelAnimationFrame(rafInertia.current);
      rafInertia.current = null;
    }
  };

  const startInertia = () => {
    stopInertia();
    // A globe that keeps spinning after release is exactly the kind of motion
    // people turn off.
    if (prefersReducedMotion()) {
      velocity.current = [0, 0];
      return;
    }
    const tick = () => {
      const [vx, vy] = velocity.current;
      if (Math.hypot(vx, vy) < 0.08) {
        rafInertia.current = null;
        return;
      }
      applyDelta(vx, vy);
      velocity.current = [vx * 0.92, vy * 0.92];
      rafInertia.current = requestAnimationFrame(tick);
    };
    rafInertia.current = requestAnimationFrame(tick);
  };

  const endPointer = (pointerId: number) => {
    pointers.current.delete(pointerId);
    if (pointers.current.size < 2) {
      pinchStart.current = null;
    }
    if (pointers.current.size === 0) {
      if (didPinch.current) {
        velocity.current = [0, 0];
        stopInertia();
      } else {
        startInertia();
      }
    }
  };

  /** Bring a pin into view — the far side of a globe is not a place to hunt. */
  const centreOn = (lon: number, lat: number) => {
    const next: [number, number] = [-lon, -Math.max(-85, Math.min(85, lat))];
    stopInertia();
    velocity.current = [0, 0];
    jumpTo(next);
  };

  // Selecting a pin anywhere (the list below, a country tap, a search) spins the
  // globe to it rather than leaving it hidden round the back.
  const selectedPin = pins.find((p) => p.id === selectedId);
  const selectedLon = selectedPin?.lon;
  const selectedLat = selectedPin?.lat;
  useEffect(() => {
    if (selectedLon == null || selectedLat == null) return;
    if (clipTest(selectedLon, selectedLat)) return;
    centreOn(selectedLon, selectedLat);
    // clipTest changes on every rotation; re-running on it would fight the drag.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLon, selectedLat]);

  const resetView = () => {
    stopInertia();
    velocity.current = [0, 0];
    jumpTo([-10, -18]);
    applyZoom(1);
  };

  const trySelectPin = (pin: Pin) => {
    if (gestureConsumed.current || moved.current > DRAG_SLOP) return;
    onSelect?.(pin);
  };

  const trySelectCountry = (name: string) => {
    if (!onCountrySelect || gestureConsumed.current || moved.current > DRAG_SLOP) return;
    onCountrySelect(name);
  };

  return (
    <div className={`select-none ${className ?? ""}`}>
      <div
        ref={frameRef}
        tabIndex={0}
        role="group"
        aria-label="Interactive globe. Arrow keys rotate, plus and minus zoom, Home resets the view."
        onKeyDown={(e) => {
          const step = e.shiftKey ? KEY_STEP * 2 : KEY_STEP;
          if (e.key === "ArrowLeft") applyDelta(-step, 0);
          else if (e.key === "ArrowRight") applyDelta(step, 0);
          else if (e.key === "ArrowUp") applyDelta(0, step);
          else if (e.key === "ArrowDown") applyDelta(0, -step);
          else if (e.key === "+" || e.key === "=") applyZoom(liveZoom.current + 0.2);
          else if (e.key === "-" || e.key === "_") applyZoom(liveZoom.current - 0.2);
          else if (e.key === "Home") {
            stopInertia();
            jumpTo([-10, -18]);
            applyZoom(1);
          } else return;
          e.preventDefault();
          stopInertia();
        }}
        className={`relative ${scrollFriendly ? "touch-pan-y touch-pinch-zoom" : "touch-none"} overflow-hidden rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] focus-visible:ring-offset-2 ${
          open ? "" : "border border-border bg-elevated"
        }`}
        onPointerDown={(e) => {
          // Zoom controls are buttons inside the frame — don't steal their gesture.
          if ((e.target as Element | null)?.closest?.("button")) return;

          stopInertia();
          velocity.current = [0, 0];
          pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

          if (pointers.current.size === 1) {
            moved.current = 0;
            gestureConsumed.current = false;
            didPinch.current = false;
          } else if (pointers.current.size >= 2) {
            gestureConsumed.current = true;
            didPinch.current = true;
            velocity.current = [0, 0];
            const [a, b] = [...pointers.current.values()];
            if (a && b) {
              pinchStart.current = {
                distance: Math.max(1, pinchDistance(a, b)),
                zoom: liveZoom.current,
              };
            }
          }

          (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!pointers.current.has(e.pointerId)) return;
          const prev = pointers.current.get(e.pointerId)!;
          const next = { x: e.clientX, y: e.clientY };
          pointers.current.set(e.pointerId, next);

          if (pointers.current.size >= 2) {
            gestureConsumed.current = true;
            didPinch.current = true;
            velocity.current = [0, 0];
            // On a page that scrolls past it, a pinch zooms the page, not
            // the globe; the browser takes the gesture.
            if (scrollFriendly) return;
            const pts = [...pointers.current.values()];
            const a = pts[0];
            const b = pts[1];
            if (!a || !b) return;
            const distance = Math.max(1, pinchDistance(a, b));
            if (!pinchStart.current) {
              pinchStart.current = { distance, zoom: liveZoom.current };
              return;
            }
            const ratio = distance / pinchStart.current.distance;
            applyZoom(pinchStart.current.zoom * ratio);
            return;
          }

          const dx = next.x - prev.x;
          const dy = next.y - prev.y;
          moved.current += Math.abs(dx) + Math.abs(dy);
          if (moved.current > DRAG_SLOP) gestureConsumed.current = true;
          const dLam = dx * 0.4;
          const dPhi = -dy * 0.3;
          velocity.current = [dLam, dPhi];
          applyDelta(dLam, dPhi);
        }}
        onPointerUp={(e) => endPointer(e.pointerId)}
        onPointerCancel={(e) => endPointer(e.pointerId)}
      >
        {relief && (
          <canvas
            ref={earthCanvas}
            width={SIZE}
            height={SIZE}
            aria-hidden
            className="pointer-events-none absolute left-0 top-0 h-[min(92vw,440px)] w-full object-contain md:h-[500px]"
          />
        )}
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={
            pins.length === 0
              ? "A globe with no pins on it yet."
              : `A globe showing ${pins.length} pin${pins.length === 1 ? "" : "s"} across ${
                  new Set(pins.map((p) => p.country).filter(Boolean)).size
                } countries. Every pin is also listed below the globe.`
          }
          className={`relative w-full cursor-grab active:cursor-grabbing ${
            open ? "h-[min(92vw,440px)] md:h-[500px]" : "h-[min(82vw,420px)] md:h-[480px]"
          }`}
        >
          <defs>
            {/* Sea: the visited blue washed into the card colour, lit from
                the upper left. Built from tokens so every theme gets its own. */}
            <radialGradient id={oceanId} cx="38%" cy="32%" r="75%">
              <stop
                offset="0%"
                style={{ stopColor: "color-mix(in oklab, var(--visited) 8%, var(--card))" }}
              />
              <stop
                offset="65%"
                style={{ stopColor: "color-mix(in oklab, var(--visited) 18%, var(--card))" }}
              />
              <stop
                offset="100%"
                style={{ stopColor: "color-mix(in oklab, var(--visited) 30%, var(--card))" }}
              />
            </radialGradient>
            {/* The far edge falls into shade, so it reads round, not flat. */}
            <radialGradient id={shadeId} cx="40%" cy="35%" r="68%">
              <stop offset="60%" stopColor="#000" stopOpacity={0} />
              <stop offset="100%" stopColor="#000" stopOpacity={0.16} />
            </radialGradient>
            <radialGradient id={shineId} cx="34%" cy="28%" r="42%">
              <stop offset="0%" stopColor="#fff" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#fff" stopOpacity={0} />
            </radialGradient>
            {/* The Earth's own thin blue air. */}
            <radialGradient id={airId}>
              <stop offset={(radius / (radius + 9)) * 0.97} stopColor="#8cc8ff" stopOpacity={0} />
              <stop offset={radius / (radius + 9)} stopColor="#8cc8ff" stopOpacity={0.5} />
              <stop offset={1} stopColor="#8cc8ff" stopOpacity={0} />
            </radialGradient>
            <radialGradient id={glowId}>
              <stop offset="88%" style={{ stopColor: "var(--visited)" }} stopOpacity={0.16} />
              <stop offset="100%" style={{ stopColor: "var(--visited)" }} stopOpacity={0} />
            </radialGradient>
          </defs>
          {/* A thin atmosphere just past the rim. */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={radius + 9}
            fill={`url(#${relief ? airId : glowId})`}
            className={`pointer-events-none ${relief ? "dark:opacity-35" : ""}`}
          />
          {/* With the Earth drawn underneath, the sea and the grid are its own. */}
          {!relief && (
            <>
              <path
                d={spherePath}
                fill={`url(#${oceanId})`}
                style={{ stroke: "color-mix(in oklab, var(--visited) 25%, var(--border))" }}
                strokeWidth={0.8}
              />
              <path
                d={graticulePath}
                fill="none"
                stroke="var(--visited)"
                strokeWidth={0.35}
                opacity={0.14}
                className="pointer-events-none"
              />
            </>
          )}
          {countryPaths.map((c) =>
            c.d ? (
              <path
                key={c.id}
                d={c.d}
                style={{
                  fill: relief
                    ? c.visited
                      ? "color-mix(in oklab, var(--visited) 34%, transparent)"
                      : "transparent"
                    : c.visited
                      ? "color-mix(in oklab, var(--visited) 72%, var(--card))"
                      : "color-mix(in oklab, var(--foreground) 16%, var(--card))",
                }}
                stroke={relief ? "rgb(255 255 255 / 0.32)" : "var(--card)"}
                strokeWidth={relief ? 0.3 : 0.45}
                strokeOpacity={relief && look === "night" ? 0.55 : undefined}
                strokeLinejoin="round"
                className={onCountrySelect && c.name ? "cursor-pointer" : undefined}
                onClick={(e) => {
                  if (!c.name) return;
                  // A drag / pinch that ends over a country is not a country tap.
                  if (gestureConsumed.current || moved.current > DRAG_SLOP) return;
                  e.stopPropagation();
                  trySelectCountry(c.name);
                }}
              />
            ) : null,
          )}
          {/* The Earth is lit as it is painted; the plain globe is shaded here. */}
          {!relief && (
            <path d={spherePath} fill={`url(#${shadeId})`} className="pointer-events-none" />
          )}
          <path
            d={spherePath}
            fill={`url(#${shineId})`}
            className={`pointer-events-none ${relief ? "opacity-25 dark:opacity-0" : "dark:opacity-20"}`}
          />
          {regionPaths.map((r) =>
            r.d ? (
              <path
                key={`region-${r.id}`}
                d={r.d}
                fill="var(--visited)"
                stroke="var(--card)"
                strokeWidth={0.3}
                opacity={relief ? 0.55 : 0.9}
                className="pointer-events-none"
              >
                <title>{r.name}</title>
              </path>
            ) : null,
          )}
          {projected.map(({ pin, x, y }) => {
            const shape = pinShape(pin.type);
            if (open) {
              // A map pin, as in the mockup: its tip is the place, its head the
              // pin's colour with the type's shape in white.
              const big = selectedId === pin.id ? 1.25 : 1;
              return (
                <g key={pin.id} transform={`translate(${x} ${y}) scale(${big})`}>
                  <g
                    className="pin-pop cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      trySelectPin(pin);
                    }}
                  >
                    <title>
                      {`${pin.name}${pin.city ? `, ${pin.city}` : ""} — ${pinTypeWord(pin.type)} (${shape.label})`}
                    </title>
                    <circle cy={PIN_HEAD_Y} r={16} fill="transparent" />
                    <ellipse rx={3.2} ry={1.2} fill="#000" opacity={0.28} />
                    <path
                      d={`M0,0 C-1.6,-3.6 -6,-6.6 -6,${PIN_HEAD_Y} A6,6 0 1,1 6,${PIN_HEAD_Y} C6,-6.6 1.6,-3.6 0,0 Z`}
                      fill={PIN_FILL[pin.type] ?? "var(--reco)"}
                      stroke="#fff"
                      strokeWidth={1.1}
                    />
                    <path
                      d={shape.d}
                      transform={`translate(0 ${PIN_HEAD_Y}) scale(0.8)`}
                      fill="#fff"
                    />
                  </g>
                </g>
              );
            }
            return (
              <g key={pin.id} transform={`translate(${x} ${y})`}>
                <g
                  className="pin-pop cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    trySelectPin(pin);
                  }}
                >
                  <title>
                    {`${pin.name}${pin.city ? `, ${pin.city}` : ""} — ${pinTypeWord(pin.type)} (${shape.label})`}
                  </title>
                  {/* Invisible hit target — fingers rarely land on the 4px dot. */}
                  <circle r={16} fill="transparent" />
                  <circle
                    r={selectedId === pin.id ? 8 : 5}
                    fill={PIN_FILL[pin.type] ?? "var(--reco)"}
                    opacity={selectedId === pin.id ? 0.3 : 0.2}
                  />
                  {/* Shape carries the type as well as the colour. */}
                  <path
                    d={shape.d}
                    fill={PIN_FILL[pin.type] ?? "var(--reco)"}
                    stroke="var(--card)"
                    strokeWidth={0.9}
                  />
                </g>
              </g>
            );
          })}
          {/* Countries you have been to: a ring, not a dot, and the name in
              small capitals, so it never reads as a city. */}
          {countryLabels.map(({ mark, x, y, side }) => (
            <g key={`country-${mark.key}`} className="pointer-events-none">
              <circle
                cx={x}
                cy={y}
                r={3.4}
                fill="var(--card)"
                stroke="var(--visited)"
                strokeWidth={1.6}
              />
              {side && (
                <text
                  x={side === "right" ? x + 6 : x - 6}
                  y={y + 3.5}
                  textAnchor={side === "right" ? "start" : "end"}
                  className={`text-[8.5px] font-semibold uppercase tracking-[0.08em] ${
                    relief ? "" : "fill-foreground"
                  }`}
                  style={relief ? { fill: "#fff" } : undefined}
                  stroke={relief ? "rgb(0 0 0 / 0.5)" : "var(--card)"}
                  strokeWidth={relief ? 1.2 : 2.5}
                  paintOrder="stroke"
                >
                  {mark.name}
                </text>
              )}
            </g>
          ))}
          {cityLabels.map(({ pin, x, y }) => {
            const name = pin.city ?? "";
            if (!open) {
              return (
                <text
                  key={`city-${pin.city}-${pin.id}`}
                  x={x + 7}
                  y={y - 6}
                  className="pointer-events-none fill-foreground text-[10.5px] font-semibold"
                  stroke="var(--card)"
                  strokeWidth={2.5}
                  paintOrder="stroke"
                >
                  {name}
                </text>
              );
            }
            // A pill beside the pin's head, as in the mockup.
            const pill = pillBox(name, x, y);
            return (
              <g
                key={`city-${pin.city}-${pin.id}`}
                transform={`translate(${pill.left} ${pill.top})`}
                className="pointer-events-none"
              >
                <rect
                  width={pill.right - pill.left}
                  height={pill.bottom - pill.top}
                  rx={8.5}
                  style={{ fill: "color-mix(in oklab, var(--card) 92%, transparent)" }}
                  stroke="color-mix(in oklab, var(--foreground) 12%, transparent)"
                  strokeWidth={0.5}
                />
                <text x={7} y={11.8} className="fill-foreground text-[9.5px] font-semibold">
                  {name}
                </text>
              </g>
            );
          })}
        </svg>

        {open ? (
          <div className="absolute bottom-1 left-1 flex overflow-hidden rounded-full border border-border bg-card/85 shadow-sm backdrop-blur">
            <button
              type="button"
              aria-label="Zoom in"
              className="grid size-11 place-items-center text-foreground"
              onClick={() => applyZoom(liveZoom.current + 0.2)}
            >
              <Plus className="size-5" aria-hidden />
            </button>
            <span className="w-px bg-border" />
            <button
              type="button"
              aria-label="Zoom out"
              className="grid size-11 place-items-center text-foreground"
              onClick={() => applyZoom(liveZoom.current - 0.2)}
            >
              <Minus className="size-5" aria-hidden />
            </button>
            <span className="w-px bg-border" />
            <button
              type="button"
              aria-label="Reset the view"
              title="Reset the view"
              className="grid size-11 place-items-center text-foreground"
              onClick={resetView}
            >
              <LocateFixed className="size-5" aria-hidden />
            </button>
          </div>
        ) : (
          <div className="absolute right-3 top-3 flex flex-col overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              aria-label="Zoom in"
              className="grid size-11 place-items-center text-base text-foreground"
              onClick={() => applyZoom(liveZoom.current + 0.2)}
            >
              +
            </button>
            <span className="h-px bg-border" />
            <button
              type="button"
              aria-label="Zoom out"
              className="grid size-11 place-items-center text-base text-foreground"
              onClick={() => applyZoom(liveZoom.current - 0.2)}
            >
              −
            </button>
            <span className="h-px bg-border" />
            <button
              type="button"
              aria-label="Reset the view"
              className="grid size-11 place-items-center text-foreground"
              onClick={resetView}
            >
              <RotateCcw className="size-4" aria-hidden />
            </button>
          </div>
        )}

        {/* The open globe keeps its edge clear, as in the mockup: the hint is for screen readers. */}
        <p
          className={
            open
              ? "sr-only"
              : "pointer-events-none absolute bottom-2.5 left-4 right-16 truncate text-[11px] text-muted-foreground"
          }
        >
          Drag to spin · pinch or +/− to zoom
        </p>
      </div>
    </div>
  );
}
