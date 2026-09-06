-- Whether chosen trip dates are still being decided.
-- Applied by hand; the app still works if this column has not been added yet.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS dates_status text;

ALTER TABLE public.trips
  DROP CONSTRAINT IF EXISTS trips_dates_status_check;

ALTER TABLE public.trips
  ADD CONSTRAINT trips_dates_status_check
  CHECK (dates_status IS NULL OR dates_status IN ('tentative', 'confirmed'));
