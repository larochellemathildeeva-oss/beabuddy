-- Soften author FKs so Auth user delete is not blocked by leftover created_by
-- pointers after trip rows cascade. Transfer of shared trips happens in
-- deleteMyAccount before Auth delete.

ALTER TABLE public.trip_budget_items
  DROP CONSTRAINT IF EXISTS trip_budget_items_created_by_fkey;

ALTER TABLE public.trip_budget_items
  ADD CONSTRAINT trip_budget_items_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.trip_stops
  DROP CONSTRAINT IF EXISTS trip_stops_created_by_fkey;

ALTER TABLE public.trip_stops
  ADD CONSTRAINT trip_stops_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users (id) ON DELETE SET NULL;
