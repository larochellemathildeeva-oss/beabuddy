/**
 * Optimize's share of the day's Geoapify credits, held in the database.
 *
 * The free plan is 3,000 credits a day for the whole app, and running out
 * stops place search and directions too, not just Optimize. So before a
 * Route Matrix or a batch of opening-hours lookups, Optimize reserves what it
 * is about to spend (reserve_geo_credits, see the geo_credit_usage
 * migration); once its share is gone it stops measuring and says so, and the
 * rest of the allowance is left for everything else.
 *
 * Server only: it uses the service-role client.
 */

/** What Optimize may spend in a UTC day; the other half is left for search and directions. */
export const OPTIMIZE_DAILY_CREDITS = 1_500;

let unavailable = false;

/**
 * True when `credits` were reserved, false when today's share would overrun.
 *
 * When the ceiling cannot be checked — the migration not applied yet, or the
 * database unreachable — this answers true and logs once: the per-Optimize
 * caps still hold, and a missing table should not switch the feature off.
 */
export async function reserveGeoCredits(credits: number): Promise<boolean> {
  if (credits <= 0) return true;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("reserve_geo_credits", {
      _credits: Math.ceil(credits),
      _limit: OPTIMIZE_DAILY_CREDITS,
    });
    if (error) throw error;
    return data === true;
  } catch (error) {
    if (!unavailable) {
      unavailable = true;
      console.warn(
        "[geo] daily credit ceiling unavailable (is the geo_credit_usage migration applied?); per-Optimize caps only:",
        error instanceof Error ? error.message : error,
      );
    }
    return true;
  }
}
