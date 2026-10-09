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
    // The minimalist "Béa is working on it." block: a 2px rule (the real
    // progress when it can count, else a still full rule), then the step.
    <div className="pt-1">
      <div className="h-0.5 w-full bg-[var(--rule)]">
        <div
          className="h-full bg-foreground transition-all duration-(--t-shift) ease-(--ease-standard)"
          style={{ width: counted ? `${Math.round((done! / total!) * 100)}%` : "100%" }}
        />
      </div>
      <BeaLoader active action={action ?? WORK[moment] ?? "think"} status={status} compact />
      {counted && (
        <p className="border-b border-border pb-3 text-[14px] leading-[20px] text-muted-foreground">
          {done} of {total} placed
          {estimate && estimate > 0 && done! < total! ? ` · about ${estimate}s in all` : ""}
        </p>
      )}
    </div>
  );
}
