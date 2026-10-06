import type { ComponentType, ReactNode } from "react";
import {
  ArrowRight,
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
 * The pieces the Plan with Béa forms are drawn with: a title and one line
 * under it, light tinted panels, the priority chips with a box for your own,
 * and the one wide button at the bottom. Drawn compact, so each form fits on
 * one screen without scrolling.
 */

export type PanelTone = "rose" | "mint" | "sky" | "butter";

/** "Optimize my trip", and one line under it. */
export function PlanTitle({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header>
      <h2 className="font-display text-[26px] leading-[1.05]">{title}</h2>
      {children ? (
        <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{children}</p>
      ) : null}
    </header>
  );
}

/** A light tinted panel: a small badge, its title (and "(optional)"), then the fields. */
export function PlanPanel({
  tone,
  icon: Icon,
  title,
  optional = false,
  aside,
  children,
}: {
  tone: PanelTone;
  icon?: ComponentType<{ className?: string }>;
  title: ReactNode;
  optional?: boolean;
  /** Something small at the title's right, like a character count. */
  aside?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={`plan-panel plan-${tone} space-y-2 px-3 py-2`}>
      <div className="flex items-center gap-2">
        {Icon ? (
          <span className="plan-badge grid size-7 shrink-0 place-items-center rounded-full">
            <Icon className="size-4" aria-hidden />
          </span>
        ) : null}
        <h3 className="min-w-0 flex-1 font-display text-[17px] leading-tight">
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
  "w-full rounded-xl border border-border bg-card px-3 py-2 text-[14px] outline-none placeholder:text-muted-foreground/70 focus:border-primary";

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
          const { icon: Icon, color } = PRIORITY_ICON[p.id];
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(p.id)}
              className={`flex items-center gap-1 rounded-full border px-2 py-[5px] text-[12.5px] leading-none transition-colors ${
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-foreground"
              }`}
            >
              <Icon className={`size-3.5 shrink-0 ${on ? "" : color}`} aria-hidden />
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
          className={`${PLAN_FIELD} py-1.5 pl-9 text-[13px]`}
        />
      </label>
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
      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm disabled:opacity-50"
    >
      {children}
      <ArrowRight className="size-5" aria-hidden />
    </button>
  );
}
