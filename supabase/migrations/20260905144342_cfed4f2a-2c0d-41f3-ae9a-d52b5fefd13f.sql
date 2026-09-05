ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS pin_type text NOT NULL DEFAULT 'reco';

ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_pin_type_check;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_pin_type_check
  CHECK (pin_type IN ('visited', 'nexttime', 'wishlist', 'reco'));