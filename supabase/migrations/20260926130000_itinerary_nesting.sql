-- Stops inside other stops, and what to see inside a stop.
--
-- An itinerary names a place and then what to see there: the Peace Memorial
-- Museum and its galleries, the Peace Memorial Park and its monuments. The
-- owner chose to store this properly rather than as text in the note.
--
--   parent_id  the stop this one is inside, when it has its own time (the
--              Cenotaph at 10:45 inside the park). It stays a full stop; the
--              timeline indents it under its parent and the map pins it
--              beside it. Deleting the parent leaves it as an ordinary stop.
--   inside     what to see inside this stop, with no time of its own, as
--              [{"title": "Flame of Peace", "done": false}, ...]. Shown behind
--              a pill on the stop's card, ticked off during the visit.
--
-- Columns on an existing table, so no new grants; the existing "Members
-- manage itinerary" policy covers them, and every member of the trip sees
-- the same list. A stop can only be inside a stop of the same trip, checked
-- by a trigger, since a CHECK cannot look at another row.
--
-- Applied by hand in the Supabase SQL editor; the deploy does not run it.
-- Safe to run more than once. The app reads these columns when they exist
-- and carries on without them when they do not: lists are then kept in the
-- stop's note as "Inside: …", and stops inside others show as ordinary stops.
--
-- To undo:
--   DROP TRIGGER IF EXISTS itinerary_items_parent_same_trip ON public.itinerary_items;
--   DROP FUNCTION IF EXISTS public.itinerary_items_parent_same_trip();
--   ALTER TABLE public.itinerary_items
--     DROP CONSTRAINT IF EXISTS itinerary_items_inside_shape,
--     DROP CONSTRAINT IF EXISTS itinerary_items_parent_not_self,
--     DROP COLUMN IF EXISTS parent_id,
--     DROP COLUMN IF EXISTS inside;

ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS parent_id uuid
    REFERENCES public.itinerary_items(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inside jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS itinerary_items_parent_id_idx
  ON public.itinerary_items (parent_id)
  WHERE parent_id IS NOT NULL;

ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_parent_not_self;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_parent_not_self
  CHECK (parent_id IS NULL OR parent_id <> id);

-- A list, of a size a person would write, small enough to stay in one row.
ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_inside_shape;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_inside_shape
  CHECK (
    jsonb_typeof(inside) = 'array'
    AND jsonb_array_length(inside) <= 40
    AND pg_column_size(inside) <= 16384
  );

-- The parent must be a stop of the same trip. Runs as the caller, so a
-- parent the caller cannot read under RLS is as good as missing.
CREATE OR REPLACE FUNCTION public.itinerary_items_parent_same_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.itinerary_items p
    WHERE p.id = NEW.parent_id AND p.trip_id = NEW.trip_id
  ) THEN
    RAISE EXCEPTION 'parent_id must be a stop of the same trip'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS itinerary_items_parent_same_trip ON public.itinerary_items;
CREATE TRIGGER itinerary_items_parent_same_trip
  BEFORE INSERT OR UPDATE OF parent_id, trip_id ON public.itinerary_items
  FOR EACH ROW EXECUTE FUNCTION public.itinerary_items_parent_same_trip();
