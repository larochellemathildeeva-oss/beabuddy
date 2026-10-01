-- A daily ceiling on what each traveller may ask of Gemini.
--
-- Every AI call costs money, and most had no per-person limit; the few that
-- did kept it in the server's memory, which a restart or a second instance
-- forgets. Each AI operation now reserves units here before Gemini is asked
-- (reserveAi in ai-quota.server.ts): one row per traveller and UTC day, added
-- to atomically, so two requests at once cannot both slip under the limit.
-- The units are Béa's own weight per operation (AI_COST), not Google's bill.
--
-- Written only by the server with the service-role client, through
-- reserve_ai_units. Nothing for anon or authenticated: a traveller cannot
-- read or reset their own count. Rows go with the account (ON DELETE CASCADE).
--
-- Applied by hand; safe to re-run.
--
-- The deployed app fails closed without it: no Gemini request is sent when
-- this ledger cannot be reached (isDeployedBuild, ai-quota.server.ts). Only
-- local runs, unit tests and the repository's audit scripts fall back to a
-- per-process count, so they need no live service-role connection.

CREATE TABLE IF NOT EXISTS public.ai_daily_usage (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day date NOT NULL,
  units integer NOT NULL DEFAULT 0 CHECK (units >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day)
);

ALTER TABLE public.ai_daily_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reaches it.

REVOKE ALL ON public.ai_daily_usage FROM anon, authenticated;
GRANT ALL ON public.ai_daily_usage TO service_role;

-- Add `_units` to the traveller's total for today if that stays within
-- `_limit`, atomically. True when reserved, false when it would overrun (and
-- nothing is added). The day is the UTC day this call runs (clock_timestamp,
-- not the transaction's start).
CREATE OR REPLACE FUNCTION public.reserve_ai_units(_user_id uuid, _units integer, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (clock_timestamp() AT TIME ZONE 'utc')::date;
  _reserved integer;
BEGIN
  IF _user_id IS NULL OR _limit IS NULL OR _limit <= 0 THEN
    RETURN false;
  END IF;
  IF _units IS NULL OR _units <= 0 THEN
    RETURN true;
  END IF;
  -- One call larger than the whole day never fits.
  IF _units > _limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_daily_usage AS u (user_id, day, units, updated_at)
  VALUES (_user_id, _today, _units, now())
  ON CONFLICT (user_id, day) DO UPDATE
    SET units = u.units + EXCLUDED.units, updated_at = now()
    WHERE u.units + EXCLUDED.units <= _limit
  RETURNING units INTO _reserved;

  RETURN _reserved IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_units(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_units(uuid, integer, integer) TO service_role;
