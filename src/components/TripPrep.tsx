import { useEffect, useState } from "react";
import { Backpack, ListChecks } from "@/components/icons";
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
  tripEnd,
  openSignal,
  openTab,
}: {
  tripId: string;
  uid: string | null;
  international: boolean;
  hasLodging: boolean;
  hasFlights: boolean;
  tripStart?: string | null | undefined;
  tripEnd?: string | null | undefined;
  /** Bumped by the trip card's icon to open the sheet. */
  openSignal?: number;
  /** Open on this tab when the page arrives with one. */
  openTab?: PrepTab | undefined;
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
    if (openTab) {
      setTab(openTab);
      setOpen(true);
    }
  }, [openTab]);

  const tabs = [
    { id: "todo", label: "To do", Icon: ListChecks },
    { id: "packing", label: "Packing", Icon: Backpack },
  ] as const;

  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="To do">
      <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-full bg-elevated p-1">
        {tabs.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex items-center justify-center gap-1.5 rounded-full py-2 text-[14px] font-semibold transition-colors ${
              tab === id ? "bg-primary text-primary-foreground shadow-xs" : "text-muted-foreground"
            }`}
          >
            <Icon className="size-4" aria-hidden />
            {label}
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
          tripEnd={tripEnd}
        />
      ) : (
        <PackingBody tripId={tripId} />
      )}
    </Sheet>
  );
}
