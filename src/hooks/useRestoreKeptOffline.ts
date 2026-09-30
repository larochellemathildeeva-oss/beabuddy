import { useEffect } from "react";
import { restoreKeptOffline } from "@/lib/directions-account";

/** Once per page load and traveller: every screen mounts the shell. */
const started = new Set<string>();

/**
 * After sign-in, the trips this traveller kept offline come back onto the
 * phone from their account (`restoreKeptOffline`), without opening each one.
 * Quiet: nothing to say when there is nothing to bring back, and the trip
 * page says it is kept offline as usual when there is.
 */
export function useRestoreKeptOffline(uid: string | null | undefined) {
  useEffect(() => {
    if (!uid || started.has(uid)) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    started.add(uid);
    void restoreKeptOffline(uid).catch(() => {
      // Tried again on the next page load; each trip also asks when it opens.
      started.delete(uid);
    });
  }, [uid]);
}
