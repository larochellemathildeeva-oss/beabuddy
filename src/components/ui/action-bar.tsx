import type { ComponentType, ReactNode } from "react";

import { cn } from "../../lib/utils";

export interface ActionBarItem {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onClick: () => void;
  /** A small count beside the label ("To do 3"). */
  badge?: ReactNode;
  /** Extra attributes for the guide (`data-guide`). */
  guide?: string;
}

/*
 * A row of two to four things to do, each an icon over a short label. No
 * track and no selected state: these are actions, not views (that is
 * Segmented).
 */
export function ActionBar({
  items,
  label,
  className,
}: {
  items: ActionBarItem[];
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("grid grid-flow-col auto-cols-fr gap-2", className)}
    >
      {items.map(({ key, label: text, icon: Icon, onClick, badge, guide }) => (
        <button
          key={key}
          type="button"
          data-guide={guide}
          onClick={onClick}
          className="flex min-h-(--tap) cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--r-md)] py-1 text-caption font-medium text-ink transition-colors hover:bg-surface-2"
        >
          <Icon className="size-5" aria-hidden />
          <span className="flex items-center gap-1">
            {text}
            {badge != null && <span className="text-ink-muted tabular-nums">{badge}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}
