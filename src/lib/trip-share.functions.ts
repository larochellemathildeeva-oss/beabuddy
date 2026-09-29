import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { allowCall } from "@/lib/call-limit";
import { isShareToken, type SharedTrip } from "@/lib/trip-share";

/** Reads per link, per server: plenty for a family, not enough to hammer. */
const PER_LINK = 120;
const WINDOW_MS = 10 * 60 * 1000;
const reads = new Map<string, number[]>();

/**
 * A shared trip, by its link's token. No sign-in: this is the one read Béa
 * answers for someone without an account, and it answers only the fixed
 * view in `sharedTripView`.
 */
export const readSharedTrip = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().max(64) }).parse(data))
  .handler(async ({ data }): Promise<SharedTrip | null> => {
    if (!isShareToken(data.token)) return null;
    // Only tokens of the right shape reach here, but keep the log bounded.
    if (reads.size > 5_000) reads.clear();
    if (!allowCall(reads, data.token, Date.now(), PER_LINK, WINDOW_MS)) {
      throw new Error("This link has been opened a lot just now. Try again in a few minutes.");
    }
    const server = await import("@/lib/trip-share.server");
    return server.readSharedTrip(data.token);
  });
