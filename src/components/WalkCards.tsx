import { Link } from "@tanstack/react-router";
import { Bookmark, Globe, Luggage, PlayCircle, Route, Upload } from "@/components/icons";
import { startWalk } from "@/lib/tour-start";
import { WALKS, type WalkId } from "@/lib/tour";

/** Where each goal is done, and what the button there says. */
const WALK_DESTINATIONS: Record<WalkId, { to: string; go: string; icon: typeof Route }> = {
  plan: { to: "/trips/plan", go: "Plan a trip", icon: Route },
  import: { to: "/trips/plan", go: "Import a plan", icon: Upload },
  save: { to: "/recommendations", go: "Save a place", icon: Bookmark },
  "on-trip": { to: "/trips", go: "Open Trips", icon: Luggage },
  map: { to: "/world", go: "Open World", icon: Globe },
};

/**
 * One card per goal: what it is, "Show me" (the walk on the real screens) and
 * a way straight there. Help leads with these; the welcome flow ends on them.
 */
export function WalkCards({ onPick }: { onPick?: () => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {WALKS.map((walk) => {
        const dest = WALK_DESTINATIONS[walk.id];
        const Icon = dest.icon;
        return (
          <div key={walk.id} className="plain-card flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0">
                <span className="block text-[16px] font-semibold leading-snug">{walk.title}</span>
                <span className="mt-0.5 block text-[14px] text-muted-foreground">{walk.hint}</span>
              </span>
            </div>
            <div className="mt-auto flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onPick?.();
                  startWalk(walk.id);
                }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground"
              >
                <PlayCircle className="size-4" aria-hidden />
                Show me
              </button>
              <Link
                to={dest.to}
                onClick={() => onPick?.()}
                className="flex flex-1 items-center justify-center rounded-full border border-border px-3 py-2 text-center text-[14px] font-semibold"
              >
                {dest.go}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
