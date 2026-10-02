-- "Follow along": a read-only link that also shows which stop the trip is at.
--
-- Applied by hand — writing this file does not change the live database alone.
--
-- Off by default, so every link made before this keeps showing the plan
-- only. When it is on, the shared page marks the stop someone on the trip
-- tapped "I'm here" at, and the stops they left, from the arrived_at and
-- left_at columns of itinerary_items. Never the phone's position, and never
-- the times of the taps. The existing policies already let any traveller on
-- the trip change their links, so no policy or grant is added.
--
-- To undo:
--   ALTER TABLE public.trip_share_links DROP COLUMN IF EXISTS follow_along;

ALTER TABLE public.trip_share_links
  ADD COLUMN IF NOT EXISTS follow_along boolean NOT NULL DEFAULT false;
