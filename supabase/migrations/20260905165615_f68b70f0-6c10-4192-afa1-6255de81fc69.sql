ALTER TABLE public.packing_lists ADD COLUMN trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS packing_lists_trip_id_idx ON public.packing_lists(trip_id);