import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useRouterState } from "@tanstack/react-router";
import { guideKeyForPath } from "@/lib/guide-key";
import { guides } from "@/lib/page-guides";
import { HelpCircle, X } from "@/components/icons";
import {
  findGuideTarget,
  measureGuideTarget,
  SpotlightOverlay,
  trackGuideTargetSettle,
  type SpotlightBox,
} from "./SpotlightOverlay";

/**
 * The "?" at the top right of a page: what this page is for and what you can
 * do on it, then — if you want it — a spotlight walk of the parts on screen.
 *
 * It used to be a sparkle, the same mark as Béa's AI features, so nobody read
 * it as help. The overview comes first because a walk can only point at what
 * is on screen, and an empty page has little to point at.
 */
/** Fired by the header Menu to open this page's guide. */
export const OPEN_GUIDE_EVENT = "bea:open-guide";

/** `round`: Home's header word "Help", set beside "Search" in the same quiet type. */
export function PageGuide({
  round = false,
  hideToggle = false,
}: { round?: boolean; hideToggle?: boolean } = {}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  /** -1 is the overview; 0 and up are the spotlight steps. */
  const [i, setI] = useState(-1);
  const [box, setBox] = useState<SpotlightBox | null>(null);

  const guide = useMemo(() => {
    const key = guideKeyForPath(pathname, Object.keys(guides));
    return key ? (guides[key] ?? null) : null;
  }, [pathname]);
  const steps = useMemo(
    () =>
      !guide || typeof document === "undefined"
        ? []
        : guide.steps.filter((candidate) => findGuideTarget(candidate.selector)),
    // `open` re-reads the page: targets appear as data loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [guide, open],
  );
  const step = i >= 0 ? steps[i] : undefined;

  const measure = useCallback(() => {
    if (!step) return;
    const el = findGuideTarget(step.selector);
    if (!el) {
      setBox(null);
      return;
    }
    setBox(measureGuideTarget(el));
  }, [step]);

  useEffect(() => {
    if (!open || !step) {
      setBox(null);
      return;
    }
    const el = findGuideTarget(step.selector);
    el?.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    const stopSettle = el
      ? trackGuideTargetSettle(el, setBox)
      : (() => {
          setBox(null);
          return () => undefined;
        })();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      stopSettle();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, i, step, measure]);

  useEffect(() => {
    setOpen(false);
    setI(-1);
  }, [pathname]);

  // The header's Menu opens help by this event, so the one guide stays mounted.
  useEffect(() => {
    const show = () => {
      setI(-1);
      setOpen(true);
    };
    window.addEventListener(OPEN_GUIDE_EVENT, show);
    return () => window.removeEventListener(OPEN_GUIDE_EVENT, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!guide) return null;

  const toggle = (
    <button
      hidden={hideToggle && !open}
      onClick={() => {
        if (open) {
          setOpen(false);
          return;
        }
        setI(-1);
        setOpen(true);
      }}
      className={
        round
          ? `mono-caps grid min-h-11 min-w-11 place-items-center px-1 text-[13px] text-muted-foreground transition-colors ${open ? "text-foreground underline underline-offset-4" : ""}`
          : `grid size-7 place-items-center rounded-full border bg-card transition-colors ${
              open
                ? "border-primary text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`
      }
      aria-label={open ? "Close help" : `Help: what you can do on ${guide.name}`}
      aria-expanded={open}
      title={open ? "Close help" : "Help for this page"}
    >
      {round ? "Help" : <HelpCircle className="size-4" />}
    </button>
  );

  if (!open) return toggle;

  const last = i >= steps.length - 1;
  const onHelpPage = pathname === "/help";

  const overview = (
    <>
      <h2 className="mt-1.5 border-b border-[var(--rule)] pb-3 text-[28px] font-bold leading-[1.2]">
        {guide.name}
      </h2>
      <p className="mt-3 text-[14px] leading-[1.4] text-foreground">{guide.about}</p>
      <ul
        aria-label="What you can do here"
        className="mt-2 max-h-[40dvh] overflow-y-auto text-[14px] leading-[1.4]"
      >
        {guide.features.map((feature) => (
          <li key={feature} className="border-b border-[var(--rule)] py-3">
            {feature}
          </li>
        ))}
      </ul>
      {!onHelpPage && (
        <Link
          to="/help"
          onClick={() => setOpen(false)}
          className="mt-1 flex min-h-11 items-center text-[14px] text-foreground underline underline-offset-4"
        >
          Step-by-step walks and answers: Help
        </Link>
      )}
      <div className="mt-3 grid gap-2">
        {steps.length > 0 && (
          <button
            onClick={() => setI(0)}
            className="btn-primary flex w-full items-center justify-center px-4"
          >
            Start guide
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className={
            steps.length > 0
              ? "flex min-h-[52px] w-full items-center justify-center rounded-[var(--r-card)] border border-border bg-card px-4 text-[16px] font-medium text-foreground"
              : "btn-primary flex w-full items-center justify-center px-4"
          }
        >
          Got it
        </button>
      </div>
    </>
  );

  const walk = step ? (
    <>
      <h2 className="mt-1.5 text-[20px] font-bold leading-[1.2]">{step.title}</h2>
      <p className="mt-1.5 text-[14px] leading-[1.4] text-foreground">{step.body}</p>
      {!box && (
        <p className="mt-1.5 text-[13px] italic text-muted-foreground">
          This part isn't on screen right now.
        </p>
      )}

      <div className="mt-3 flex gap-1">
        {steps.map((_, n) => (
          <span
            key={n}
            className={`h-1 flex-1 rounded-full ${n <= i ? "bg-primary" : "bg-border"}`}
          />
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => setI(i - 1)}
          className="flex min-h-[52px] flex-1 items-center justify-center rounded-[var(--r-card)] border border-border bg-card px-4 text-[16px] font-medium"
        >
          Back
        </button>
        <button
          onClick={() => (last ? setOpen(false) : setI(i + 1))}
          className="btn-primary flex flex-1 items-center justify-center px-4"
        >
          {last ? "Got it" : "Next"}
        </button>
      </div>
    </>
  ) : null;

  return (
    <>
      {toggle}

      {createPortal(
        <div role="dialog" aria-label={`Help: ${guide.name}`}>
          <SpotlightOverlay box={step ? box : null} onDismiss={() => setOpen(false)}>
            <div className="w-full max-w-[420px] rounded-[var(--r-card)] border border-border bg-background p-4 shadow-xl">
              <div className="flex items-center justify-between">
                <p className="text-[12px] text-foreground">
                  {step ? `${guide.name} · ${i + 1} of ${steps.length}` : "Page guide"}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close help"
                  className="-mr-2 grid size-11 place-items-center text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              {walk ?? overview}
            </div>
          </SpotlightOverlay>
        </div>,
        document.body,
      )}
    </>
  );
}
