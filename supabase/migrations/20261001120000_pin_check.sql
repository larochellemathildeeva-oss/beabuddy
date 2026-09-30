-- Why a stop's place is worth a second look.
--
-- The import works out how sure it is of each pin ("Béa's best guess",
-- "Check this one — not pinned") and used to drop that on saving, so a guess
-- looked like a certainty on the trip. It is kept here, as a short note, and
-- shown on the timeline and in the printed itinerary when the traveller
-- turns on "Pins to check". Null means nothing to check. Setting the place
-- by hand clears it. See src/lib/pin-check.ts.
--
-- A column on an existing table, so no new grants; the existing "Members
-- manage itinerary" policy covers it.
--
-- Applied by hand in the Supabase SQL editor; the deploy does not run it.
-- Safe to run more than once. Until it runs, the app carries on without the
-- notes.
--
-- To undo:
--   ALTER TABLE public.itinerary_items
--     DROP CONSTRAINT IF EXISTS itinerary_items_pin_check_length,
--     DROP COLUMN IF EXISTS pin_check;

ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS pin_check text;

ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_pin_check_length;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_pin_check_length
  CHECK (pin_check IS NULL OR char_length(pin_check) <= 300);
