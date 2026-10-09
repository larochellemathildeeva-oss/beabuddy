import type { ComponentType, ReactNode } from "react";
import {
  Clock,
  CloudRain,
  Leaf,
  MapPin,
  PiggyBank,
  Plus,
  Sun,
  BedDouble,
  Utensils,
  Walk,
} from "@/components/icons";
import { PLAN_PRIORITIES, type PlanPriorityId } from "@/lib/plan-priorities";

/*
 * The pieces the Plan with Béa forms are drawn with, as the minimalist
 * frames draw them: a small label over a large title and a hairline,
 * labelled boxes, the priority chips with a box for your own, and the one
 * black button at the bottom.
 */

export type PanelTone = "rose" | "mint" | "sky" | "butter";

/**
 * The one line under a form's title. The title itself ("A better flow.")
 * is the planner page's own heading (`plannerHead`), so it is not drawn twice.
 */
export function PlanTitle({ children }: { children?: ReactNode }) {
  return children ? (
    <p className="text-[14px] leading-[20px] text-muted-foreground">{children}</p>
  ) : null;
}

/** The label and title each planner form's page wears, as the frames name them. */
export function plannerHead(
  tab: "build" | "import" | "optimize" | "compare",
  addingMore = false,
): { label: string; title: string } {
  switch (tab) {
    case "build":
      return {
        label: "Build a trip",
        title: addingMore ? "Tell Béa what to add." : "Tell Béa where to begin.",
      };
    case "import":
      return { label: "Import a plan", title: "Your plan, brought together." };
    case "optimize":
      return { label: "Optimize", title: "A better flow." };
    case "compare":
      return { label: "Compare options", title: "Two paths. One choice." };
  }
}

/**
 * A labelled box, as the minimalist inputs draw it: a small label (and
 * "(optional)") over the fields. `tone` and `icon` are kept for callers but
 * no longer drawn: the frame has one quiet box for every field.
 */
export function PlanPanel({
  title,
  optional = false,
  aside,
  children,
}: {
  tone?: PanelTone;
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  optional?: boolean;
  /** Something small at the title's right, like a character count. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="plan-panel space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <h3 className="min-w-0 flex-1 text-[12px] font-normal leading-[17px] text-foreground">
          {title}
          {optional ? <span className="text-muted-foreground"> (optional)</span> : null}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

/** "0/500", small, for a panel's title row. */
export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <span className="shrink-0 text-[12px] tabular-nums text-muted-foreground">
      {value.length.toLocaleString()}/{max.toLocaleString()}
    </span>
  );
}

/** The class a panel's text box wears. */
export const PLAN_FIELD =
  "min-h-11 w-full !rounded-none border-0 border-b border-[var(--rule)] bg-transparent px-0 py-2 text-[16px] outline-none placeholder:text-muted-foreground focus:border-foreground";

const PRIORITY_ICON: Record<PlanPriorityId, { icon: ComponentType<{ className?: string }> }> = {
  closest: { icon: MapPin },
  hours: { icon: Clock },
  rainy: { icon: CloudRain },
  "easy-morning": { icon: Sun },
  rest: { icon: BedDouble },
  even: { icon: Walk },
  food: { icon: Utensils },
  budget: { icon: PiggyBank },
  unique: { icon: Leaf },
};

/**
 * "What should Béa prioritize?": the chips, then a box for anything the
 * chips don't cover, so a traveller is never limited to the list.
 */
export function PriorityPicker({
  title = "What should Béa prioritize?",
  hint,
  options,
  selected,
  onToggle,
  custom,
  onCustom,
  customMax = 200,
  children,
}: {
  title?: string;
  /** A few words at the title's right, like "Up to four". */
  hint?: string;
  options: readonly PlanPriorityId[];
  selected: readonly PlanPriorityId[];
  onToggle: (id: PlanPriorityId) => void;
  /** The traveller's own priorities, typed. */
  custom: string;
  onCustom: (value: string) => void;
  customMax?: number;
  children?: ReactNode;
}) {
  const list = PLAN_PRIORITIES.filter((p) => options.includes(p.id));
  return (
    <PlanPanel
      tone="butter"
      title={title}
      aside={
        hint ? <span className="shrink-0 text-[12px] text-muted-foreground">{hint}</span> : null
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {list.map((p) => {
          const on = selected.includes(p.id);
          const { icon: Icon } = PRIORITY_ICON[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(p.id)}
              className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 text-[14px] leading-none transition-colors ${
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-[var(--field-border)] bg-card text-foreground"
              }`}
            >
              <Icon className="size-4 shrink-0" aria-hidden />
              {p.label}
            </button>
          );
        })}
      </div>
      <label className="relative block">
        <span className="sr-only">Your own priorities</span>
        <Plus
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <input
          value={custom}
          onChange={(e) => onCustom(e.target.value)}
          maxLength={customMax}
          placeholder="Add your own: vegetarian food, kid-friendly, no early starts…"
          className={`${PLAN_FIELD} pl-9`}
        />
      </label>
      {children}
    </PlanPanel>
  );
}

/** The black button that ends a form: "Preview a better order". */
export function PlanAction({
  onClick,
  disabled = false,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="btn-primary flex w-full items-center justify-center gap-2 px-4 disabled:opacity-60"
    >
      {children}
    </button>
  );
}

/**
 * A planner step that failed, as the minimalist failure frame draws it:
 * a heading over a 2px rule, then what went wrong and that the trip itself
 * is untouched.
 */
export function PlanError({ message }: { message: string }) {
  return (
    <div role="alert" className="border-t-2 border-foreground pt-3">
      <p className="text-[12px] leading-[17px] text-foreground">Planner / retry</p>
      <p className="mt-1 text-[20px] font-bold leading-tight">{retryHeading(message)}</p>
      <p className="mt-2 break-words text-[14px] leading-[20px] text-destructive">{message}</p>
      <p className="mt-1 text-[14px] leading-[20px] text-muted-foreground">
        Your existing trip is still saved.
      </p>
    </div>
  );
}

/**
 * The frame's "Try a smaller step." fits a plan Béa could not finish; when
 * the reason is waiting (busy, a limit, tomorrow) or the connection, a
 * smaller step would not help, so the heading says so and the message says
 * what to do (`aiFailure` in ai-errors.ts writes those messages).
 */
export function retryHeading(message: string): string {
  return /\b(minute|tomorrow|busy|limit|allowance|connection|offline)\b/i.test(message)
    ? "Not right now."
    : "Try a smaller step.";
}
