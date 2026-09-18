import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Near used to be a tab of its own. It was never a different set of places —
 * it was the recommendation vault sorted by how close you are — so it is now a
 * filter on that vault.
 *
 * Redirected rather than deleted, permanently. Old links, bookmarks, the guide
 * steps and anything anyone shared all keep working, and they land on the same
 * view they used to.
 */
export const Route = createFileRoute("/opportunities")({
  staticData: { plane: "tab" },
  beforeLoad: () => {
    throw redirect({ to: "/recommendations", search: { near: "1" }, replace: true });
  },
});
