-- Separate daily AI buckets per traveller.
--
-- ai_daily_usage held one count per traveller and day, which the trip
-- builds, receipts and the rest share (bucket 'ai'). Local-script place names
-- are looked up in the background of a search; spending that shared
-- allowance on them could refuse the traveller's next trip build, but leaving
-- them out let them run on per-process counters alone. So they get a bucket of
-- their own ('local_name'), counted in the same table, atomically, across
-- every server.
--
-- The primary key gains the bucket. reserve_ai_units keeps its signature and
-- reserves from 'ai'; reserve_ai_units_in takes the bucket. Both are service
-- role only, like the table.
--
-- Applied by hand; safe to re-run. Until it is applied the server cannot
-- reserve local-name lookups: the deployed app then skips them (search works
-- without the local-script name), and trip builds keep using
-- reserve_ai_units as before.

ALTER TABLE public.ai_daily_usage ADD COLUMN IF NOT EXISTS bucket text NOT NULL DEFAULT 'ai';

ALTER TABLE public.ai_daily_usage DROP CONSTRAINT IF EXISTS ai_daily_usage_pkey;
ALTER TABLE public.ai_daily_usage ADD CONSTRAINT ai_daily_usage_pkey PRIMARY KEY (user_id, day, bucket);

-- Add `_units` to the traveller's total for today in `_bucket` if that stays
-- within `_limit`, atomically. True when reserved, false when it would
-- overrun (and nothing is added).
CREATE OR REPLACE FUNCTION public.reserve_ai_units_in(
  _user_id uuid,
  _bucket text,
  _units integer,
  _limit integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _today date := (clock_timestamp() AT TIME ZONE 'utc')::date;
  _reserved integer;
BEGIN
  IF _user_id IS NULL OR coalesce(_bucket, '') = '' OR _limit IS NULL OR _limit <= 0 THEN
    RETURN false;
  END IF;
  IF _units IS NULL OR _units <= 0 THEN
    RETURN true;
  END IF;
  IF _units > _limit THEN
    RETURN false;
  END IF;

  INSERT INTO public.ai_daily_usage AS u (user_id, day, bucket, units, updated_at)
  VALUES (_user_id, _today, _bucket, _units, now())
  ON CONFLICT (user_id, day, bucket) DO UPDATE
    SET units = u.units + EXCLUDED.units, updated_at = now()
    WHERE u.units + EXCLUDED.units <= _limit
  RETURNING units INTO _reserved;

  RETURN _reserved IS NOT NULL;
END;
$$;

-- The original, now the 'ai' bucket. Its ON CONFLICT must name the new key.
CREATE OR REPLACE FUNCTION public.reserve_ai_units(_user_id uuid, _units integer, _limit integer)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.reserve_ai_units_in(_user_id, 'ai', _units, _limit);
$$;

REVOKE ALL ON FUNCTION public.reserve_ai_units_in(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_units_in(uuid, text, integer, integer) TO service_role;
REVOKE ALL ON FUNCTION public.reserve_ai_units(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_ai_units(uuid, integer, integer) TO service_role;
