import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

/**
 * The one card shape.
 *
 * Trips, saved places, cities and memories are different content with an
 * identical skeleton: optional media first, a title, at most two lines of
 * meta, an optional badge, optional actions last. Béa drew four versions of
 * that skeleton and they disagreed about spacing, type scale and where the
 * date went — which is most of why the tabs felt like separate apps.
 *
 * The order of the slots is fixed on purpose. A card whose actions sit above
 * its title is not a variant, it is a different card, and it belongs in its
 * own component rather than in another prop here.
 */
export function ContentCard({
  media,
  eyebrow,
  title,
  meta,
  badge,
  actions,
  to,
  params,
  onClick,
  guide,
  className = "",
}: {
  /** A banner or thumbnail. Always the first thing, never inset. */
  media?: ReactNode;
  /** A short kicker above the title — a kind, a country, a status dot. */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** At most two lines. A third is a sign the card is doing a page's job. */
  meta?: (string | null | undefined)[];
  /** One short status — "in 2 months", "3 saved". Never a sentence. */
  badge?: ReactNode;
  actions?: ReactNode;
  /** Make the whole card a link. Mutually exclusive with `onClick`. */
  to?: string;
  params?: Record<string, string>;
  onClick?: () => void;
  guide?: string;
  className?: string;
}) {
  const lines = (meta ?? []).filter((m): m is string => !!m && m.trim().length > 0).slice(0, 2);

  const body = (
    <>
      {media && <div className="overflow-hidden rounded-t-[inherit]">{media}</div>}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          {eyebrow && <div className="mb-1.5 flex items-center gap-1.5">{eyebrow}</div>}
          <h3 className="font-display text-[19px] leading-tight">{title}</h3>
          {lines.map((line) => (
            <p key={line} className="mt-0.5 text-[13.5px] text-muted-foreground">
              {line}
            </p>
          ))}
        </div>
        {badge && (
          <span className="shrink-0 rounded-full bg-elevated px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
            {badge}
          </span>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/50 px-4 py-2.5">
          {actions}
        </div>
      )}
    </>
  );

  // `card-soft` already supplies the surface, radius and lift, so the card
  // inherits the app's depth rather than inventing a fifth one.
  const shell = `card-soft block overflow-hidden text-left transition-transform duration-(--t-tap) ease-(--ease-standard) ${className}`;
  const attrs = guide ? { "data-guide": guide } : {};

  if (to) {
    return (
      <Link to={to} {...(params ? { params } : {})} {...attrs} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} {...attrs} className={`${shell} w-full`}>
        {body}
      </button>
    );
  }
  return (
    <div {...attrs} className={shell}>
      {body}
    </div>
  );
}
