-- Photos on a stop.
--
-- A traveller can add their own photos to a stop of a trip. They are photo
-- memories like any other (the same table, the same private bucket, the same
-- Photos page and globe), with two links:
--
--   itinerary_item_id  the stop the photo was added to, or null
--   trip_id            that stop's trip; set by the trigger below from the
--                      stop, never trusted from the app
--
-- Who can see a photo: its owner, as before, and — once it is on a trip —
-- every member of that trip, so travellers on a shared trip see each other's
-- photos on its stops. Only the owner changes or deletes it. Photos imported
-- on the Photos page have no trip and stay the owner's alone.
--
-- Deleting a stop keeps its photos in the owner's memories and on the trip;
-- deleting the trip keeps them in the owner's memories only.
--
-- Applied by hand; safe to re-run. Until it is applied, the stop sheet says
-- photos are not set up yet and nothing else changes.
--
-- To undo:
--   DROP POLICY IF EXISTS "Trip members read stop photo files" ON storage.objects;
--   DROP TRIGGER IF EXISTS photo_memories_stop_trip ON public.photo_memories;
--   DROP FUNCTION IF EXISTS public.photo_memories_stop_trip();
--   (then restore "Users manage own photos" and drop the two columns)

ALTER TABLE public.photo_memories
  ADD COLUMN IF NOT EXISTS trip_id uuid REFERENCES public.trips (id) ON DELETE SET NULL;
ALTER TABLE public.photo_memories
  ADD COLUMN IF NOT EXISTS itinerary_item_id uuid REFERENCES public.itinerary_items (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS photo_memories_trip_idx ON public.photo_memories (trip_id);
CREATE INDEX IF NOT EXISTS photo_memories_item_idx ON public.photo_memories (itinerary_item_id);

-- A file is always in the owner's own folder, or there is no file
-- ("location-only:…"). Without this, a row on a trip could point at somebody
-- else's photo and the storage policy below would hand it to the trip.
-- NOT VALID: checked on every new or changed row, old rows left as they are.
ALTER TABLE public.photo_memories DROP CONSTRAINT IF EXISTS photo_memories_path_owner;
ALTER TABLE public.photo_memories ADD CONSTRAINT photo_memories_path_owner
  CHECK (
    storage_path LIKE user_id::text || '/%'
    OR storage_path LIKE 'location-only:%'
  ) NOT VALID;

-- The trip always comes from the stop. Security definer so it can read the
-- stop whatever the caller sees; the write policies then refuse a trip the
-- caller is not on. Leaves trip_id alone when the trip is being deleted
-- (set to null with the stop still there for a moment).
CREATE OR REPLACE FUNCTION public.photo_memories_stop_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.itinerary_item_id IS NOT NULL AND (
    TG_OP = 'INSERT'
    OR NEW.trip_id IS NOT NULL
    OR NEW.itinerary_item_id IS DISTINCT FROM OLD.itinerary_item_id
  ) THEN
    SELECT i.trip_id INTO NEW.trip_id
    FROM public.itinerary_items i
    WHERE i.id = NEW.itinerary_item_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.photo_memories_stop_trip() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS photo_memories_stop_trip ON public.photo_memories;
CREATE TRIGGER photo_memories_stop_trip
  BEFORE INSERT OR UPDATE OF itinerary_item_id, trip_id ON public.photo_memories
  FOR EACH ROW EXECUTE FUNCTION public.photo_memories_stop_trip();

-- The one "manage own photos" policy becomes four: reading widens to the
-- trip's members, writing stays the owner's and only onto a trip they are on.
DROP POLICY IF EXISTS "Users manage own photos" ON public.photo_memories;

DROP POLICY IF EXISTS "Owners and trip members read photos" ON public.photo_memories;
CREATE POLICY "Owners and trip members read photos" ON public.photo_memories
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR (trip_id IS NOT NULL AND public.is_trip_member(trip_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owners add photos" ON public.photo_memories;
CREATE POLICY "Owners add photos" ON public.photo_memories
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (trip_id IS NULL OR public.is_trip_member(trip_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owners change photos" ON public.photo_memories;
CREATE POLICY "Owners change photos" ON public.photo_memories
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (trip_id IS NULL OR public.is_trip_member(trip_id, auth.uid()))
  );

DROP POLICY IF EXISTS "Owners delete photos" ON public.photo_memories;
CREATE POLICY "Owners delete photos" ON public.photo_memories
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- The owner's existing storage policies cover their own files. This adds
-- one thing: the members of a photo's trip may read that photo's file.
DROP POLICY IF EXISTS "Trip members read stop photo files" ON storage.objects;
CREATE POLICY "Trip members read stop photo files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'photo-memories'
    AND EXISTS (
      SELECT 1 FROM public.photo_memories p
      WHERE p.storage_path = objects.name
        AND p.trip_id IS NOT NULL
        AND public.is_trip_member(p.trip_id, auth.uid())
    )
  );
