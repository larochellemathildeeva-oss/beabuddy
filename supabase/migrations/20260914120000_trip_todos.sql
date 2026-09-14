-- Trip to-do list: the things you have to *do* before and during a trip that
-- are not timeline stops and not packing items — renew the passport, book the
-- airport transfer, tell the bank, print the tickets.
--
-- Applied by hand. Until it is run, the to-do card reports that it is not set
-- up yet rather than failing.

CREATE TABLE IF NOT EXISTS public.trip_todos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title text NOT NULL,
  notes text,
  due_on date,
  done boolean NOT NULL DEFAULT false,
  done_at timestamptz,
  done_by uuid REFERENCES auth.users(id),
  assigned_to uuid REFERENCES auth.users(id),
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_todos
  DROP CONSTRAINT IF EXISTS trip_todos_title_len;

ALTER TABLE public.trip_todos
  ADD CONSTRAINT trip_todos_title_len
  CHECK (char_length(title) BETWEEN 1 AND 200);

ALTER TABLE public.trip_todos
  DROP CONSTRAINT IF EXISTS trip_todos_notes_len;

ALTER TABLE public.trip_todos
  ADD CONSTRAINT trip_todos_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 1000);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_todos TO authenticated;
GRANT ALL ON public.trip_todos TO service_role;

ALTER TABLE public.trip_todos ENABLE ROW LEVEL SECURITY;

-- Same rule as trip_stops: a trip's members, and only a trip's members.
DROP POLICY IF EXISTS "Members manage trip todos" ON public.trip_todos;

CREATE POLICY "Members manage trip todos" ON public.trip_todos
FOR ALL TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()))
WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE INDEX IF NOT EXISTS trip_todos_trip_idx ON public.trip_todos (trip_id, done, position);

DROP TRIGGER IF EXISTS trip_todos_updated_at ON public.trip_todos;

CREATE TRIGGER trip_todos_updated_at
BEFORE UPDATE ON public.trip_todos
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
