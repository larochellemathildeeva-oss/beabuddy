import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { markAutoSeedAttempted, shouldAutoSeed } from "@/lib/auto-seed";
import { safeStorage } from "@/lib/tour-state";

/**
 * Formerly filled empty accounts with sample data on first login.
 * Sample data is opt-in now (Home / You). This hook stays mounted-safe as a
 * no-op so a stray import cannot start the demo again.
 */
export function useAutoSeed() {
  const { user, loading } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (loading || !user || ran.current) return;
    ran.current = true;
    const storage = safeStorage();
    // shouldAutoSeed is always false; mark so any future re-enable still
    // respects "already visited" for this account on this device.
    if (!shouldAutoSeed(storage, user.id, { recommendations: 0, trips: 0, notes: 0 })) {
      markAutoSeedAttempted(storage, user.id);
    }
  }, [user, loading]);
}
