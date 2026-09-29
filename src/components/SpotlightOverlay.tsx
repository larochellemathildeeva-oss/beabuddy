import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { guideTargetLooksVisible } from "@/lib/guide-target";

export type SpotlightBox = { top: number; left: number; width: number; height: number };

/** Resolve a guide/tour selector to a visible element, or null. */
export function findGuideTarget(selector?: string): HTMLElement | null {
  if (!selector || typeof document === "undefined") return null;
  const el = document.querySelector<HTMLElement>(selector);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  if (!guideTargetLooksVisible(rect, style)) return null;
  return el;
}

export function measureGuideTarget(el: HTMLElement): SpotlightBox {
  const r = el.getBoundingClientRect();
  return { top: r.top - 6, left: r.left - 6, width: r.width + 12, height: r.height + 12 };
}

/**
 * Remeasure after scroll / CSS enter animations settle. Call `onBox` immediately
 * and again over ~rise duration (0.55s). Returns a cancel function.
 */
export function trackGuideTargetSettle(
  el: HTMLElement,
  onBox: (box: SpotlightBox) => void,
): () => void {
  const measure = () => onBox(measureGuideTarget(el));
  measure();

  const timers: number[] = [];
  const schedule = (ms: number) => {
    timers.push(window.setTimeout(measure, ms));
  };
  // Double-rAF for post-scroll layout, then cover the 0.55s `rise` animation.
  let raf2 = 0;
  const raf1 = window.requestAnimationFrame(() => {
    raf2 = window.requestAnimationFrame(() => {
      measure();
      schedule(50);
      schedule(150);
      schedule(300);
      schedule(560);
    });
  });

  const observer = new ResizeObserver(measure);
  observer.observe(el);

  return () => {
    window.cancelAnimationFrame(raf1);
    window.cancelAnimationFrame(raf2);
    for (const id of timers) window.clearTimeout(id);
    observer.disconnect();
  };
}

/** Space kept between the sheet and the target, and from the screen's edge. */
const SHEET_GAP = 14;
const EDGE = 8;

/**
 * Dimmed cutout around a target (PageGuide / welcome tour). The hole has no
 * hit target so clicks reach the page underneath — needed for interactive steps.
 */
export function SpotlightOverlay({
  box,
  onDismiss,
  children,
}: {
  box: SpotlightBox | null;
  onDismiss?: () => void;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  useLayoutEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    // scrollHeight: the whole sheet, even while it is clamped below.
    const read = () => setSheetHeight(el.scrollHeight);
    read();
    if (typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const belowTarget = box ? box.top + box.height < window.innerHeight * 0.55 : true;
  // A target low on the screen (the last card on a page cannot scroll to the
  // middle) gets the sheet above it when there is room, not pinned to the
  // bottom on top of the very thing it is pointing at.
  // Measured, not guessed, so a tall sheet never runs off the top.
  const aboveTarget =
    !belowTarget && !!box && sheetHeight > 0 && box.top >= sheetHeight + SHEET_GAP + EDGE;

  return (
    <div role="presentation" className="pointer-events-none fixed inset-0 z-[60]">
      {box ? (
        <>
          <div
            className="pointer-events-auto absolute bg-black/55"
            style={{ top: 0, left: 0, right: 0, height: Math.max(box.top, 0) }}
            onClick={onDismiss}
          />
          <div
            className="pointer-events-auto absolute bg-black/55"
            style={{ top: box.top + box.height, left: 0, right: 0, bottom: 0 }}
            onClick={onDismiss}
          />
          <div
            className="pointer-events-auto absolute bg-black/55"
            style={{ top: box.top, left: 0, width: Math.max(box.left, 0), height: box.height }}
            onClick={onDismiss}
          />
          <div
            className="pointer-events-auto absolute bg-black/55"
            style={{ top: box.top, left: box.left + box.width, right: 0, height: box.height }}
            onClick={onDismiss}
          />
          <div
            className="absolute rounded-2xl ring-2 ring-primary"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/55" onClick={onDismiss} />
      )}

      <div
        ref={sheetRef}
        className="pointer-events-auto absolute inset-x-0 flex justify-center overflow-y-auto px-4"
        style={sheetPlacement(box, belowTarget, aboveTarget)}
      >
        {children}
      </div>
    </div>
  );
}

/** Where the sheet sits, clamped so its header and close button stay on screen. */
function sheetPlacement(
  box: SpotlightBox | null,
  belowTarget: boolean,
  aboveTarget: boolean,
): CSSProperties {
  const vh = window.innerHeight;
  if (belowTarget) {
    const top = Math.max((box ? box.top + box.height : 0) + SHEET_GAP, EDGE);
    return { top, maxHeight: Math.max(vh - top - EDGE, 160) };
  }
  const bottom = aboveTarget && box ? vh - box.top + SHEET_GAP : 90;
  return { bottom, maxHeight: Math.max(vh - bottom - EDGE, 160) };
}
