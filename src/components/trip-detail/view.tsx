import { TripViews } from "@/components/day/TripViews";
import type { TripDetailCtx } from "./ctx";
import { TripContentPane } from "./content-pane";
import { TripMenuPane } from "./menu-pane";
import { TripSheetsPane } from "./sheets-pane";
import { TripShellPane } from "./shell-pane";

export function TripDetailView({ td }: { td: TripDetailCtx }) {
  return (
    <article
      data-bar-position={td.barPosition}
      className="trip-shell overflow-clip sm:mx-4 sm:mt-3 sm:rounded-3xl sm:border sm:border-border sm:bg-card"
    >
      <TripShellPane td={td} />
      <TripViews position={td.barPosition} value={td.perspective} onChange={td.setPerspective} />
      <TripContentPane td={td} />
      <TripSheetsPane td={td} />
      <TripMenuPane td={td} />
    </article>
  );
}
