ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS budget_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS budget_currency text NOT NULL DEFAULT 'CAD';

CREATE TABLE public.trip_budget_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'Other',
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CAD',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_budget_items TO authenticated;
GRANT ALL ON public.trip_budget_items TO service_role;

ALTER TABLE public.trip_budget_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members manage trip budget" ON public.trip_budget_items
  FOR ALL TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

CREATE TRIGGER trip_budget_items_updated_at
  BEFORE UPDATE ON public.trip_budget_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();