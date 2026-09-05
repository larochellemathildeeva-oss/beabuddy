CREATE TABLE public.trip_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'destination',
  city text NOT NULL,
  country text,
  place_name text,
  address text,
  lat double precision,
  lon double precision,
  arrive_on date,
  depart_on date,
  notes text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_stops TO authenticated;
GRANT ALL ON public.trip_stops TO service_role;

ALTER TABLE public.trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage trip stops" ON public.trip_stops
FOR ALL TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()))
WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE INDEX trip_stops_trip_idx ON public.trip_stops (trip_id, position);

CREATE TRIGGER trip_stops_updated_at
BEFORE UPDATE ON public.trip_stops
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();