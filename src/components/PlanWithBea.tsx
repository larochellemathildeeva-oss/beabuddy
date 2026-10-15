import type { ComponentType } from "react";
import { Sparkles, Sun, Users, ChevronRight } from "@/components/icons";

/*
 * Plan with Béa, as the minimalist frame draws it: four rows (build, import,
 * optimize, compare), each a title over one quiet line, on hairlines. The
 * same rows make the page under Trips and the first screen of a trip's
 * planner sheet. A few examples start a build from inside its form.
 */

type Row = {
  key: "build" | "import" | "optimize" | "compare";
  title: string;
  note: string;
  onClick: () => void;
};

/** The four ways in, as menu rows. */
export function PlanCards({
  onBuild,
  onImport,
  onOptimize,
  onCompare,
  optimizeNote = "",
}: {
  onBuild: () => void;
  onImport: () => void;
  onOptimize: () => void;
  onCompare: () => void;
  /** A line under Optimize, e.g. when there is nothing to optimize yet. */
  optimizeNote?: string;
}) {
  const rows: Row[] = [
    {
      key: "build",
      title: "Plan from saved places",
      note: "Turn saved places and your preferences into a proposed plan.",
      onClick: onBuild,
    },
    {
      key: "import",
      title: "Import bookings",
      note: "Start from a photo, PDF, calendar or pasted text. Review extracted details first.",
      onClick: onImport,
    },
    {
      key: "optimize",
      title: "Improve my itinerary",
      note:
        optimizeNote ||
        "Reorder existing stops for less travel. Review the changes before applying.",
      onClick: onOptimize,
    },
    {
      key: "compare",
      title: "Compare options",
      note: "See pros and cons side by side. You choose what belongs in the trip.",
      onClick: onCompare,
    },
  ];
  return (
    <div data-guide="plan-cards" className="space-y-3">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={row.onClick}
          data-guide={row.key === "optimize" ? "bea-optimize" : undefined}
          className="lp-card flex w-full items-start gap-3 text-start"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[18px] font-semibold leading-tight">{row.title}</span>
            <span className="mt-2 block text-[13px] leading-snug text-muted-foreground">
              {row.note}
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      ))}
    </div>
  );
}

const PLAN_EXAMPLES: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  ask: string;
}[] = [
  {
    icon: Sparkles,
    label: "A cultural trip in 3 days",
    ask: "A cultural trip in 3 days: museums, history, architecture and local life.",
  },
  {
    icon: Sun,
    label: "A mix of nature and city",
    ask: "A mix of nature and city: some days outdoors, some days in town.",
  },
  {
    icon: Users,
    label: "A family-friendly itinerary",
    ask: "A family-friendly itinerary: kid-proof pacing, parks, and easy meals.",
  },
];

/** "Not sure? Try an example" — each one fills Build's box with its words. */
export function PlanExamples({ onPick }: { onPick: (ask: string) => void }) {
  return (
    <section data-guide="plan-examples">
      <p className="label-caps mb-1">Not sure? Try an example</p>
      <ul>
        {PLAN_EXAMPLES.map((ex) => (
          <li key={ex.label}>
            <button
              type="button"
              onClick={() => onPick(ex.ask)}
              className="flex min-h-11 w-full items-center gap-2 border-b border-border py-2 text-start text-[14px]"
            >
              <ex.icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              {ex.label}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
