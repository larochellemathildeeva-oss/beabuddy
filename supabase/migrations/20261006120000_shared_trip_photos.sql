-- Photos on a read-only link, and the right to keep a photo off it.
--
-- Applied by hand — writing this file does not change the live database alone.
--
-- Two flags, both off by default, so nothing becomes visible by this file:
--
--   trip_share_links.include_photos   the traveller who made the link chose to
--                                     show the trip's photos on it
--   photo_memories.hidden_from_links  the photo's owner keeps this photo off
--                                     every link, whatever the link says
--
-- Photos are never readable through the link by the database itself: a link
-- is opened by Béa's server with the service role, which reads only the rows
-- with include_photos on and hidden_from_links false, in the owner's own
-- folder, and hands out one-hour signed URLs. Nothing is granted to anon, no
-- policy is added, and a photo's position, caption and owner are never sent.
-- The existing policies already let a traveller change their trip's links
-- and a photo's owner change their own photo, so no policy changes.
--
-- Live location is not involved: positions are never part of the link's view.
--
-- Safe to re-run. Until it is applied, links show the plan only and the photo
-- sheet has no "keep off links" button.
--
-- A link shows only its maker's photos (created_by), and only its maker may
-- turn include_photos on or off, whatever the row policies let other
-- travellers change on the link: the trigger below refuses any other change.
-- The server and the service role (no auth.uid()) are not restricted.
--
-- To undo:
--   DROP TRIGGER IF EXISTS trip_share_links_photos_maker ON public.trip_share_links;
--   DROP FUNCTION IF EXISTS public.trip_share_links_photos_maker();
--   ALTER TABLE public.photo_memories DROP COLUMN IF EXISTS hidden_from_links;
--   ALTER TABLE public.trip_share_links DROP COLUMN IF EXISTS include_photos;

ALTER TABLE public.trip_share_links
  ADD COLUMN IF NOT EXISTS include_photos boolean NOT NULL DEFAULT false;

ALTER TABLE public.photo_memories
  ADD COLUMN IF NOT EXISTS hidden_from_links boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.trip_share_links_photos_maker()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
    AND auth.uid() IS DISTINCT FROM NEW.created_by
    AND NEW.include_photos IS DISTINCT FROM OLD.include_photos
  THEN
    RAISE EXCEPTION 'Only the traveller who made a link can change whether it shows photos'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trip_share_links_photos_maker() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trip_share_links_photos_maker ON public.trip_share_links;
CREATE TRIGGER trip_share_links_photos_maker
  BEFORE UPDATE OF include_photos ON public.trip_share_links
  FOR EACH ROW EXECUTE FUNCTION public.trip_share_links_photos_maker();
