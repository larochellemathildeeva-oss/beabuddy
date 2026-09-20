-- F-1: an invite could be re-pointed at a trip the editor had no claim to.
-- Applied by hand / MCP — writing this file does not change the live database alone.
--
-- "Members revoke invites" authorized the editor rather than constraining the
-- edit. Its WITH CHECK was a disjunction, and the first branch —
-- invited_by = auth.uid() — is unaffected by a change to trip_id, so the
-- membership branch was never evaluated against the new value. Since
-- `authenticated` holds a table-wide UPDATE grant, the whole attack was:
--
--   1. create an invite for a trip you really are in, so invited_by is you;
--   2. UPDATE that row, setting trip_id to any other trip's UUID;
--   3. redeem your own unchanged code.
--
-- accept_trip_invite is SECURITY DEFINER and keys only on the code, so step 3
-- inserted the caller into trip_members for the victim trip as 'editor'. That
-- re-opened exactly what 20260905223000_lock_trip_member_insert.sql closed:
-- revoking the direct INSERT grant on trip_members does not help when a
-- definer function performs the insert. The sharpest case is a removed member,
-- who keeps the trip UUID and could re-admit themselves at will — which made
-- removing someone from a trip unenforceable.

DROP POLICY IF EXISTS "Members revoke invites" ON public.trip_invites;

CREATE POLICY "Members revoke invites"
  ON public.trip_invites
  FOR UPDATE
  TO authenticated
  -- Who may reach for the row: its creator, or anyone in the trip it names.
  USING (
    invited_by = auth.uid()
    OR public.is_trip_member(trip_id, auth.uid())
  )
  -- What the row is allowed to become. Not a disjunction: whatever else
  -- changes, the row must still name a trip the caller belongs to.
  WITH CHECK (
    public.is_trip_member(trip_id, auth.uid())
  );

-- The policy above is enough on its own, but trip_id is not something a revoke
-- or an expiry edit ever needs to touch, and an invite that changes which trip
-- it belongs to is not a meaningful object. Freezing it keeps the guarantee
-- from resting on one predicate.
CREATE OR REPLACE FUNCTION public.trip_invites_freeze_trip()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
    RAISE EXCEPTION 'An invite cannot be moved to another trip';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trip_invites_freeze_trip ON public.trip_invites;
CREATE TRIGGER trip_invites_freeze_trip
  BEFORE UPDATE ON public.trip_invites
  FOR EACH ROW EXECUTE FUNCTION public.trip_invites_freeze_trip();

-- Third layer: the only UPDATE the client ever issues is a revoke — see
-- revokeTripInvite and createTripInvite in src/hooks/useTrips.ts, both of
-- which set revoked_at and nothing else. accepted_at and use_count are
-- written by accept_trip_invite, which is SECURITY DEFINER and so is not
-- bound by this grant. Narrowing to the one column the browser needs means a
-- member can no longer reset a use count or extend an expiry either, and no
-- column nobody should be writing can be written even if a future policy is
-- loosened by accident.
REVOKE UPDATE ON public.trip_invites FROM authenticated;
GRANT UPDATE (revoked_at) ON public.trip_invites TO authenticated;
