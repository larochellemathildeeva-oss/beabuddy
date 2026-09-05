ALTER TABLE public.trips ADD COLUMN budget_enabled boolean NOT NULL DEFAULT false;
UPDATE public.trips SET budget_enabled = true WHERE budget_amount > 0 OR id IN (SELECT DISTINCT trip_id FROM public.trip_budget_items);
ALTER TABLE public.itinerary_items ADD COLUMN address text;
ALTER TABLE public.itinerary_items ADD COLUMN lat double precision;
ALTER TABLE public.itinerary_items ADD COLUMN lon double precision;