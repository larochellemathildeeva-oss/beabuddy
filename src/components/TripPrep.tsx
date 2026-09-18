import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PackingBody } from "@/components/PackingLists";
import { TripTodosBody } from "@/components/TripTodos";

export type PrepTab = "todo" | "packing";

/**
 * Everything left to do before you leave, in one place: the errands and the
 * packing. They used to be two sheets behind two icons, which asked you to
 * decide which kind of unfinished thing you had in mind before you could look
 * at either. They are the same question, so they are now one sheet with two
 * views.
 */
export function TripPrep({
  tripId,
  uid,
  international,
  hasLodging,
  hasFlights,
  tripStart,
  openSignal,
}: {
  tripId: string;
  uid: string | null;
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
  tripStart?: string | null | undefined;
  /** Bumped by the trip card's icon to open the sheet. */
  openSignal?: number;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PrepTab>("todo");

  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setTab("todo");
      setOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open) return null;

  const tabs: { id: PrepTab; label: string }[] = [
    { id: "todo", label: "To do" },
    { id: "packing", label: "Packing" },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Before you go"
        onClick={(e) => e.stopPropagation()}
        className="rise flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-card sm:rounded-2xl"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p className="font-display text-[16.5px] leading-tight text-foreground">Before you go</p>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close before you go"
            className="shrink-0 rounded-full border border-border px-3 py-1 text-[13px]"
          >
            Close
          </button>
        </div>

        <div className="flex gap-1.5 border-b border-border px-4 py-2" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-full border px-3 py-1.5 text-[13px] font-semibold ${
                tab === t.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4 pt-3">
          {tab === "todo" ? (
            <TripTodosBody
              tripId={tripId}
              uid={uid}
              international={international}
              hasLodging={hasLodging}
              hasFlights={hasFlights}
              tripStart={tripStart}
            />
          ) : (
            <PackingBody tripId={tripId} />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
