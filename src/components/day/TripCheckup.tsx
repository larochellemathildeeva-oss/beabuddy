import { ChevronRight, Info, ShieldCheck } from "@/components/icons";
import { checkupHeadline, type CheckupFinding } from "@/lib/trip-checkup";

/**
 * The Trip checkup section of the trip menu: one line from Béa, then each
 * thing worth a second look, tappable when it is about a stop. A plan the
 * checks cannot fault says so and nothing more.
 */
export function TripCheckup({
  findings,
  onOpenStop,
}: {
  findings: readonly CheckupFinding[];
  onOpenStop: (stopId: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="plain-card flex items-start gap-3 p-3.5">
        <ShieldCheck className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="min-w-0">
          <p className="text-[17px] font-semibold leading-snug">{checkupHeadline(findings)}</p>
          <p className="mt-1 text-[16px] leading-snug text-muted-foreground">
            Worked out from the times, pins and bookings already on the plan, and the expiry dates
            of passports and visas in Protected. Béa only flags what she can measure, so a stop with
            no time or no pin is left alone.
          </p>
        </div>
      </div>

      {findings.length > 0 && (
        <ul className="plain-card divide-y divide-border overflow-hidden">
          {findings.map((finding) => {
            const body = (
              <>
                <span
                  aria-hidden
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${
                    finding.tone === "warn" ? "bg-destructive" : "bg-muted-foreground/50"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  {finding.dayLabel ? (
                    <span className="label-caps block">{finding.dayLabel}</span>
                  ) : null}
                  <span className="block text-[16px] leading-snug">{finding.text}</span>
                </span>
              </>
            );
            const stopId = finding.stopId;
            return (
              <li key={finding.key}>
                {stopId ? (
                  <button
                    type="button"
                    onClick={() => onOpenStop(stopId)}
                    className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                  >
                    {body}
                    <ChevronRight
                      className="mt-1 size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </button>
                ) : (
                  <div className="flex items-start gap-3 px-3.5 py-3">
                    {body}
                    <Info className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
