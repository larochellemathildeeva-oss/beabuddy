-- Whether a stop is booked, and what to show at the door.
--
-- The owner asked for stops to be markable as booked, with a quick tap on
-- the stop showing the booking: a reference (the confirmation number) and
-- free-text details (provider, time slot, what to bring). One booking per
-- stop; several would need a table of their own.
--
--   booked           the traveller says this is booked
--   booking_ref      confirmation or ticket number
--   booking_details  anything else about the booking
--
-- Columns on an existing table, so no new grants; the existing "Members
-- manage itinerary" policy covers them, and every member of the trip sees
-- the same booking.
--
-- Applied by hand in the Supabase SQL editor; the deploy does not run it.
-- Safe to run more than once. The app reads these columns when they exist
-- and carries on without them when they do not.
--
-- To undo:
--   ALTER TABLE public.itinerary_items
--     DROP CONSTRAINT IF EXISTS itinerary_items_booking_ref_len,
--     DROP CONSTRAINT IF EXISTS itinerary_items_booking_details_len,
--     DROP COLUMN IF EXISTS booked,
--     DROP COLUMN IF EXISTS booking_ref,
--     DROP COLUMN IF EXISTS booking_details;

ALTER TABLE public.itinerary_items
  ADD COLUMN IF NOT EXISTS booked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS booking_ref text,
  ADD COLUMN IF NOT EXISTS booking_details text;

ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_booking_ref_len;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_booking_ref_len
  CHECK (booking_ref IS NULL OR char_length(booking_ref) BETWEEN 1 AND 200);

ALTER TABLE public.itinerary_items
  DROP CONSTRAINT IF EXISTS itinerary_items_booking_details_len;
ALTER TABLE public.itinerary_items
  ADD CONSTRAINT itinerary_items_booking_details_len
  CHECK (booking_details IS NULL OR char_length(booking_details) BETWEEN 1 AND 2000);
