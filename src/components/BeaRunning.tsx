import { useEffect, useState } from "react";
import logo from "@/assets/bea-logo.png";
import { beaMomentPool } from "@/lib/bea-voice";

/** Long enough to read, short enough that a long wait still changes. */
const LINE_MS = 4_200;

/**
 * Béa running on the spot, for a wait worth explaining.
 *
 * Placing a planned trip is a queue of one-a-second lookups, so it can run
 * half a minute — the one wait in this app long enough to read a sentence
 * twice. A spinner would say only that something is happening. This says who
 * is doing it and why it takes a while, which is the difference between
 * waiting and wondering whether it has hung.
 *
 * The line rotates so a long wait does not stare back with the same sentence,
 * and the progress count is real rather than a fake creeping bar.
 */
export function BeaRunning({
  done,
  total,
  estimate,
}: {
  /** Stops placed so far. */
  done?: number;
  /** Stops to place in all. */
  total?: number;
  /** Rough seconds remaining, shown once and not counted down. */
  estimate?: number;
}) {
  const pool = beaMomentPool("plan.locating");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (pool.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % pool.length), LINE_MS);
    return () => clearInterval(id);
  }, [pool.length]);

  const line = pool[index % pool.length]!;
  const counted = typeof done === "number" && typeof total === "number" && total > 0;

  return (
    <div className="rounded-xl bg-elevated p-3" role="status" aria-live="polite" aria-busy="true">
      <div className="flex items-center gap-3">
        <span className="relative grid size-12 shrink-0 place-items-end justify-items-center">
          <img src={logo} alt="" className="bea-run size-10 rounded-full object-contain" />
          <span className="bea-track absolute inset-x-0 bottom-0 h-[3px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] font-semibold leading-tight">{line.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{line.body}</p>
        </div>
      </div>

      {counted && (
        <>
          <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-all duration-(--t-shift) ease-(--ease-standard)"
              style={{ width: `${Math.round((done! / total!) * 100)}%` }}
            />
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground">
            {done} of {total} placed
            {estimate && estimate > 0 && done! < total! ? ` · about ${estimate}s in all` : ""}
          </p>
        </>
      )}
    </div>
  );
}
