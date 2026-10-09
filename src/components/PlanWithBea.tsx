import type { ComponentType } from "react";
import { Sparkles, Sun, Users } from "@/components/icons";

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
    { key: "build", title: "Build a new trip", note: "Béa drafts the days", onClick: onBuild },
    {
      key: "import",
      title: "Import your plan",
      note: "Paste text or bring a file",
      onClick: onImport,
    },
    {
      key: "optimize",
      title: "Optimize my trip",
      note: optimizeNote || "A better order and pace",
      onClick: onOptimize,
    },
    {
      key: "compare",
      title: "Compare options",
      note: "Choose what suits you",
      onClick: onCompare,
    },
  ];
  return (
    <div data-guide="plan-cards">
      {rows.map((row) => (
        <button
          key={row.key}
          type="button"
          onClick={row.onClick}
          data-guide={row.key === "optimize" ? "bea-optimize" : undefined}
          className="block w-full border-b border-border py-3 text-start"
        >
          <span className="block text-[16px] leading-[22px]">{row.title}</span>
          <span className="mt-1 block text-[14px] leading-[20px] text-muted-foreground">
            {row.note}
          </span>
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
