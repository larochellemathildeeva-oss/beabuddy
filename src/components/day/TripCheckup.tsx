import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleCheck, Info } from "@/components/icons";
import { supabase } from "@/integrations/supabase/client";
import {
  checkupHeadline,
  tripCheckup,
  type CheckupDocument,
  type CheckupIdDocument,
  type CheckupItem,
} from "@/lib/trip-checkup";

/**
 * Trip Checkup, in the trip menu: everything Béa found worth a second look,
 * the things that can spoil a day first. A finding about a stop or a day
 * opens it on the timeline.
 *
 * Passports and visas are read from Protected by kind, name and expiry only —
 * the three columns that are never encrypted — so the checkup works with the
 * vault locked and never asks for the passcode.
 */
export function TripCheckup({
  trip,
  items,
  documents,
  onOpen,
}: {
  trip: { start_date: string | null; end_date: string | null };
  items: readonly CheckupItem[];
  documents: readonly CheckupDocument[];
  onOpen: (target: { itemId?: string; day?: string }) => void;
}) {
  const idDocuments = useIdDocuments();
  const findings = useMemo(
    () => tripCheckup({ trip, items, documents, idDocuments }),
    [trip, items, documents, idDocuments],
  );

  return (
    <div className="space-y-3">
      <p className="plain-card flex items-start gap-2 p-3.5 text-[14.5px]">
        {findings.length === 0 ? (
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        ) : null}
        <span>{checkupHeadline(findings)}</span>
      </p>
      {findings.length > 0 && (
        <ul className="plain-card divide-y divide-border overflow-hidden">
          {findings.map((finding) => {
            const target = finding.itemId || finding.day;
            const body = (
              <>
                <span
                  aria-hidden
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                    finding.level === "warn" ? "bg-destructive" : "bg-primary"
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold leading-snug">
                    <span className="sr-only">
                      {finding.level === "warn" ? "Needs fixing: " : "Worth a look: "}
                    </span>
                    {finding.title}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-muted-foreground">
                    {finding.detail}
                  </span>
                </span>
                {target ? (
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                ) : null}
              </>
            );
            return (
              <li key={finding.id}>
                {target ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpen({
                        ...(finding.itemId ? { itemId: finding.itemId } : {}),
                        ...(finding.day ? { day: finding.day } : {}),
                      })
                    }
                    className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left"
                  >
                    {body}
                  </button>
                ) : (
                  <div className="flex items-start gap-2.5 px-3.5 py-3">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="flex items-start gap-1.5 px-0.5 text-[12px] text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Journey times here are estimated from the pins, so a clash is only flagged when it is clear.
        Opening hours are checked on each stop's own card.
      </p>
    </div>
  );
}

/** Passports and visas in Protected: kind, name and expiry, never the contents. */
function useIdDocuments(): CheckupIdDocument[] {
  const [docs, setDocs] = useState<CheckupIdDocument[]>([]);
  useEffect(() => {
    let active = true;
    void supabase
      .from("vault_documents")
      .select("kind, label, expires_on")
      .in("kind", ["Passport", "Visa"])
      .then(({ data }) => {
        if (active) setDocs((data ?? []) as CheckupIdDocument[]);
      });
    return () => {
      active = false;
    };
  }, []);
  return docs;
}
