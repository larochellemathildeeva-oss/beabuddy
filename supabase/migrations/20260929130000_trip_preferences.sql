-- Preferences just for one trip ("Late mornings", "Travelling with Dad"),
-- read by every plan Béa drafts, reworks or rearranges for it, ahead of the
-- traveller's saved profile. The app works without this column: until it is
-- applied, the choices are kept on the phone only.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS trip_preferences text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_trip_preferences_size;
ALTER TABLE public.trips
  ADD CONSTRAINT trips_trip_preferences_size
  CHECK (cardinality(trip_preferences) <= 12);
