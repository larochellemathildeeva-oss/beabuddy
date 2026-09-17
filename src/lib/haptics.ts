/**
 * A short tap, on the platforms that have one.
 *
 * iOS Safari has no vibration API at all, so haptics can never be the only
 * feedback for anything — treat it strictly as a bonus on top of a visible
 * change. Anything that only buzzes is invisible to roughly half the people
 * using the app.
 *
 * Also suppressed under reduced motion: someone who has asked the system for
 * less movement has not asked for their phone to buzz instead.
 */
export const TAP_MS = 8;
export const CONFIRM_MS = 14;

type Env = {
  vibrate?: ((pattern: number | number[]) => boolean) | undefined;
  prefersReducedMotion?: boolean | undefined;
};

/** The decision, separated from the platform so it can be tested. */
export function shouldBuzz(env: Env): boolean {
  if (typeof env.vibrate !== "function") return false;
  if (env.prefersReducedMotion) return false;
  return true;
}

function currentEnv(): Env {
  if (typeof navigator === "undefined" || typeof window === "undefined") return {};
  return {
    vibrate:
      typeof navigator.vibrate === "function" ? navigator.vibrate.bind(navigator) : undefined,
    prefersReducedMotion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  };
}

function buzz(ms: number) {
  const env = currentEnv();
  if (!shouldBuzz(env)) return;
  try {
    env.vibrate?.(ms);
  } catch {
    /* Some browsers throw when the page is not visible. Never worth failing a
       click over — the visible feedback has already happened. */
  }
}

/** Something small landed: a tick, a chip, a row added. */
export const tap = () => buzz(TAP_MS);

/** Something you might have worried about landed: a save, an undo. */
export const confirm = () => buzz(CONFIRM_MS);
