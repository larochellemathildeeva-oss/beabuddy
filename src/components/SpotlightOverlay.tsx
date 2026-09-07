import type { ReactNode } from "react";
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
  const belowTarget = box ? box.top + box.height < window.innerHeight * 0.55 : true;

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
            className="absolute rounded-2xl ring-2 ring-primary transition-all duration-300"
            style={{ top: box.top, left: box.left, width: box.width, height: box.height }}
          />
        </>
      ) : (
        <div className="pointer-events-auto absolute inset-0 bg-black/55" onClick={onDismiss} />
      )}

      <div
        className="pointer-events-auto absolute inset-x-0 flex justify-center px-4"
        style={belowTarget ? { top: (box ? box.top + box.height : 0) + 14 } : { bottom: 90 }}
      >
        {children}
      </div>
    </div>
  );
}
