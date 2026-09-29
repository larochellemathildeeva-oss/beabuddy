-- Place search answers, kept so the same search is not paid for twice.
--
-- Every search spends Geoapify credits, and the same ones come up again and
-- again: every traveller in Osaka looks for Kuromon Market. The server keeps
-- each answer here for two weeks and serves it to whoever asks the same
-- thing, in the same place. Geoapify's terms allow storing its results; the
-- rest are OpenStreetMap (ODbL) and Overture (CDLA Permissive 2.0).
--
-- The key is a SHA-256 of the search (its words, the trip's town, a rounded
-- position), so the words people type are not stored as such, and nothing
-- says who searched.
--
-- Written and read only by the server with the service-role client.
-- Deliberately nothing for anon or authenticated: the browser never sees it.
--
-- Applied by hand; safe to re-run. Until it is applied the server keeps
-- answers in memory only.

CREATE TABLE IF NOT EXISTS public.place_search_cache (
  key text PRIMARY KEY,
  results jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS place_search_cache_created_at_idx
  ON public.place_search_cache (created_at);

ALTER TABLE public.place_search_cache ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role reaches it.

GRANT ALL ON public.place_search_cache TO service_role;
