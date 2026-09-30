-- The app-wide daily Geoapify credit ceiling, shared by every server instance.
--
-- Every Geoapify request reserves credits here before it is sent so a restart
-- or a second server cannot reset or multiply the day's allowance. Reservations
-- are made by the server with the service-role client only.
--
-- Deliberately nothing for anon or authenticated: the browser never sees it.
--
-- Applied by hand; safe to re-run. Until it is applied the server falls back
-- to the existing in-memory daily guard.

CREATE TABLE IF NOT EXISTS public.geoapify_daily_usage (
  day date PRIMARY KEY,
  credits integer NOT NULL DEFAULT 0 CHECK (credits >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.geoapify_daily_usage ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reaches it.

GRANT ALL ON public.geoapify_daily_usage TO service_role;

-- Add `_credits` to today's total if that stays within `_limit`, atomically.
-- True when the credits were reserved, false when they would overrun.
CREATE OR REPLACE FUNCTION public.reserve_geoapify_credits(_credits integer, _limit integer)
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

  INSERT INTO public.geoapify_daily_usage AS u (day, credits, updated_at)
  VALUES (_today, _credits, now())
  ON CONFLICT (day) DO UPDATE
    SET credits = u.credits + EXCLUDED.credits, updated_at = now()
    WHERE u.credits + EXCLUDED.credits <= _limit
  RETURNING credits INTO _reserved;

  -- A first spend larger than the limit is inserted above; take it back out.
  IF _reserved IS NOT NULL AND _reserved > _limit THEN
    UPDATE public.geoapify_daily_usage SET credits = credits - _credits WHERE day = _today;
    RETURN false;
  END IF;

  RETURN _reserved IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_geoapify_credits(integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_geoapify_credits(integer, integer) TO service_role;
