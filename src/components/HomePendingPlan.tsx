import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { safeStorage } from "@/lib/tour-state";
import { clearPendingTryPlan, peekPendingTryPlan } from "@/lib/try-plan";

/**
 * A plan pasted on the landing page before sign-up, still waiting. The
 * confirmation email opens a new tab, which loses the way back to the new
 * trip, so Home offers it instead.
 */
export function HomePendingPlan() {
  const [waiting, setWaiting] = useState(false);

  // Read after mount (the server cannot see the phone's storage), and again
  // when another tab saves, uses or discards the plan.
  useEffect(() => {
    const check = () => setWaiting(Boolean(peekPendingTryPlan(safeStorage())));
    check();
    window.addEventListener("storage", check);
    return () => window.removeEventListener("storage", check);
  }, []);

  if (!waiting) return null;

  return (
    <section className="rise plain-card p-5">
      <p className="font-display text-[20px] leading-snug">Your plan is waiting.</p>
      <p className="mt-1 text-[14.5px] text-muted-foreground">
        The one you pasted before signing up. Make it a trip and Béa pins every stop.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Link
          to="/trips"
          search={{ new: true, plan: "import", from: "try" }}
          onClick={(e) => {
            // Used or discarded in another tab since: nothing to carry.
            if (!peekPendingTryPlan(safeStorage())) {
              e.preventDefault();
              setWaiting(false);
            }
          }}
          className="btn-primary grid place-items-center px-4 text-[14.5px]"
        >
          Make it a trip
        </Link>
        <button
          type="button"
          onClick={() => {
            clearPendingTryPlan(safeStorage());
            setWaiting(false);
          }}
          className="inline-flex min-h-11 min-w-11 items-center text-[13px] text-muted-foreground underline underline-offset-4"
        >
          Discard it
        </button>
      </div>
    </section>
  );
}
