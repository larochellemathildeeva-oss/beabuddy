ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS travel_style text,
  ADD COLUMN IF NOT EXISTS budget_level text,
  ADD COLUMN IF NOT EXISTS trip_pace text,
  ADD COLUMN IF NOT EXISTS preferred_countries text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS dietary_notes text,
  ADD COLUMN IF NOT EXISTS avoid_notes text,
  ADD COLUMN IF NOT EXISTS home_currency text;