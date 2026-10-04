import { CalendarDays } from "@/components/icons";

/**
 * The top of Companion: the day as a wide painted banner. "DAY 1 OF 3", the
 * place large in the serif, the date, and a white pill with how many stops
 * are behind you and a small bar. No weather icon: the app only knows rain,
 * and says so below when it is likely.
 */
export function CompanionBanner({
  art,
  kicker,
  place,
  dateLine,
  reached,
  total,
}: {
  art: string;
  /** "Day 1 of 3", or empty for an undated day. */
  kicker: string;
  place: string;
  dateLine: string;
  reached: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((reached / total) * 100) : 0;
  return (
    <section
      aria-label={[kicker, place, dateLine].filter(Boolean).join(", ")}
      className="relative isolate overflow-hidden rounded-[var(--r-card)] shadow-sm"
    >
      <img src={art} alt="" className="art-dim absolute inset-0 -z-10 size-full object-cover" />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/60 via-black/30 to-transparent"
      />
      <div className="flex min-h-[132px] items-end justify-between gap-3 p-4 text-white">
        <div className="min-w-0">
          {kicker ? (
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-white/90">
              {kicker}
            </p>
          ) : null}
          <h2 className="truncate font-display text-[38px] leading-none">{place}</h2>
          {dateLine ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[14px] text-white/95">
              <CalendarDays className="size-4" aria-hidden />
              {dateLine}
            </p>
          ) : null}
        </div>
        <div className="w-[112px] shrink-0 rounded-2xl bg-card px-3 py-2 text-foreground shadow-md">
          <p className="text-[15px]">
            <span className="font-bold">
              {reached}/{total}
            </span>{" "}
            stops
          </p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-elevated">
              <span
                className="block h-full rounded-full bg-primary"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="text-[13px] tabular-nums text-muted-foreground">{percent}%</span>
          </div>
        </div>
      </div>
    </section>
  );
}
