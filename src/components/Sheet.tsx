import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, X } from "@/components/icons";
import { joinSheetStack } from "@/components/sheet-stack";
import { BrandMark } from "@/components/PageHeader";

/** How far the sheet must be pulled down before letting go closes it. */
const PULL_CLOSE_PX = 90;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  onBack,
  actions,
  width = "md",
  showClose = true,
  above = false,
  tall = false,
  dismissible = true,
  page = false,
  crumb,
  backLabel,
  tone = 5,
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
  /** A back arrow at the header's left, for a sheet with screens inside it. */
  onBack?: (() => void) | undefined;
  /** Header actions, right of the title and left of the close button. */
  actions?: ReactNode;
  width?: "sm" | "md" | "lg";
  /** Off only where the panel's own body carries the single way out. */
  showClose?: boolean;
  /**
   * For a sheet that opens on top of another one — a confirmation over the
   * settings panel that raised it. Portals stack in mount order, so this is
   * belt and braces rather than the only thing holding it up.
   */
  above?: boolean;
  /** Nearly the whole screen, for a sheet whose forms should fit without scrolling. */
  tall?: boolean;
  /**
   * False while work is running that closing would hide (Béa drafting a
   * plan): the scrim, a pull and Escape then do nothing. The close button
   * stays, so there is always a deliberate way out.
   */
  dismissible?: boolean;
  /**
   * A full page over the trip instead of a panel: the logo row with a back
   * arrow, the hint as a spaced kicker, and the title large with a full
   * stop, as the revamp draws every trip subpage. Same open, Escape and
   * focus rules as the panel.
   */
  page?: boolean;
  /** The mono breadcrumb beside a page's arrow ("Japan / Trip menu"). */
  crumb?: string;
  /** What a page's back arrow is called, when it goes back rather than closes. */
  backLabel?: string;
  /** The pastel (1–5) behind a page's header in Colorful; the others stay plain. */
  tone?: 1 | 2 | 3 | 4 | 5;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement | null>(null);
  // The latest values, read by the listener without re-adding it each render
  // (callers often pass a fresh onClose closure).
  const latest = useRef({ onClose, dismissible });
  latest.current = { onClose, dismissible };

  useEffect(() => {
    if (!open) return;
    const { isTop, leave } = joinSheetStack();
    // Focus goes into the sheet, and back to what opened it afterwards.
    // React has already run autoFocus inside the sheet by now, so the opener
    // is only what had focus if it sits outside the panel.
    const active = document.activeElement;
    const opener =
      active instanceof HTMLElement && !panel.current?.contains(active) ? active : null;
    // A field that focused itself (autoFocus) keeps it; otherwise the sheet
    // takes focus, so the keyboard and a screen reader start inside it.
    if (!panel.current?.contains(document.activeElement)) {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current;
      first?.focus({ preventScroll: true });
    }

    const onKey = (e: KeyboardEvent) => {
      if (!isTop()) return;
      if (e.key === "Escape") {
        if (latest.current.dismissible) latest.current.onClose();
        return;
      }
      if (e.key !== "Tab" || !panel.current) return;
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (items.length === 0) return;
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      const now = document.activeElement;
      if (e.shiftKey && (now === firstItem || now === panel.current)) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && now === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      leave();
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [open]);

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
    if (pull > PULL_CLOSE_PX && dismissible) onClose();
    setPull(0);
  };

  if (!open) return null;

  if (page) {
    const heading = /[.!?…]$/.test(title) ? title : `${title}.`;
    return createPortal(
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`sub-page rise fixed inset-0 flex flex-col bg-background outline-none ${
          above ? "z-[60]" : "z-50"
        }`}
        style={{ "--page-tone": `var(--tile-${tone})` } as CSSProperties}
      >
        <header className="sub-page-head shrink-0 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <BrandMark />
            <div className="ms-auto flex shrink-0 items-center gap-1.5">
              {actions}
              {onBack && showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={`Close ${title.toLowerCase()}`}
                  className="tap-target grid shrink-0 place-items-center rounded-full"
                >
                  <span className="grid size-10 place-items-center rounded-full border border-border bg-card shadow-xs">
                    <X className="size-5" aria-hidden />
                  </span>
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onBack ?? onClose}
            // Where the arrow is the only way out, a busy page keeps it from closing.
            disabled={!showClose && !onBack}
            aria-label={
              backLabel ??
              (onBack
                ? crumb
                  ? `Back, ${crumb}`
                  : "Back"
                : crumb
                  ? `${crumb}, close ${title.toLowerCase()}`
                  : `Close ${title.toLowerCase()}`)
            }
            className="sub-page-crumb mono-caps mt-3 flex min-h-11 items-center gap-3 text-left"
          >
            <ArrowLeft className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{crumb ?? (onBack ? "Back" : "Close")}</span>
          </button>
          {hint ? <p className="label-caps mt-2 max-w-[34ch]">{hint}</p> : null}
          <h1 className="sub-page-title mt-1 break-words font-display">{heading}</h1>
        </header>
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2">
          <div className="mx-auto w-full max-w-xl">{children}</div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4 ${
        above ? "z-[60]" : "z-50"
      }`}
      onClick={dismissible ? onClose : undefined}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={pull ? { transform: `translateY(${pull}px)`, transition: "none" } : undefined}
        className={`sheet-panel rise card-raised transition-transform flex ${tall ? "max-h-[94dvh]" : "max-h-[88dvh]"} w-full flex-col overflow-hidden outline-none rounded-t-[var(--r-sheet)] sm:rounded-[var(--r-sheet)] ${
          width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-xl" : "max-w-md"
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
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="tap-target -my-1.5 -ml-1.5 grid shrink-0 place-items-center self-center rounded-full"
              >
                <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
                  <ArrowLeft className="size-4" aria-hidden />
                </span>
              </button>
            )}
            {icon && <div className="shrink-0">{icon}</div>}
            <div className="min-w-0 flex-1">
              <p className="sheet-title font-display text-[19px] leading-tight text-foreground">
                {title}
              </p>
              {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
            </div>
            {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()}`}
                className="tap-target -my-1.5 -mr-1.5 grid shrink-0 place-items-center rounded-full"
              >
                <span className="grid size-8 place-items-center rounded-full border border-border text-muted-foreground">
                  <X className="size-4" aria-hidden />
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Its own scroll, which never hands the page a swipe; and clear of
            the home indicator on a phone with one. */}
        <div className="flex-1 overflow-y-auto overscroll-contain px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
