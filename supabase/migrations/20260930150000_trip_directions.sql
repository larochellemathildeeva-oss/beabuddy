-- Directions a traveller kept offline, kept in their account too.
--
-- "Keep offline" saves a trip's directions on the phone, and the phone was
-- the only copy: a sign-out that cleans the phone, a new phone, or a browser
-- that clears its storage (Safari does after about a week unused) lost them,
-- and getting them back meant routing every journey again. This row is the
-- account's copy: written beside the phone's, read back after sign-in, and
-- deleted when the traveller deletes the directions from the phone.
--
-- One row per traveller and trip. Only that traveller reads or writes it, and
-- only while they are on the trip; leaving the trip deletes it. The
-- directions are the stops' order and the routes between them, already in
-- the trip itself.
--
-- Applied by hand; safe to re-run. Until it is applied, directions are kept
-- on the phone only, as before, and sign-out leaves them there.

CREATE TABLE IF NOT EXISTS public.trip_directions (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  directions jsonb NOT NULL,
  saved_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trip_id)
);

ALTER TABLE public.trip_directions
  DROP CONSTRAINT IF EXISTS trip_directions_size;
-- A long trip's directions are a few hundred kilobytes; this is a ceiling,
-- not a target.
ALTER TABLE public.trip_directions
  ADD CONSTRAINT trip_directions_size
  CHECK (octet_length(directions::text) <= 4000000);

CREATE INDEX IF NOT EXISTS trip_directions_trip_idx
  ON public.trip_directions (trip_id);

ALTER TABLE public.trip_directions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Travellers read their kept directions" ON public.trip_directions;
CREATE POLICY "Travellers read their kept directions" ON public.trip_directions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers keep directions" ON public.trip_directions;
CREATE POLICY "Travellers keep directions" ON public.trip_directions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers update their kept directions" ON public.trip_directions;
CREATE POLICY "Travellers update their kept directions" ON public.trip_directions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers delete their kept directions" ON public.trip_directions;
CREATE POLICY "Travellers delete their kept directions" ON public.trip_directions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

-- Leaving a trip, or being removed from it, takes that traveller's copy with
-- it: they can no longer read it, and Postgres lets nobody delete a row they
-- cannot read.
CREATE OR REPLACE FUNCTION public.forget_trip_directions_on_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.trip_directions
  WHERE user_id = OLD.user_id AND trip_id = OLD.trip_id;
  RETURN OLD;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.forget_trip_directions_on_leave() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trip_members_forget_directions ON public.trip_members;
CREATE TRIGGER trip_members_forget_directions
  AFTER DELETE ON public.trip_members
  FOR EACH ROW EXECUTE FUNCTION public.forget_trip_directions_on_leave();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_directions TO authenticated;
GRANT ALL ON public.trip_directions TO service_role;
