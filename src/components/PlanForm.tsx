import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  CloudRain,
  Leaf,
  MapPin,
  PiggyBank,
  Settings2,
  Sun,
  BedDouble,
  Utensils,
  Walk,
} from "@/components/icons";
import { PLAN_PRIORITIES, type PlanPriorityId } from "@/lib/plan-priorities";

/*
 * The pieces the Plan with Béa forms are drawn with: a big title and its
 * lede, tinted panels with a round badge, the "What should Béa prioritize?"
 * tiles, and the one wide button at the bottom.
 */

export type PanelTone = "rose" | "mint" | "sky" | "butter";

/** "Optimize my trip", large, and a sentence or two under it. */
export function PlanTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h2 className="font-display text-[34px] leading-[1.05]">{title}</h2>
      {children ? (
        <p className="mt-1.5 text-[14px] leading-snug text-muted-foreground">{children}</p>
      ) : null}
    </header>
  );
}

/** A tinted panel: a badge, its title (with an optional "(optional)"), a hint, then the fields. */
export function PlanPanel({
  tone,
  icon: Icon,
  title,
  optional = false,
  hint,
  children,
}: {
  tone: PanelTone;
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  optional?: boolean;
  hint?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`plan-panel plan-${tone} space-y-2.5 p-3`}>
      <div className="flex items-center gap-3">
        {Icon ? (
          <span className="plan-badge grid size-11 shrink-0 place-items-center rounded-full">
            <Icon className="size-5" aria-hidden />
          </span>
        ) : null}
        <div className="min-w-0">
          <h3 className="font-display text-[20px] leading-tight">
            {title}
            {optional ? <span className="text-muted-foreground"> (optional)</span> : null}
          </h3>
          {hint ? <p className="text-[12.5px] leading-snug text-muted-foreground">{hint}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}

/** "0/500" under a box, right-aligned. */
export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-right text-[12px] tabular-nums text-muted-foreground">
      {value.length.toLocaleString()}/{max.toLocaleString()}
    </p>
  );
}

/** The class a panel's text box wears. */
export const PLAN_FIELD =
  "w-full rounded-2xl border border-border bg-card px-3.5 py-3 text-[14.5px] outline-none placeholder:text-muted-foreground/70 focus:border-primary";

const PRIORITY_ICON: Record<
  PlanPriorityId,
  { icon: ComponentType<{ className?: string }>; color: string }
> = {
  closest: { icon: MapPin, color: "text-[#d6455d]" },
  hours: { icon: Clock, color: "text-foreground" },
  rainy: { icon: CloudRain, color: "text-[#2f7bb0]" },
  "easy-morning": { icon: Sun, color: "text-[#e59a0b]" },
  rest: { icon: BedDouble, color: "text-[#9b4fd6]" },
  even: { icon: Walk, color: "text-[#2a8a55]" },
  food: { icon: Utensils, color: "text-[#e0621e]" },
  budget: { icon: PiggyBank, color: "text-[#9b4fd6]" },
  unique: { icon: Leaf, color: "text-[#2a8a55]" },
};

/**
 * "What should Béa prioritize?": tiles two by two with a round tick
 * (`tiles`), or wrapping pills (`chips`, as Compare draws them).
 */
export function PriorityPicker({
  title = "What should Béa prioritize?",
  hint = "Select as many as you like.",
  options,
  selected,
  onToggle,
  variant = "tiles",
  children,
}: {
  title?: string;
  hint?: string;
  options: readonly PlanPriorityId[];
  selected: readonly PlanPriorityId[];
  onToggle: (id: PlanPriorityId) => void;
  variant?: "tiles" | "chips";
  children?: ReactNode;
}) {
  const list = PLAN_PRIORITIES.filter((p) => options.includes(p.id));
  return (
    <PlanPanel tone="butter" icon={Settings2} title={title} hint={hint}>
      <div className={variant === "tiles" ? "grid grid-cols-2 gap-2" : "flex flex-wrap gap-2"}>
        {list.map((p) => {
          const on = selected.includes(p.id);
          const { icon: Icon, color } = PRIORITY_ICON[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(p.id)}
              className={`flex min-h-12 items-center gap-2.5 border bg-card text-left transition-colors ${
                variant === "tiles" ? "rounded-2xl px-3 py-2.5" : "rounded-full px-3 py-2"
              } ${on ? "border-primary bg-primary-soft" : "border-border"}`}
            >
              <Icon className={`size-5 shrink-0 ${color}`} aria-hidden />
              <span className="min-w-0 flex-1 text-[13.5px] leading-tight">{p.label}</span>
              {variant === "tiles" ? (
                <span
                  aria-hidden
                  className={`grid size-5 shrink-0 place-items-center rounded-full border ${
                    on ? "border-primary bg-primary" : "border-border"
                  }`}
                >
                  {on ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      {children}
    </PlanPanel>
  );
}

/** The wide button that ends a form: "Optimize my trip →". */
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
      className="flex min-h-13 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3.5 text-[16px] font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
    >
      {children}
      <ArrowRight className="size-5" aria-hidden />
    </button>
  );
}
