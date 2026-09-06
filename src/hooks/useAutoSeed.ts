import { useEffect, useRef } from "react";
import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { loadDemoSeed } from "@/lib/demo-seed";
import { markAutoSeedAttempted, shouldAutoSeed } from "@/lib/auto-seed";
import { safeStorage } from "@/lib/tour-state";

/**
 * Fills a brand-new account with sample travel data on first login, so the
 * globe, Near, travel stats and the guided walk all have something to describe.
 * "Remove sample" on You clears it, and the marker means that choice sticks.
 *
 * Deliberately quiet: it never blocks a render and never surfaces an error. If
 * seeding fails the account is simply empty, which is where it started.
 */
export function useAutoSeed() {
  const { user, loading } = useAuth();
  // Guards against a second pass while the first is still in flight — the
  // storage marker is only written once the attempt finishes.
  const running = useRef(false);

  useEffect(() => {
    if (loading || !user || running.current) return;
    const uid = user.id;
    const storage = safeStorage();
    // Cheap pre-check before touching the network at all.
    if (!shouldAutoSeed(storage, uid, { recommendations: 0, trips: 0, notes: 0 })) return;

    running.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const [recos, trips, notes] = await Promise.all([
          supabase.from("recommendations").select("id", { count: "exact", head: true }).eq("user_id", uid),
          supabase.from("trips").select("id", { count: "exact", head: true }).eq("owner_id", uid),
          supabase.from("future_notes").select("id", { count: "exact", head: true }).eq("user_id", uid),
        ]);
        if (cancelled) return;
        // A failed count must not read as "empty" — that would seed on top of
        // real data the query simply could not see.
        if (recos.error || trips.error || notes.error) return;

        const counts = {
          recommendations: recos.count ?? 0,
          trips: trips.count ?? 0,
          notes: notes.count ?? 0,
        };
        if (!shouldAutoSeed(storage, uid, counts)) return;

        await loadDemoSeed();
      } catch {
        /* first-run nicety: never let it break the app */
      } finally {
        // Whether it worked or not. Retrying on every page load would hammer
        // the database and could half-fill the account.
        if (!cancelled) markAutoSeedAttempted(storage, uid);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, loading]);
}
