import { useEffect, useState } from "react";
import { PackingBody } from "@/components/PackingLists";
import { Sheet } from "@/components/Sheet";
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

  const tabs: { id: PrepTab; label: string }[] = [
    { id: "todo", label: "To do" },
    { id: "packing", label: "Packing" },
  ];

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="To do">
      <div className="mb-3 flex gap-1.5" role="tablist">
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
    </Sheet>
  );
}
