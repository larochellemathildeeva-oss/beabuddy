/**
 * The welcome a new account sees once, right after signing up: what Béa does,
 * what the traveller came for, how they travel, and a look — then straight to
 * their first step. Pure, so the rules about who sees it are tested.
 */
import type { TourStorage } from "./tour-state.ts";
import type { WalkId } from "./tour.ts";

export const WELCOME_DONE_KEY = "bea-welcome-done";

/**
 * Set on the account (Supabase user metadata) when the welcome is finished or
 * closed, so another phone or browser does not show it again. The device mark
 * stays too: it answers at once, before the account is read.
 */
export const WELCOME_DONE_META = "bea_welcome_done";

/** Accounts older than this never see it: it is a welcome, not news. */
export const WELCOME_WINDOW_MS = 14 * 86_400_000;

/** Pages where a welcome would sit on top of something more urgent. */
const QUIET_PATHS = [
  "/auth",
  "/forgot-password",
  "/reset-password",
  "/shared/",
  "/privacy",
  "/terms",
];

export type WelcomeGoal = {
  id: WalkId;
  title: string;
  hint: string;
  /** Where the last screen sends them. */
  to: string;
  go: string;
  /** The picture on its card, from `public/banners/`. */
  picture: string;
};

export const WELCOME_GOALS: WelcomeGoal[] = [
  {
    id: "plan",
    title: "Plan a trip",
    hint: "Create a new itinerary",
    to: "/trips/plan",
    go: "Start planning",
    picture: "/banners/oldtown.webp",
  },
  {
    id: "import",
    title: "Bring in a plan",
    hint: "Import an existing trip",
    to: "/trips/plan",
    go: "Bring it in",
    picture: "/banners/skyline.webp",
  },
  {
    id: "save",
    title: "Save places",
    hint: "Start your collection",
    to: "/recommendations",
    go: "Save my first place",
    picture: "/banners/coastal.webp",
  },
  {
    id: "map",
    title: "Map where I've been",
    hint: "See your travel history",
    to: "/world",
    go: "Open my globe",
    picture: "/banners/mountain.webp",
  },
];

function doneKey(userId: string): string {
  return `${WELCOME_DONE_KEY}:${userId}`;
}

export function shouldShowWelcome(
  storage: TourStorage,
  context: {
    userId: string | null | undefined;
    createdAt: string | null | undefined;
    path: string;
    now: number;
    /** The account says it already saw the welcome, on any device. */
    doneOnAccount?: boolean;
  },
): boolean {
  if (!context.userId || !context.createdAt || context.doneOnAccount) return false;
  if (QUIET_PATHS.some((p) => context.path === p || context.path.startsWith(p))) return false;
  if (storage.getItem(doneKey(context.userId)) === "yes") return false;
  const created = Date.parse(context.createdAt);
  if (!Number.isFinite(created)) return false;
  return context.now - created <= WELCOME_WINDOW_MS;
}

/** Finishing and closing are the same: it never asks again on this device. */
export function markWelcomeDone(storage: TourStorage, userId: string): void {
  storage.setItem(doneKey(userId), "yes");
}
