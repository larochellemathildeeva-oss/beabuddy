import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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

const TOUR_EVENT = "bea-tour-start";

export function useTourControl() {
  const [open, setOpen] = useState(false);
  const { user, loading } = useAuth();

  // Only members get the walk. Opening it for a signed-out visitor put the
  // sheet over the sign-in form and then navigated them into gated routes,
  // which AppShell bounced straight back to /auth.
  useEffect(() => {
    if (loading || !user) return;
    if (shouldAutoOpenTour(safeStorage(), { signedIn: true })) setOpen(true);
  }, [user, loading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const reopen = () => setOpen(true);
    window.addEventListener(TOUR_EVENT, reopen);
    return () => window.removeEventListener(TOUR_EVENT, reopen);
  }, []);

  return { open, setOpen };
}

function openTourSheet() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TOUR_EVENT));
}

/**
 * A brand-new account lands in the walk — unless they already dismissed it.
 * Signing up is not a reason to re-ask someone who skipped a minute ago, so
 * this never clears the seen mark. Safe to call from more than one place.
 */
export function startFirstRunTour() {
  if (!shouldAutoOpenTour(safeStorage(), { signedIn: true })) return;
  openTourSheet();
}

/**
 * "Replay" from Profile. Starts the walk from the top without un-marking it as
 * seen — leaving mid-replay must not make the next session look brand new.
 */
export function resumeOrReplayTour() {
  beginTourReplay(safeStorage());
  openTourSheet();
}

export function Tour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [i, setI] = useState(0);
  const [mode, setMode] = useState<TourMode | null>(null);
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const steps = mode ? tourSteps(mode) : [];
  const step = mode ? steps[i] : undefined;
  const blocked = !!step?.needsAuth && !user;

  useEffect(() => {
    if (!open) return;
    const saved = readTourProgress(safeStorage());
    setMode(saved?.mode ?? null);
    setI(saved?.step ?? 0);
  }, [open]);

  // Write on every move, so closing the tab mid-Deep-Dive costs one step, not
  // all forty-two. Nothing is stored until they have picked a mode.
  useEffect(() => {
    if (!open || !mode) return;
    saveTourProgress(safeStorage(), { mode, step: i });
  }, [open, mode, i]);

  // Bring up the screen each step is talking about.
  useEffect(() => {
    if (!open || loading || !mode || !step?.to) return;
    if (step.needsAuth && !user) return; // signed-out users would just hit the sign-in wall
    navigate({ to: step.to });
  }, [open, i, mode, user, loading, navigate, step]);

  if (!open) return null;

  const finish = () => {
    markTourSeen(safeStorage());
    onClose();
  };

  const pick = (next: TourMode) => {
    setMode(next);
    setI(0);
  };

  if (!mode) {
    return (
      <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4">
        <div className="pointer-events-auto w-full max-w-[480px] rounded-3xl border border-border bg-background p-5 shadow-xl">
          <div className="flex items-center justify-between">
            <p className="label-caps">Welcome</p>
            <button onClick={finish} className="text-[12px] text-muted-foreground underline">
              Skip
            </button>
          </div>

          <h2 className="mt-2 font-display text-[24px] leading-tight">How shall we walk?</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
            Béa can take you around the block, or she can open every cupboard.
          </p>

          <div className="mt-4 space-y-2">
            <button
              onClick={() => pick("quick")}
              className="w-full rounded-2xl border border-border px-4 py-3.5 text-left transition-colors hover:bg-elevated"
            >
              <span className="block text-[15px] font-semibold">A quick walk around the block</span>
              <span className="mt-0.5 block text-[12px] text-muted-foreground">
                The highlights. A few minutes.
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
      </div>
    );
  }

  const last = i === steps.length - 1;

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-4">
      <div className="pointer-events-auto w-full max-w-[480px] rounded-3xl border border-border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="label-caps">
            {mode === "deep" ? "Deep Dive" : "Around the block"} · {i + 1} of {steps.length}
          </p>
          <button onClick={finish} className="text-[12px] text-muted-foreground underline">
            Skip
          </button>
        </div>

        <h2 className="mt-2 font-display text-[24px] leading-tight">{step!.title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{step!.body}</p>
        {blocked && (
          <p className="mt-2 text-[12px] italic text-muted-foreground">
            This screen opens once you're signed in — for now, picture it here.
          </p>
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

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => (i === 0 ? setMode(null) : setI(i - 1))}
            className="flex-1 rounded-xl border border-border px-4 py-3 text-[14px] font-semibold"
          >
            Back
          </button>
          <button
            onClick={() => (last ? finish() : setI(i + 1))}
            className="flex-1 rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground"
          >
            {last ? "Start using Béa" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
