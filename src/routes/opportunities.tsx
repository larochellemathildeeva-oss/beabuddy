import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Near used to be a tab of its own. It was never a different set of places —
 * it is the recommendation vault sorted by how close you are — and it now
 * lives on Home, where you are already looking when it matters.
 *
 * Redirected rather than deleted, permanently. Old links, bookmarks and
 * anything anyone shared keep working.
 */
export const Route = createFileRoute("/opportunities")({
  staticData: { plane: "tab" },
  beforeLoad: () => {
    throw redirect({ to: "/", replace: true });
  },
});
