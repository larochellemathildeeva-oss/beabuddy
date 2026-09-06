-- Place-level travel tags on a recommendation, so Béa can match a rec
-- to the traveller's interests when she builds a plan.
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS travel_tags text[] NOT NULL DEFAULT '{}';
