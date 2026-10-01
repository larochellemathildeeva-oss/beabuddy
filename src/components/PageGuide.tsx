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
export function PageGuide() {
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
      onClick={() => {
        if (open) {
          setOpen(false);
          return;
        }
        setI(-1);
        setOpen(true);
      }}
      className={`grid size-7 place-items-center rounded-full border bg-card transition-colors ${
        open
          ? "border-primary text-primary"
          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
      }`}
      aria-label={open ? "Close help" : `Help: what you can do on ${guide.name}`}
      aria-expanded={open}
      title={open ? "Close help" : "Help for this page"}
    >
      <HelpCircle className="size-4" />
    </button>
  );

  if (!open) return toggle;

  const last = i >= steps.length - 1;
  const onHelpPage = pathname === "/help";

  const overview = (
    <>
      <h2 className="mt-1.5 font-display text-[20px] leading-tight">{guide.name}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{guide.about}</p>
      <p className="label-caps mt-3 text-foreground">What you can do here</p>
      <ul className="mt-1.5 max-h-[40dvh] space-y-1.5 overflow-y-auto text-[14px] leading-snug">
        {guide.features.map((feature) => (
          <li key={feature} className="flex gap-2">
            <span aria-hidden className="mt-[7px] size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>
      {!onHelpPage && (
        <Link
          to="/help"
          onClick={() => setOpen(false)}
          className="mt-3 inline-block text-[13px] font-semibold text-primary underline underline-offset-2"
        >
          Step-by-step walks and answers: Help
        </Link>
      )}
      <div className="mt-3 flex gap-2">
        {steps.length > 0 && (
          <button
            onClick={() => setI(0)}
            className="flex-1 whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
          >
            Show me around
          </button>
        )}
        <button
          onClick={() => setOpen(false)}
          className={`flex-1 rounded-xl px-4 py-2 text-[14.5px] font-semibold ${
            steps.length > 0 ? "border border-border" : "bg-primary text-primary-foreground"
          }`}
        >
          Got it
        </button>
      </div>
    </>
  );

  const walk = step ? (
    <>
      <h2 className="mt-1.5 font-display text-[20px] leading-tight">{step.title}</h2>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted-foreground">{step.body}</p>
      {!box && (
        <p className="mt-1.5 text-[12px] italic text-muted-foreground">
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
          className="flex-1 rounded-xl border border-border px-4 py-2 text-[14.5px] font-semibold"
        >
          Back
        </button>
        <button
          onClick={() => (last ? setOpen(false) : setI(i + 1))}
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
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
            <div className="w-full max-w-[420px] rounded-2xl border border-border bg-background p-3.5 shadow-2xl">
              <div className="flex items-center justify-between">
                <p className="label-caps">
                  {step ? `${guide.name} · ${i + 1} of ${steps.length}` : "Help"}
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close help"
                  className="text-muted-foreground"
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
