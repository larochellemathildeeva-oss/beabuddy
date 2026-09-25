-- A daily ceiling on what Optimize may spend on Geoapify.
--
-- Geoapify's free plan allows 3,000 credits a day for the whole app, and once
-- they are gone every call is refused until the next day: place search, pins
-- and directions included. Optimize looks up opening hours for a whole trip
-- at once, so it reserves what it is about to spend here first, and skips
-- the hours once the day's share is used. Everything else keeps the rest.
--
-- One row per UTC day, which is when Geoapify's allowance resets. Written only
-- by the server with the service-role client, through reserve_geo_credits, so
-- that two Optimizes at once cannot both slip under the limit.
--
-- Deliberately nothing for anon or authenticated: the browser never sees it.
--
-- Applied by hand; safe to re-run. Until it is applied the server treats the
-- ceiling as unavailable and relies on the per-Optimize caps alone.

CREATE TABLE IF NOT EXISTS public.geo_credit_usage (
  day date PRIMARY KEY,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geo_credit_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reaches it.

GRANT ALL ON public.geo_credit_usage TO service_role;

-- Add `_credits` to today's total if that stays within `_limit`, atomically.
-- True when the credits were reserved, false when they would overrun.
CREATE OR REPLACE FUNCTION public.reserve_geo_credits(_credits integer, _limit integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (now() AT TIME ZONE 'utc')::date;
  _reserved integer;
BEGIN
  IF _credits IS NULL OR _credits <= 0 THEN
    RETURN true;
  END IF;

  INSERT INTO public.geo_credit_usage AS u (day, credits, updated_at)
  VALUES (_today, _credits, now())
  ON CONFLICT (day) DO UPDATE
    SET credits = u.credits + EXCLUDED.credits, updated_at = now()
    WHERE u.credits + EXCLUDED.credits <= _limit
  RETURNING credits INTO _reserved;

  -- A first spend larger than the limit is inserted above; take it back out.
  IF _reserved IS NOT NULL AND _reserved > _limit THEN
    UPDATE public.geo_credit_usage SET credits = credits - _credits WHERE day = _today;
    RETURN false;
  END IF;

  RETURN _reserved IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_geo_credits(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_geo_credits(integer, integer) TO service_role;
