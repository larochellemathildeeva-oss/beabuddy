-- "Following": a Béa traveller keeps a trip someone shared with them.
--
-- Applied by hand — writing this file does not change the live database.
--
-- A row says "this traveller follows this share link". It gives no access of
-- its own: the trip is still read only through the link, by the server, in
-- the same fixed view the link shows (never bookings, notes or documents).
-- When the link is turned off or expires, the trip leaves the Following list;
-- when the link is deleted, the row goes with it.
--
-- Rows are added only by the server, after it has checked the link's token,
-- so no traveller can follow a link they were not sent: there is no insert or
-- update policy. A traveller reads and deletes (unfollows) their own rows.
--
-- Safe to re-run. Until it is applied, the "Follow in Béa" button says
-- following is not set up yet, and Trips shows no Following tab.
--
-- To undo:
--   DROP TABLE IF EXISTS public.trip_follows;

CREATE TABLE IF NOT EXISTS public.trip_follows (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  link_id uuid NOT NULL REFERENCES public.trip_share_links (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, link_id)
);

CREATE INDEX IF NOT EXISTS trip_follows_link_idx ON public.trip_follows (link_id);

ALTER TABLE public.trip_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Travellers see what they follow" ON public.trip_follows;
CREATE POLICY "Travellers see what they follow" ON public.trip_follows
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Travellers unfollow" ON public.trip_follows;
CREATE POLICY "Travellers unfollow" ON public.trip_follows
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_follows TO authenticated;
GRANT ALL ON public.trip_follows TO service_role;
