import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * One section of a trip: stops, to-dos, the itinerary.
 *
 * Every trip section used to draw its own header, and they drifted — the title
 * was `label-caps` (11px, grey, uppercase) sitting above 14.5px near-black body
 * text, so the smallest, faintest thing in each section was its name. They also
 * each nested a cream panel inside a cream panel inside a cream card, which
 * read as one undifferentiated blob.
 *
 * So: one cream surface per section, a title that outranks its own contents,
 * and rows separated by hairlines rather than by another box.
 */
export function TripSection({
  title,
  hint,
  open,
  onToggle,
  actions,
  guide,
  children,
}: {
  title: string;
  hint?: ReactNode;
  /** Omit `onToggle` for a section that is always open — no chevron is drawn. */
  open?: boolean;
  onToggle?: () => void;
  /** Header actions, right-aligned. Keep these to one or two compact buttons. */
  actions?: ReactNode;
  guide?: string;
  children?: ReactNode;
}) {
  const collapsible = typeof onToggle === "function";
  const expanded = collapsible ? Boolean(open) : true;

  const heading = (
    <div className="min-w-0">
      <p className="font-display text-[16.5px] leading-tight text-foreground">{title}</p>
      {hint ? <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );

  return (
    <section
      {...(guide ? { "data-guide": guide } : {})}
      className="surface mb-3 border border-border/50 p-3.5"
    >
      {/* Actions drop below the title on a phone: side by side they squeezed
          "Where you're going" onto two lines. */}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            <ChevronDown
              className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform ${
                expanded ? "" : "-rotate-90"
              }`}
              aria-hidden
            />
            {heading}
          </button>
        ) : (
          <div className="min-w-0 flex-1">{heading}</div>
        )}
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {expanded && children ? <div className="mt-3">{children}</div> : null}
    </section>
  );
}

/** A quiet header action. Two of these side by side, never a stack of them. */
export function SectionAction({
  onClick,
  children,
  guide,
  label,
}: {
  onClick: () => void;
  children: ReactNode;
  guide?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(guide ? { "data-guide": guide } : {})}
      {...(label ? { "aria-label": label } : {})}
      className="rounded-xl border border-border bg-card px-3 py-1.5 text-[13px] font-semibold"
    >
      {children}
    </button>
  );
}
