-- F-01: stop any signed-in user from self-joining a trip they know the UUID of.
-- Client code never INSERTs trip_members (only SELECT + realtime). The two
-- writers are SECURITY DEFINER (accept_trip_invite, add_owner_as_member) and
-- keep working after the grant is removed.

DROP POLICY IF EXISTS "Members add membership" ON public.trip_members;

REVOKE INSERT ON public.trip_members FROM authenticated;
