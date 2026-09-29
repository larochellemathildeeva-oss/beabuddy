-- Places Béa has already worked out, remembered for every traveller after.
--
-- A stop found by its name, and trusted, is kept here as a "match": the next
-- traveller with the same stop in the same town is given the same pin
-- without asking the map again. A place a traveller picks for a stop with
-- "Change place" is kept as a "traveller" row; once two different travellers
-- pick the same spot for a name, that spot wins, even over the map. Rules in
-- src/lib/resolved-places.ts.
--
-- Nothing here says who asked: `name_key` is a SHA-256 of the stop's name as
-- Béa spells it, and `voter` a SHA-256 of the traveller's id with that name,
-- so one traveller's picks cannot be linked to each other. The pins come from
-- LocationIQ and OpenStreetMap (ODbL), Geoapify (whose terms allow storing)
-- and Overture (CDLA Permissive 2.0).
--
-- Written and read only by the server with the service-role client.
-- Deliberately nothing for anon or authenticated: the browser never sees it.
--
-- Applied by hand; safe to re-run. Until it is applied, nothing is
-- remembered and the server says so once in its log.

CREATE TABLE IF NOT EXISTS public.resolved_places (
  id bigserial PRIMARY KEY,
  name_key text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  label text NOT NULL,
  also_named jsonb,
  source text NOT NULL CHECK (source IN ('match', 'traveller')),
  voter text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((source = 'traveller') = (voter IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS resolved_places_name_key_idx
  ON public.resolved_places (name_key);

-- One pick per traveller per name: a new pick replaces their last. Not a
-- partial index, so the server's upsert can name it; matches have no voter,
-- and NULLs never clash.
CREATE UNIQUE INDEX IF NOT EXISTS resolved_places_one_pick_idx
  ON public.resolved_places (name_key, voter);

ALTER TABLE public.resolved_places ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reaches it.

GRANT ALL ON public.resolved_places TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.resolved_places_id_seq TO service_role;
