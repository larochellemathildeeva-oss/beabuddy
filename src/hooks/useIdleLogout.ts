import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { IDLE_LOGOUT_MS, isIdleExpired } from "@/lib/idle-logout";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "touchstart", "scroll"] as const;

/**
 * Signs the user out after IDLE_LOGOUT_MS with no interaction.
 * Mount only while signed in. Activity on the window resets the timer.
 */
export function useIdleLogout(enabled: boolean) {
  const lastActivityRef = useRef(Date.now());
  const signingOutRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    signingOutRef.current = false;

    const bump = () => {
      lastActivityRef.current = Date.now();
    };

    const maybeSignOut = async () => {
      if (signingOutRef.current) return;
      if (!isIdleExpired(lastActivityRef.current)) return;
      signingOutRef.current = true;
      try {
        await supabase.auth.signOut();
      } catch {
        signingOutRef.current = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void maybeSignOut();
    };

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, bump, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    const tick = window.setInterval(() => void maybeSignOut(), 30_000);

    return () => {
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, bump);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(tick);
    };
  }, [enabled]);
}

export { IDLE_LOGOUT_MS };
