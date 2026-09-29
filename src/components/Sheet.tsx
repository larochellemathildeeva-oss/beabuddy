import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "@/components/icons";

/** How far the sheet must be pulled down before letting go closes it. */
const PULL_CLOSE_PX = 90;

/**
 * The fifth primitive: anything that opens over the page.
 *
 * Six screens hand-rolled this — a fixed-inset scrim, a panel, a close button
 * — and they disagreed about every part of it. Three max-heights (85vh, 88vh,
 * 92dvh), two radii, three paddings, a close button that was an ✕ glyph on one
 * screen and an icon on another, and Escape and body-scroll-lock present on
 * some and missing on others. The last of those is not cosmetic: a sheet you
 * cannot dismiss with a key, over a page that scrolls underneath you, is a
 * different component to the one next to it.
 *
 * Not to be confused with `components/ui/sheet`, which is the vendored
 * side-drawer from the component library. This is Béa's own, and it is the one
 * app code should reach for.
 */
export function Sheet({
  open,
  onClose,
  title,
  hint,
  icon,
  actions,
  width = "md",
  showClose = true,
  above = false,
  children,
}: {
  open: boolean;
  /** Runs on the scrim, the close button and Escape alike. */
  onClose: () => void;
  title: string;
  /** One line under the title. Never a paragraph — that belongs in the body. */
  hint?: ReactNode;
  /** A mark before the title, for the planner's logo and its like. */
  icon?: ReactNode;
  /** Header actions, right of the title and left of the close button. */
  actions?: ReactNode;
  width?: "sm" | "md";
  /** Off only where the panel's own body carries the single way out. */
  showClose?: boolean;
  /**
   * For a sheet that opens on top of another one — a confirmation over the
   * settings panel that raised it. Portals stack in mount order, so this is
   * belt and braces rather than the only thing holding it up.
   */
  above?: boolean;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Pull the top of the sheet down to close it, as on a phone's own sheets.
  // Only from the handle and the header, never the body, which scrolls; and
  // never from a button or field in the header.
  const [pull, setPull] = useState(0);
  const pullFrom = useRef<number | null>(null);
  const onPullStart = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
    pullFrom.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPullMove = (e: PointerEvent<HTMLDivElement>) => {
    if (pullFrom.current == null) return;
    setPull(Math.max(0, e.clientY - pullFrom.current));
  };
  const onPullEnd = () => {
    if (pullFrom.current == null) return;
    pullFrom.current = null;
    if (pull > PULL_CLOSE_PX) onClose();
    setPull(0);
  };

  if (!open) return null;

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 ${
        above ? "z-[60]" : "z-50"
      }`}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={pull ? { transform: `translateY(${pull}px)`, transition: "none" } : undefined}
        className={`rise card-raised transition-transform flex max-h-[88vh] w-full flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl ${
          width === "sm" ? "max-w-sm" : "max-w-md"
        }`}
      >
        <div
          onPointerDown={onPullStart}
          onPointerMove={onPullMove}
          onPointerUp={onPullEnd}
          onPointerCancel={onPullEnd}
          className="touch-none"
        >
          {/* The handle, where a thumb looks for it; phones only. */}
          <div className="flex justify-center pt-2 sm:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-border" />
          </div>
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="min-w-0 flex-1">
              <p className="font-display text-[19px] leading-tight text-foreground">{title}</p>
              {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()}`}
                className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
