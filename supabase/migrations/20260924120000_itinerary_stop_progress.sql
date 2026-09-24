-- What actually happened at a stop, and how long it was meant to take.
--
-- The companion view ("Now") moves through a day by the traveller tapping
-- "I'm here" and "Leaving", not by guessing from the clock: it needs no
-- time on the row, it survives running late, and it records what really
-- happened rather than what was planned. These are the columns it writes.
--
--   arrived_at            when someone marked the stop as reached
--   left_at               when they marked it as left
--   planned_stay_minutes  how long the plan allows there, if it says
--
-- All three are nullable and nothing existing writes them, so a trip that
-- never uses the companion view is unchanged.
--
-- Progress belongs to the stop, not to a person: every member of the trip
-- sees the same arrived / left state, under the existing "Members manage
-- itinerary" policy. No new policy is needed, and none is added.
--
-- Applied by hand in the Supabase SQL editor; the deploy does not run it.
-- Safe to run more than once. The app does not read these columns until the
-- companion view ships, and that view must tolerate their absence.
--
-- To undo:
--   ALTER TABLE public.itinerary_items
--     DROP CONSTRAINT IF EXISTS itinerary_items_left_after_arrived,
--     DROP CONSTRAINT IF EXISTS itinerary_items_planned_stay_range,
--     DROP COLUMN IF EXISTS arrived_at,
--     DROP COLUMN IF EXISTS left_at,
--     DROP COLUMN IF EXISTS planned_stay_minutes;

ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS arrived_at timestamptz,
  ADD COLUMN IF NOT EXISTS left_at timestamptz,
  ADD COLUMN IF NOT EXISTS planned_stay_minutes integer;

-- Leaving is only meaningful after arriving. A stop marked left with no
-- arrival, or left before it was reached, is a state the view could not
-- explain, so the database refuses it rather than the view guessing.
ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_left_after_arrived;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_left_after_arrived
  CHECK (left_at IS NULL OR (arrived_at IS NOT NULL AND left_at >= arrived_at));

-- A minute to a month. The upper bound leaves room for a lodging row that
-- covers a long stay while still catching a value entered in seconds.
ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_planned_stay_range;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_planned_stay_range
  CHECK (planned_stay_minutes IS NULL OR planned_stay_minutes BETWEEN 1 AND 44640);
