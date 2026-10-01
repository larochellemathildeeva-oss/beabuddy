import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { isShareToken, shareClientKey, type SharedTrip } from "@/lib/trip-share";
import { TileRateLimiter as ReadLimiter, tileClientKey as clientKey } from "@/lib/tile-rate-limit";

/**
 * Three ceilings before the database is asked, each a token bucket that
 * refills over ten minutes and holds a bounded number of keys (the oldest
 * is dropped, never the whole table, so flooding it resets no one else):
 *
 * - per link: plenty for a family, not enough to hammer one trip;
 * - per client (the address Canner's proxy appends, an IPv6 one by its /64):
 *   the token is chosen by whoever asks, so a limit keyed on it alone gave
 *   every made-up token a fresh allowance;
 * - for the whole server: a ceiling on what anonymous readers may cost in
 *   all, set high (a hundred clients at their own limit) so a few addresses
 *   cannot shut every shared link.
 *
 * Per process, like the other request limits; the edge can add its own.
 */
const WINDOW_MS = 10 * 60 * 1000;
const PER_LINK = 120;
const PER_CLIENT = 60;
const ALL_READS = 6_000;
const byLink = new ReadLimiter(PER_LINK, WINDOW_MS, 5_000);
const byClient = new ReadLimiter(PER_CLIENT, WINDOW_MS, 10_000);
const overall = new ReadLimiter(ALL_READS, WINDOW_MS, 1);

const BUSY = "This link has been opened a lot just now. Try again in a few minutes.";
const SERVER_BUSY = "Shared trips are very busy just now. Try again in a few minutes.";

/**
 * A shared trip, by its link's token. No sign-in: this is the one read Béa
 * answers for someone without an account, and it answers only the fixed
 * view in `sharedTripView`.
 */
export const readSharedTrip = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ token: z.string().max(64) }).parse(data))
  .handler(async ({ data }): Promise<SharedTrip | null> => {
    if (!isShareToken(data.token)) return null;
    const { getRequest } = await import("@tanstack/react-start/server");
    const now = Date.now();
    // Cheapest refusal first; each check spends only when the ones before passed.
    const client = shareClientKey(clientKey(getRequest().headers));
    if (!byClient.allow(client, now)) throw new Error(BUSY);
    if (!overall.allow("all", now)) throw new Error(SERVER_BUSY);
    if (!byLink.allow(data.token, now)) throw new Error(BUSY);
    const server = await import("@/lib/trip-share.server");
    return server.readSharedTrip(data.token);
  });
