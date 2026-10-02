import { useEffect, type ComponentType, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Backpack,
  Bed,
  CalendarDays,
  Camera,
  Car,
  ChevronRight,
  Copy,
  FileText,
  MapIcon,
  MapPin,
  Pencil,
  Plane,
  Settings2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  Wallet,
  X,
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
  customize: "Customize view",
  checkup: "Trip checkup",
  again: "Do it again",
  preferences: "Just for this trip",
  photos: "Trip photos",
};

/**
 * The trip menu (⋯), as the master draws it: the trip's name large with its
 * country and dates, an "Edit trip" card with the trip's picture, then Trip
 * planning and Tools & preferences as two columns of cards, and Delete at the
 * foot. Each card opens its section of this same sheet — the same forms the
 * menu always had — with a back arrow; the four booking cards switch the page
 * to the Timeline, where bookings live on their stops.
 */
export function TripMenuSheet({
  open,
  onClose,
  title,
  subtitle,
  art,
  section,
  onSection,
  people,
  bookings,
  onBookings,
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
  art: string;
  section: TripMenuSection | null;
  onSection: (next: TripMenuSection | null) => void;
  /** Names of the trip's members, for the little avatars. */
  people: string[];
  bookings: Record<BookingTile, number>;
  onBookings: (kind: BookingTile) => void;
  citiesCount: number;
  /** "Saved 2 days ago", or empty. */
  offlineNote: string;
  budgetOn: boolean;
  /** "3 to check" or "All clear"; the card is hidden when empty (nothing planned). */
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
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (section) onSection(null);
        else onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, onSection, section]);

  if (!open) return null;

  const count = (n: number, one: string, many: string) =>
    n > 0 ? `${n} ${n === 1 ? one : many}` : "";
  const planning: {
    key: string;
    icon: Icon;
    title: string;
    note: string;
    pill?: string;
    extra?: ReactNode;
    onClick: () => void;
  }[] = [
    {
      key: "invite",
      icon: Users,
      title: "Invite and people",
      note: "Share the trip, manage travellers",
      extra: people.length ? <Avatars names={people} /> : null,
      onClick: () => onSection("invite"),
    },
    {
      key: "flight",
      icon: Plane,
      title: "Flights",
      note: "View and manage your flights",
      pill: count(bookings.flight, "booking", "bookings"),
      onClick: () => onBookings("flight"),
    },
    {
      key: "stay",
      icon: Bed,
      title: "Hotels",
      note: "View and manage your stays",
      pill: count(bookings.stay, "booking", "bookings"),
      onClick: () => onBookings("stay"),
    },
    {
      key: "transport",
      icon: Car,
      title: "Transport",
      note: "Cars, transfers and other transport",
      pill: count(bookings.transport, "booking", "bookings"),
      onClick: () => onBookings("transport"),
    },
    {
      key: "activity",
      icon: Ticket,
      title: "Activities",
      note: "Tours, tickets and reservations",
      pill: count(bookings.activity, "booking", "bookings"),
      onClick: () => onBookings("activity"),
    },
    {
      key: "preferences",
      icon: Sparkles,
      title: "Just for this trip",
      note: "Late mornings, less walking…",
      pill: preferencesCount ? `${preferencesCount} set` : "",
      onClick: () => onSection("preferences"),
    },
    {
      key: "photos",
      icon: Camera,
      title: "Photos",
      note: "Add pictures to the trip",
      pill: count(photosCount ?? 0, "photo", "photos"),
      onClick: () => onSection("photos"),
    },
    {
      key: "budget",
      icon: Wallet,
      title: "Budget",
      note: "Set a budget and track spending",
      pill: budgetOn ? "On" : "",
      onClick: () => onSection("budget"),
    },
    {
      key: "cities",
      icon: MapPin,
      title: "Destinations",
      note: "Cities and day order",
      pill: count(citiesCount, "city", "cities"),
      onClick: () => onSection("cities"),
    },
    {
      key: "packing",
      icon: Backpack,
      title: "Packing",
      note: "Attach a packing list",
      onClick: () => onSection("packing"),
    },
  ];
  const tools = [
    ...(checkupNote
      ? [
          {
            key: "checkup",
            icon: ShieldCheck,
            title: "Trip checkup",
            note: "Clashes, tight gaps, missing bookings",
            pill: checkupNote,
            onClick: () => onSection("checkup"),
          },
        ]
      : []),
    {
      key: "offline",
      icon: MapIcon,
      title: "Offline maps",
      note: "Maps kept on this phone",
      pill: offlineNote,
      onClick: () => onSection("offline"),
    },
    {
      key: "customize",
      icon: Settings2,
      title: "Customize view",
      note: "What the trip page shows",
      onClick: () => onSection("customize"),
    },
    {
      key: "again",
      icon: Copy,
      title: "Do it again",
      note: "Copy the trip, or one day, to new dates",
      pill: "",
      onClick: () => onSection("again"),
    },
    ...(onCalendar
      ? [
          {
            key: "calendar",
            icon: CalendarDays,
            title: "Add to calendar",
            note: "Every stop, as a calendar file",
            pill: "",
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
            pill: "",
            onClick: onPrint,
          },
        ]
      : []),
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={section ? SECTION_TITLES[section] : `${title}: trip menu`}
        onClick={(e) => e.stopPropagation()}
        className="rise card-raised flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[28px] sm:rounded-[28px]"
      >
        <span aria-hidden className="mx-auto mt-2 block h-1 w-10 shrink-0 rounded-full bg-border" />
        {section ? (
          <>
            <div className="flex items-center gap-2 px-4 pb-2 pt-2">
              <button
                type="button"
                onClick={() => onSection(null)}
                aria-label="Back to the trip menu"
                className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-card"
              >
                <ArrowLeft className="size-5" aria-hidden />
              </button>
              <p className="min-w-0 flex-1 truncate font-display text-[27px] leading-none">
                {SECTION_TITLES[section]}
              </p>
              <CloseButton onClose={onClose} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6 pt-2">{children}</div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            <div className="flex items-start justify-between gap-3 pt-2">
              <div className="min-w-0">
                <h2 className="break-words font-display text-[40px] leading-[1.02]">{title}</h2>
                <button
                  type="button"
                  onClick={() => onSection("edit")}
                  className="mt-1 inline-flex items-center gap-2 text-[15px] text-muted-foreground"
                >
                  {subtitle || "Add dates"}
                  <Pencil className="size-4 text-foreground" aria-hidden />
                  <span className="sr-only">Edit trip</span>
                </button>
              </div>
              <CloseButton onClose={onClose} />
            </div>

            <button
              type="button"
              onClick={() => onSection("edit")}
              className="plain-card mt-4 flex w-full items-center gap-3 p-2.5 text-left"
            >
              <img
                src={art}
                alt=""
                className="art-dim h-[72px] w-[104px] shrink-0 rounded-xl object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[23px] leading-tight">Edit trip</span>
                <span className="block text-[13px] text-muted-foreground">
                  Name, starting city, dates and status
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            </button>

            <SectionHead>Trip planning</SectionHead>
            <div className="grid grid-cols-2 gap-2.5">
              {planning.map((tile, i) => (
                <Tile {...tile} key={tile.key} tone={(i % 5) + 1} />
              ))}
            </div>

            <SectionHead>Tools &amp; preferences</SectionHead>
            <div className="grid grid-cols-2 gap-2.5">
              {tools.map((tile, i) => (
                <Tile {...tile} key={tile.key} tone={((i + 3) % 5) + 1} />
              ))}
            </div>

            {footer ? (
              <div className="mt-4 [&>button]:w-full [&>button]:rounded-full [&>button]:border [&>button]:border-destructive/50 [&>button]:bg-destructive/5 [&>button]:py-3 [&>button]:text-center">
                {footer}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="Close the trip menu"
      className="grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card shadow-xs"
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}

function SectionHead({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2.5 mt-5 px-0.5 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
      {children}
    </p>
  );
}

function Tile({
  icon: IconMark,
  title,
  note,
  pill,
  extra,
  tone,
  onClick,
}: {
  tone: number;
  icon: Icon;
  title: string;
  note: string;
  pill?: string | undefined;
  extra?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="plain-card flex min-h-[104px] flex-col p-2.5 text-left"
    >
      <span className="flex w-full items-start gap-2">
        <span
          className="grid size-9 shrink-0 place-items-center rounded-full bg-elevated [[data-theme=colorful]_&]:bg-[var(--tile)]"
          style={{ "--tile": `var(--tile-${tone})` } as CSSProperties}
        >
          <IconMark className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[18px] leading-[1.1]">{title}</span>
          <span className="mt-0.5 block text-[12px] leading-snug text-muted-foreground">
            {note}
          </span>
        </span>
        <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
      </span>
      {extra || pill ? (
        <span className="mt-auto flex w-full items-center justify-end gap-1.5 pt-2">
          {extra}
          {pill ? (
            <span
              className="rounded-full bg-elevated px-2.5 py-0.5 text-[12px] font-medium [[data-theme=colorful]_&]:bg-[var(--tile)]"
              style={{ "--tile": `var(--tile-${tone})` } as CSSProperties}
            >
              {pill}
            </span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

function Avatars({ names }: { names: string[] }) {
  return (
    <span className="mr-auto flex items-center -space-x-1.5">
      {names.slice(0, 3).map((name, i) => (
        <span
          key={`${name}-${i}`}
          title={name}
          className={`seq-${(i % 5) + 1} grid size-7 place-items-center rounded-full border-2 border-card text-[11.5px] font-bold`}
        >
          {name.slice(0, 1).toUpperCase()}
        </span>
      ))}
      {names.length > 3 ? (
        <span className="grid size-7 place-items-center rounded-full border-2 border-card bg-elevated text-[11px] font-semibold">
          +{names.length - 3}
        </span>
      ) : null}
    </span>
  );
}
