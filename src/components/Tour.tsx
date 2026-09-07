import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type TourMode, tourSteps } from "@/lib/tour";
import {
  beginTourReplay,
  markTourSeen,
  readTourProgress,
  safeStorage,
  saveTourProgress,
  shouldAutoOpenTour,
} from "@/lib/tour-state";
import {
  findGuideTarget,
  measureGuideTarget,
  SpotlightOverlay,
  type SpotlightBox,
} from "./SpotlightOverlay";

const TOUR_EVENT = "bea-tour-start";
/** Polls for a target after route navigation before treating it as missing. */
const TARGET_TRIES = 12;
const TARGET_RETRY_MS = 50;

export type TourIntent = "first-run" | "replay";

type TourStartDetail = { intent: TourIntent };

export function useTourControl() {
  const [open, setOpen] = useState(false);
  const [intent, setIntent] = useState<TourIntent>("first-run");
  const { user, loading } = useAuth();

  // Only members get the walk. Opening it for a signed-out visitor put the
  // sheet over the sign-in form and then navigated them into gated routes,
  // which AppShell bounced straight back to /auth.
  useEffect(() => {
    if (loading || !user) return;
    if (shouldAutoOpenTour(safeStorage(), { signedIn: true })) {
      setIntent("first-run");
      setOpen(true);
    }
  }, [user, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reopen = (event: Event) => {
      const detail = (event as CustomEvent<TourStartDetail>).detail;
      setIntent(detail?.intent === "replay" ? "replay" : "first-run");
      setOpen(true);
    };
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  return { open, setOpen, intent };
}

function openTourSheet(intent: TourIntent) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<TourStartDetail>(TOUR_EVENT, { detail: { intent } }));
}

/**
 * A brand-new account lands in the walk — unless they already dismissed it.
 * Signing up is not a reason to re-ask someone who skipped a minute ago, so
 * this never clears the seen mark. Safe to call from more than one place.
 */
export function startFirstRunTour() {
  if (!shouldAutoOpenTour(safeStorage(), { signedIn: true })) return;
  openTourSheet("first-run");
}

/**
 * "Replay" from Profile. Starts the walk from the top without un-marking it as
 * seen — leaving mid-replay must not make the next session look brand new.
 * Chooser (quick vs deep) only appears on this path.
 */
export function resumeOrReplayTour() {
  beginTourReplay(safeStorage());
  openTourSheet("replay");
}

export function Tour({
  open,
  onClose,
  intent = "first-run",
}: {
  open: boolean;
  onClose: () => void;
  intent?: TourIntent;
}) {
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<TourMode | null>(null);
  const [box, setBox] = useState<SpotlightBox | null>(null);
  const [clicked, setClicked] = useState(false);
  /** False while a selector step is still waiting for a painted target. */
  const [targetReady, setTargetReady] = useState(true);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const steps = mode ? tourSteps(mode) : [];
  const step = mode ? steps[i] : undefined;
  const blocked = !!step?.needsAuth && !user;
  // Only lock Next when there is something visible to tap — never soft-lock
  // on an empty shell or a still-loading target.
  const needsClick = !!step?.awaitClick && !!box && !clicked;

  const finish = useCallback(() => {
    markTourSeen(safeStorage());
    onClose();
  }, [onClose]);

  /** Backdrop near-miss: close the sheet but leave first-run eligible. */
  const dismissSoft = useCallback(() => {
    onClose();
  }, [onClose]);

  const advanceOrFinish = useCallback(() => {
    if (i >= steps.length - 1) {
      finish();
      return;
    }
    setI((n) => n + 1);
  }, [i, steps.length, finish]);

  useEffect(() => {
    if (!open) return;
    const saved = readTourProgress(safeStorage());
    if (saved) {
      setMode(saved.mode);
      setI(saved.step);
      return;
    }
    // First sign-in: one canonical path so early feedback is comparable.
    // Replay keeps the Quick / Deep chooser.
    if (intent === "first-run") {
      setMode("quick");
      setI(0);
    } else {
      setMode(null);
      setI(0);
    }
  }, [open, intent]);

  // Write on every move, so closing the tab mid-Deep-Dive costs one step, not
  // all forty-two. Nothing is stored until they have a mode.
  useEffect(() => {
    if (!open || !mode) return;
    saveTourProgress(safeStorage(), { mode, step: i });
  }, [open, mode, i]);

  // Bring up the screen each step is talking about.
  useEffect(() => {
    if (!open || loading || !mode || !step?.to) return;
    if (step.needsAuth && !user) return;
    navigate({ to: step.to });
  }, [open, i, mode, user, loading, navigate, step]);

  const measure = useCallback(() => {
    if (!step?.selector) {
      setBox(null);
      return;
    }
    const el = findGuideTarget(step.selector);
    if (!el) {
      setBox(null);
      return;
    }
    setBox(measureGuideTarget(el));
  }, [step]);

  // Spotlight: wait for a painted target after navigation, then track it.
  // Missing targets skip ahead (or finish on the last step) — never leave
  // awaitClick with Next disabled and nothing to tap.
  useEffect(() => {
    if (!open || !mode || !step) return;
    setClicked(false);
    if (!step.selector) {
      setBox(null);
      setTargetReady(true);
      return;
    }

    setTargetReady(false);
    setBox(null);
    let cancelled = false;
    let tries = 0;
    const tick = () => {
      if (cancelled) return;
      const el = findGuideTarget(step.selector);
      if (el) {
        el.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        setBox(measureGuideTarget(el));
        setTargetReady(true);
        return;
      }
      setBox(null);
      if (tries++ < TARGET_TRIES) {
        window.setTimeout(tick, TARGET_RETRY_MS);
        return;
      }
      setTargetReady(true);
      advanceOrFinish();
    };
    const frame = window.requestAnimationFrame(tick);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, mode, step, measure, advanceOrFinish]);

  // Interactive beats: any click inside the highlighted control unlocks Next.
  useEffect(() => {
    if (!open || !step?.awaitClick || !step.selector || !box) return;
    const el = findGuideTarget(step.selector);
    if (!el) return;
    const onClick = () => setClicked(true);
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, [open, step, box, i]);

  if (!open) return null;

  const pick = (next: TourMode) => {
    setMode(next);
    setI(0);
  };

  if (!mode) {
    return createPortal(
      <div className="pointer-events-none fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4">
        <div className="pointer-events-auto w-full max-w-[480px] rounded-3xl border border-border bg-background p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="label-caps">Replay</p>
            <button onClick={finish} className="text-[12px] text-muted-foreground underline">
              Skip
            </button>
          </div>

          <h2 className="mt-2 font-display text-[24px] leading-tight">How shall we walk?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            First sign-in already took the quick walk. Pick that again, or open every cupboard.
          </p>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => pick("quick")}
              className="w-full rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:bg-elevated"
            >
              <span className="block text-[15px] font-semibold">A quick walk around the block</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                Spotlight highlights. A few taps. A few minutes.
              </span>
            </button>
            <button
              onClick={() => pick("deep")}
              className="w-full rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:bg-elevated"
            >
              <span className="block text-[15px] font-semibold">Deep Dive</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                Every feature, explained. Bring a coffee.
              </span>
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const last = i === steps.length - 1;
  const showCopy = targetReady;

  const sheet = (
    <div className="w-full max-w-[420px] rounded-2xl border border-border bg-background p-3.5 shadow-2xl">
      <div className="flex items-center justify-between">
        <p className="label-caps">
          {mode === "deep" ? "Deep Dive" : "Around the block"} · {i + 1} of {steps.length}
        </p>
        <button onClick={finish} aria-label="Skip tour" className="text-muted-foreground">
          <X className="size-4" />
        </button>
      </div>

          {showCopy ? (
            <>
              <h2 className="mt-1.5 font-display text-[20px] leading-tight">{step!.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{step!.body}</p>
              {blocked && (
                <p className="mt-1.5 text-[11px] italic text-muted-foreground">
                  This screen opens once you're signed in — for now, picture it here.
                </p>
              )}
              {step?.awaitClick && box && !clicked && (
                <p className="mt-1.5 text-[11px] font-medium text-primary">
                  {step.actionHint ?? "Tap the highlighted bit, then Next"}
                </p>
              )}
              {step?.awaitClick && box && clicked && (
                <p className="mt-1.5 text-[11px] font-medium text-primary">
                  {step.actionDoneHint ?? "Got it — tap Next"}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">Finding that bit of the screen…</p>
          )}

      {mode === "deep" ? (
        <div className="mt-3 h-1 rounded-full bg-border">
          <div
            className="h-1 rounded-full bg-primary transition-[width] duration-200"
            style={{ width: `${((i + 1) / steps.length) * 100}%` }}
          />
        </div>
      ) : (
        <div className="mt-3 flex gap-1">
          {steps.map((_, n) => (
            <span
              key={n}
              className={`h-1 flex-1 rounded-full ${n <= i ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => {
            if (i === 0) {
              if (intent === "replay") setMode(null);
              return;
            }
            setI(i - 1);
          }}
          className="flex-1 rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
        >
          Back
        </button>
        <button
          disabled={needsClick || !showCopy}
          onClick={() => (last ? finish() : setI(i + 1))}
          className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {last ? "Start using Béa" : "Next"}
        </button>
      </div>
    </div>
  );

  return createPortal(
    <div role="dialog" aria-label="Welcome tour">
      <SpotlightOverlay box={step?.selector ? box : null} onDismiss={dismissSoft}>
        {sheet}
      </SpotlightOverlay>
    </div>,
    document.body,
  );
}
