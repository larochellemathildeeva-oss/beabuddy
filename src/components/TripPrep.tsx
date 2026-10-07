import { useCallback, useEffect, useState, type ComponentType } from "react";
import { Backpack, ListChecks, MoreHorizontal, type LucideProps } from "@/components/icons";
import { PackingBody } from "@/components/PackingLists";
import { Sheet } from "@/components/Sheet";
import { TripTodosBody } from "@/components/TripTodos";
import { useTripPrepFacts } from "@/hooks/useTripPrepFacts";

export type PrepTab = "todo" | "packing";

/** One line in the sheet's ⋯ menu, offered by whichever view is showing. */
export type PrepMenuItem = {
  id: string;
  label: string;
  icon?: ComponentType<LucideProps>;
  danger?: boolean;
  onSelect: () => void;
};

/**
 * Everything left to do before you leave, in one place: the errands and the
 * packing. They used to be two sheets behind two icons, which asked you to
 * decide which kind of unfinished thing you had in mind before you could look
 * at either. They are the same question, so they are now one sheet with two
 * views: "To do" and "Packing", each titled as its own page with the trip's
 * place and dates under it, and the other view one tap away in the ⋯ menu.
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
  /** Open on this tab: from the page's arrival link or the Overview's tiles. */
  openTab?: { tab: PrepTab; n: number } | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<PrepTab>("todo");
  const [menuOpen, setMenuOpen] = useState(false);
  /** The showing view's own lines for the ⋯ menu. */
  const [viewMenu, setViewMenu] = useState<{ tab: PrepTab; items: PrepMenuItem[] } | null>(null);
  const facts = useTripPrepFacts(tripId, open);

  useEffect(() => {
    if (openSignal && openSignal > 0) {
      setTab("todo");
      setOpen(true);
    }
  }, [openSignal]);

  useEffect(() => {
    if (openTab) {
      setTab(openTab.tab);
      setOpen(true);
    }
  }, [openTab]);

  useEffect(() => {
    setMenuOpen(false);
  }, [tab, open]);

  const menu = viewMenu?.tab === tab ? viewMenu.items : [];
  const onTodoMenu = useCallback(
    (items: PrepMenuItem[]) => setViewMenu({ tab: "todo", items }),
    [],
  );
  const onPackMenu = useCallback(
    (items: PrepMenuItem[]) => setViewMenu({ tab: "packing", items }),
    [],
  );

  const actions = (
    <div className="relative">
      <button
        type="button"
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen((v) => !v)}
        className="grid size-9 place-items-center rounded-full border border-border bg-card text-foreground"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>
      <Sheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        page
        above
        title="Before you go"
        hint={`${tab === "todo" ? "To do" : "Packing"} / More`}
        crumb="Trip menu"
      >
        <div role="menu">
          {menu.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                item.onSelect();
              }}
              className={`menu-row menu-row-title ${item.danger ? "text-destructive" : ""}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="menu-done bg-primary mono-caps"
        >
          Done
        </button>
      </Sheet>
    </div>
  );

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title="Before you go"
      hint={facts.line || "To-dos and the packing list"}
      actions={actions}
      page
      tone={4}
    >
      <div
        role="tablist"
        aria-label="To do or packing"
        className="plain-card sticky top-0 z-10 mb-3 grid grid-cols-2 gap-1 p-1"
      >
        {(
          [
            ["todo", "To do", ListChecks],
            ["packing", "Packing", Backpack],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl text-[16px] font-semibold ${
              tab === id ? "bg-primary-soft text-foreground" : "text-muted-foreground"
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
          facts={facts.facts}
          onMenu={onTodoMenu}
        />
      ) : (
        <PackingBody tripId={tripId} onMenu={onPackMenu} />
      )}
    </Sheet>
  );
}
