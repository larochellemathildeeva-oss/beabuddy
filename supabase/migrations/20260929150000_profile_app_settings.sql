-- The traveller's app settings, kept with the account so they follow them to
-- every device: theme, Béa's personality, stop pictures, the Home, trip and
-- stats layouts, and the home currency. Each device keeps its own copy too
-- (so the theme is on before first paint); this is the one they agree on.
--
-- One jsonb object on the profile, keyed by setting name, each value the text
-- the device stores (see src/lib/account-settings.ts); null is a setting reset
-- to its default. Written through merge_app_settings, which changes only the
-- settings it is given, so two devices saving different settings at once do
-- not undo each other.
--
-- Applied by hand; safe to re-run. Until it is applied, settings stay on each
-- device as before.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS app_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_app_settings_shape;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_app_settings_shape
  CHECK (jsonb_typeof(app_settings) = 'object' AND pg_column_size(app_settings) <= 32768);

-- Runs as the caller, so the profiles policies still decide: only the
-- signed-in traveller's own row is changed.
CREATE OR REPLACE FUNCTION public.merge_app_settings(patch jsonb)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET app_settings = app_settings || patch
  WHERE id = auth.uid()
    AND jsonb_typeof(patch) = 'object';
$$;

REVOKE ALL ON FUNCTION public.merge_app_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.merge_app_settings(jsonb) TO authenticated;
