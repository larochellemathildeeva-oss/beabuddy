import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * A named block of content, optionally collapsible.
 *
 * This began life inside trips, where every section drew its own header and
 * they drifted — the title was `label-caps` (11px, grey, uppercase) sitting
 * above 14.5px near-black body text, so the smallest, faintest thing in each
 * section was its name. They also nested a cream panel inside a cream panel
 * inside a cream card, which read as one undifferentiated blob.
 *
 * So: one cream surface per section, a title that outranks its own contents,
 * and rows separated by hairlines rather than by another box. That is not a
 * trip-specific idea, which is why it is no longer called TripSection — every
 * tab should group content the same way, and the fastest route to that is
 * making the shared component less work than a bespoke one.
 */
export function Section({
  title,
  hint,
  open,
  onToggle,
  defaultOpen,
  actions,
  guide,
  children,
}: {
  title: string;
  hint?: ReactNode;
  /**
   * Omit `onToggle` and `defaultOpen` for a section that is always open — no
   * chevron is drawn.
   */
  open?: boolean;
  onToggle?: () => void;
  /**
   * Collapsible, but minding its own state. For a page with a run of these
   * where the parent has no reason to know which are open — profile drew its
   * own component for exactly this, which is how it ended up with a second
   * section shape.
   */
  defaultOpen?: boolean;
  /** Header actions, right-aligned. Keep these to one or two compact buttons. */
  actions?: ReactNode;
  guide?: string;
  children?: ReactNode;
}) {
  const [ownOpen, setOwnOpen] = useState(Boolean(defaultOpen));
  const controlled = typeof onToggle === "function";
  const collapsible = controlled || defaultOpen !== undefined;
  const expanded = controlled ? Boolean(open) : collapsible ? ownOpen : true;
  const toggle = controlled ? onToggle : () => setOwnOpen((v) => !v);

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
            onClick={toggle}
            aria-expanded={expanded}
            className="flex min-w-0 flex-1 items-start gap-2 text-left"
          >
            <ChevronDown
              className={`mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-(--t-shift) ease-(--ease-standard) ${
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
  pressed,
  icon,
}: {
  onClick: () => void;
  children: ReactNode;
  guide?: string;
  label?: string;
  /** For an action that turns a mode on and stays on, like editing a list. */
  pressed?: boolean;
  /** Square, for an action whose meaning is carried by a glyph. */
  icon?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      {...(guide ? { "data-guide": guide } : {})}
      {...(label ? { "aria-label": label } : {})}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      className={`rounded-xl border text-[13px] font-semibold ${
        icon ? "tap-44 grid size-8 place-items-center" : "px-3 py-1.5"
      } ${
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
