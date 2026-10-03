import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isShareToken } from "@/lib/trip-share";

const tokenInput = z.object({ token: z.string().max(64) });

/** Whether the signed-in traveller follows the trip a share link opens. */
export const readFollowState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => tokenInput.parse(data))
  .handler(async ({ data, context }) => {
    if (!isShareToken(data.token)) return "gone" as const;
    const server = await import("@/lib/trip-follow.server");
    return server.followState(context.userId, data.token);
  });

/** Follow, or stop following, the trip a share link opens. */
export const changeFollow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ token: z.string().max(64), follow: z.boolean() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!isShareToken(data.token)) return "gone" as const;
    const server = await import("@/lib/trip-follow.server");
    return server.setFollowing(context.userId, data.token, data.follow);
  });

/** The trips the signed-in traveller follows; null until following is set up. */
export const listFollowedTrips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const server = await import("@/lib/trip-follow.server");
    return server.listFollowed(context.userId);
  });
