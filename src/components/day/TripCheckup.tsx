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
  // As Figma "trip-checkup" (116:1766): Béa's line, then each finding as a
  // row — what it is over where to look — and one button to the first one.
  const first = findings.find((finding) => finding.stopId);
  return (
    <div className="trip-overview">
      <p className="trip-row-title">{checkupHeadline(findings)}</p>
      <p className="trip-row-note text-muted-foreground">
        Worked out from the times, pins and bookings already on the plan, and the expiry dates of
        passports and visas in Protected. Béa only flags what she can measure, so a stop with no
        time or no pin is left alone.
      </p>
      {findings.length > 0 && (
        <ul className="trip-overview">
          {findings.map((finding) => {
            const stopId = finding.stopId;
            const note = [finding.dayLabel, stopId ? "Open stop" : ""].filter(Boolean).join(" / ");
            const body = (
              <>
                <span className="trip-row-title flex items-start gap-2">
                  {finding.tone === "warn" ? (
                    <span
                      aria-hidden
                      className="mt-2 size-2 shrink-0 rounded-full bg-destructive"
                    />
                  ) : null}
                  <span className="min-w-0">{finding.text}</span>
                </span>
                {note ? <span className="trip-row-note">{note}</span> : null}
              </>
            );
            return (
              <li key={finding.key}>
                {stopId ? (
                  <button type="button" onClick={() => onOpenStop(stopId)} className="trip-row">
                    {body}
                  </button>
                ) : (
                  <div className="trip-row">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {first?.stopId ? (
        <button type="button" onClick={() => onOpenStop(first.stopId!)} className="trip-primary">
          Review the plan
        </button>
      ) : null}
    </div>
  );
}
