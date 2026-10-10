import { useEffect, useRef, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { Sheet } from "@/components/Sheet";
import {
  Backpack,
  CalendarDays,
  Camera,
  ChevronRight,
  Copy,
  FileText,
  MapIcon,
  MapPin,
  Coins,
  ListChecks,
  Pencil,
  Plus,
  Settings2,
  Ticket,
  X,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
} from "@/components/icons";

export type TripMenuSection =
  | "invite"
  | "budget"
  | "edit"
  | "offline"
  | "packing"
  | "cities"
  | "customize"
  | "checkup"
  | "again"
  | "preferences"
  | "photos";

export type BookingTile = "flight" | "stay" | "transport" | "activity";

type Icon = ComponentType<{ className?: string }>;

const SECTION_TITLES: Record<TripMenuSection, string> = {
  invite: "Invite and people",
  budget: "Budget",
  edit: "Edit trip",
  offline: "Offline maps",
  packing: "Packing",
  cities: "Destinations",
  customize: "View options",
  checkup: "Trip checkup",
  again: "Copy this trip",
  preferences: "Just for this trip",
  photos: "Trip photos",
};

/**
 * Trip settings, as the revamp draws it: a full page under the trip's name,
 * in three groups: Plan (Ask Béa, To do and packing, Bookings, Add a stop),
 * The trip (details, destinations, people, budget, currency, photos …) and
 * On this phone (offline maps, customize). Each row opens its section on this
 * same page, with a back arrow: the same forms the menu always had. Delete
 * sits at the foot, behind its own confirmation.
 */
export function TripMenuSheet({
  open,
  onClose,
  title,
  subtitle,
  section,
  onSection,
  people,
  bookings,
  onBookings,
  onAsk,
  onPrep,
  onAdd,
  onCurrency,
  citiesCount,
  offlineNote,
  budgetOn,
  checkupNote,
  onPrint,
  onCalendar,
  preferencesCount,
  photosCount,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** "Brazil · Oct 1 – 3". */
  subtitle: string;
  section: TripMenuSection | null;
  onSection: (next: TripMenuSection | null) => void;
  /** Names of the trip's members, for the people row's note. */
  people: string[];
  bookings: Record<BookingTile, number>;
  onBookings: (kind: BookingTile | "all") => void;
  /** Ask Béa about this trip: the planner. */
  onAsk: () => void;
  /** To do and packing. */
  onPrep: () => void;
  /** Add a stop, a saved place or a city. */
  onAdd: () => void;
  onCurrency: () => void;
  citiesCount: number;
  /** "Saved 2 days ago", or empty. */
  offlineNote: string;
  budgetOn: boolean;
  /** "3 to check" or "All clear"; the row is hidden when empty (nothing planned). */
  checkupNote: string;
  /** Print the plan, or save it as a PDF from the print dialog. */
  onPrint?: (() => void) | undefined;
  /** Download the trip as a calendar file. */
  onCalendar?: (() => void) | undefined;
  /** How many "just for this trip" preferences are set. */
  preferencesCount?: number | undefined;
  /** How many photos are on the trip, its stops' included. */
  photosCount?: number | undefined;
  /** Delete trip (owner) — the confirmation lives with it. */
  footer: ReactNode;
  /** The open section's body. */
  children: ReactNode;
}) {
  const count = (n: number, one: string, many: string) =>
    n > 0 ? `${n} ${n === 1 ? one : many}` : "";
  const booked = bookings.flight + bookings.stay + bookings.transport + bookings.activity;
  const travellers = count(people.length, "traveller", "travellers");

  const plan: Row[] = [
    {
      key: "ask",
      icon: Sparkles,
      title: "Ask Béa",
      note: "Plan, import, optimize or compare",
      tone: 5,
      onClick: onAsk,
    },
    {
      key: "prep",
      icon: ListChecks,
      title: "To do and packing",
      note: "Errands and the packing list",
      tone: 4,
      onClick: onPrep,
    },
    {
      key: "bookings",
      icon: Ticket,
      title: "Bookings",
      note:
        booked > 0
          ? `${count(booked, "booking", "bookings")} · flights, stays, tickets`
          : "Flights, stays, transport, tickets",
      tone: 2,
      onClick: () => onBookings("all"),
    },
    {
      key: "add",
      icon: Plus,
      title: "Add a stop",
      note: "A place, a saved rec or a city",
      tone: 3,
      onClick: onAdd,
    },
    ...(checkupNote
      ? [
          {
            key: "checkup",
            icon: ShieldCheck,
            title: "Trip checkup",
            note: `Clashes, tight gaps, missing bookings · ${checkupNote}`,
            tone: 1,
            onClick: () => onSection("checkup"),
          },
        ]
      : []),
  ];
  const trip: Row[] = [
    {
      key: "edit",
      icon: Pencil,
      title: "Edit trip",
      note: "Name, dates, starting city, status",
      tone: 4,
      onClick: () => onSection("edit"),
    },
    {
      key: "cities",
      icon: MapPin,
      title: "Destinations",
      note: count(citiesCount, "city", "cities") || "Cities and day order",
      tone: 2,
      onClick: () => onSection("cities"),
    },
    {
      key: "invite",
      icon: Users,
      title: "Invite and people",
      note: travellers ? `${travellers} · share the trip` : "Share the trip, manage travellers",
      tone: 3,
      onClick: () => onSection("invite"),
    },
    {
      key: "budget",
      icon: Wallet,
      title: "Budget",
      note: budgetOn ? "On · set a budget and track spending" : "Set a budget and track spending",
      tone: 4,
      onClick: () => onSection("budget"),
    },
    {
      key: "currency",
      icon: Coins,
      title: "Currency",
      note: "Convert prices into your money",
      tone: 1,
      onClick: onCurrency,
    },
    {
      key: "preferences",
      icon: Sparkles,
      title: "Just for this trip",
      note: preferencesCount ? `${preferencesCount} set` : "Late mornings, less walking…",
      tone: 1,
      onClick: () => onSection("preferences"),
    },
    {
      key: "photos",
      icon: Camera,
      title: "Photos",
      note: count(photosCount ?? 0, "photo", "photos") || "Add pictures to the trip",
      tone: 2,
      onClick: () => onSection("photos"),
    },
    {
      key: "packing",
      icon: Backpack,
      title: "Packing list",
      note: "Attach a saved packing list",
      tone: 5,
      onClick: () => onSection("packing"),
    },
    {
      key: "again",
      icon: Copy,
      title: "Copy this trip",
      note: "Copy the trip, or one day, to new dates",
      tone: 3,
      onClick: () => onSection("again"),
    },
    ...(onCalendar
      ? [
          {
            key: "calendar",
            icon: CalendarDays,
            title: "Add to calendar",
            note: "Every stop, as a calendar file",
            tone: 2,
            onClick: onCalendar,
          },
        ]
      : []),
    ...(onPrint
      ? [
          {
            key: "print",
            icon: FileText,
            title: "Print or PDF",
            note: "A paper copy of the plan",
            tone: 4,
            onClick: onPrint,
          },
        ]
      : []),
  ];
  const phone: Row[] = [
    {
      key: "offline",
      icon: MapIcon,
      title: "Offline maps",
      note: offlineNote
        ? `Kept on this phone · ${offlineNote}`
        : "Directions and maps without signal",
      tone: 2,
      onClick: () => onSection("offline"),
    },
    {
      key: "customize",
      icon: Settings2,
      title: "View options",
      note: "Ribbon, tracker, views bar",
      tone: 5,
      onClick: () => onSection("customize"),
    },
  ];

  // Back on the menu from a section (its arrow, Escape or a Done inside it):
  // focus returns to that section's row, not to a button that is gone.
  const lastSection = useRef<TripMenuSection | null>(null);
  useEffect(() => {
    const was = lastSection.current;
    lastSection.current = section;
    if (section || !was || !open) return;
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>(`[data-menu-row="${was}"]`)?.focus(),
    );
  }, [section, open]);

  return (
    <Sheet
      open={open}
      // Escape and the arrow go back to the menu first, then close it.
      onClose={() => (section ? onSection(null) : onClose())}
      page
      crumb={`${title} / Trip menu`}
      {...(section ? { backLabel: "Back to the trip menu" } : {})}
      tone={section ? 4 : 1}
      title={section ? SECTION_TITLES[section] : "Trip settings"}
      hint={section ? title : [title, subtitle].filter(Boolean).join(" · ")}
      actions={
        section ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close the trip menu"
            className="tap-target grid shrink-0 place-items-center rounded-full"
          >
            <span className="grid size-10 place-items-center rounded-full border border-border bg-card shadow-xs">
              <X className="size-5" aria-hidden />
            </span>
          </button>
        ) : undefined
      }
    >
      {section ? (
        children
      ) : (
        <div className="pb-4">
          <Group name="Plan" rows={plan} />
          <Group name="The trip" rows={trip} />
          <Group name="On this phone" rows={phone} />
          {footer ? <div className="menu-footer">{footer}</div> : null}
          <button type="button" onClick={onClose} className="menu-done bg-primary">
            Done
          </button>
        </div>
      )}
    </Sheet>
  );
}

type Row = {
  key: string;
  icon: Icon;
  title: string;
  note: string;
  tone: number;
  onClick: () => void;
};

function Group({ name, rows }: { name: string; rows: Row[] }) {
  return (
    <section aria-label={name} className="menu-group">
      <h2 className="mono-caps menu-group-label">{name}</h2>
      <div>
        {rows.map((row) => (
          <button
            key={row.key}
            type="button"
            data-menu-row={row.key}
            onClick={row.onClick}
            className="menu-row"
          >
            <span className="menu-row-title">{row.title}</span>
            <span className="menu-row-note">{row.note}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
