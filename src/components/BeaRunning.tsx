import { BeaLoader } from "@/components/BeaLoader";
import type { BeaWork } from "@/lib/bea-personality";
import type { BeaMoment } from "@/lib/bea-voice";

/** What Béa is doing in each of these waits, and so how she is drawn. */
const WORK: Partial<Record<BeaMoment, BeaWork>> = {
  "plan.working": "run",
  "plan.locating": "run",
  "choose.working": "think",
  "photos.working": "think",
};

/**
 * A wait worth explaining: "Béa is working on it…", her animation for the
 * work, a line in the traveller's chosen personality, and — when the work can
 * count — the real progress, never a fake creeping bar.
 *
 * Placing a planned trip is a queue of one-a-second lookups, so it can run
 * half a minute: the count and the rough estimate say it has not hung.
 */
export function BeaRunning({
  moment = "plan.locating",
  action,
  status,
  done,
  total,
  estimate,
}: {
  /** Which wait this is. */
  moment?: BeaMoment;
  /** Overrides the animation the moment would pick. */
  action?: BeaWork;
  /** The real step, when there is one. */
  status?: string;
  /** Stops placed so far. */
  done?: number;
  /** Stops to place in all. */
  total?: number;
  /** Rough seconds remaining, shown once and not counted down. */
  estimate?: number;
}) {
  const counted = typeof done === "number" && typeof total === "number" && total > 0;
  return (
    <div className="rounded-2xl bg-elevated px-3 pb-3">
      <BeaLoader active action={action ?? WORK[moment] ?? "think"} status={status} compact />
      {counted && (
        <>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-all duration-(--t-shift) ease-(--ease-standard)"
              style={{ width: `${Math.round((done! / total!) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-center text-[12px] text-muted-foreground">
            {done} of {total} placed
            {estimate && estimate > 0 && done! < total! ? ` · about ${estimate}s in all` : ""}
          </p>
        </>
      )}
    </div>
  );
}
