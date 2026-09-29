-- Read-only links to a trip, for family and friends without a Béa account.
--
-- Applied by hand — writing this file does not change the live database alone.
--
-- Design: nothing here is granted to anon, and there is no "anyone with the
-- token can select" policy. A link is opened through Béa's own server, which
-- looks the token up with the service role and returns a short, fixed view
-- of the plan: the trip's name, place and dates, and each stop's day, time,
-- kind, name and address. Never booking numbers, notes, documents, people or
-- anything else on the trip. The token is 256 random bits, so it cannot be
-- walked; a link expires (90 days by default) and any traveller on the trip
-- can revoke it.

CREATE TABLE IF NOT EXISTS public.trip_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips (id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_share_links DROP CONSTRAINT IF EXISTS trip_share_links_token_len;
ALTER TABLE public.trip_share_links
  ADD CONSTRAINT trip_share_links_token_len CHECK (char_length(token) BETWEEN 40 AND 64);

CREATE INDEX IF NOT EXISTS trip_share_links_trip_idx
  ON public.trip_share_links (trip_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_share_links TO authenticated;
GRANT ALL ON public.trip_share_links TO service_role;

ALTER TABLE public.trip_share_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Travellers see their trip's links" ON public.trip_share_links;
CREATE POLICY "Travellers see their trip's links" ON public.trip_share_links
FOR SELECT TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers make links to their trip" ON public.trip_share_links;
CREATE POLICY "Travellers make links to their trip" ON public.trip_share_links
FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers revoke their trip's links" ON public.trip_share_links;
CREATE POLICY "Travellers revoke their trip's links" ON public.trip_share_links
FOR UPDATE TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()))
WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

DROP POLICY IF EXISTS "Travellers delete their trip's links" ON public.trip_share_links;
CREATE POLICY "Travellers delete their trip's links" ON public.trip_share_links
FOR DELETE TO authenticated
USING (public.is_trip_member(trip_id, auth.uid()));
