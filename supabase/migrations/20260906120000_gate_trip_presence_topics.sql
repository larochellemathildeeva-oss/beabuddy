-- S-02: trip presence channels were public, so anyone holding a trip UUID could
-- join `trip-presence:<uuid>`, read collaborators' names and live editing labels,
-- and track() themselves into the trip under any name they chose.
--
-- Supabase Realtime only consults RLS for channels the client opens with
-- `config.private = true`; public channels bypass it entirely. The client change
-- that opts these topics in ships alongside this migration.
--
-- postgres_changes is deliberately NOT affected: those payloads are already
-- filtered by RLS on itinerary_items / trip_stops / trip_budget_items, all of
-- which require is_trip_member.

-- Pull the trip UUID out of a presence topic. Returns NULL for any other topic
-- shape, which makes the policies below deny by default.
CREATE OR REPLACE FUNCTION public.realtime_topic_trip_id(_topic text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT substring(
    _topic FROM
    '^trip-presence:([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$'
  )::uuid;
$$;

REVOKE EXECUTE ON FUNCTION public.realtime_topic_trip_id(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.realtime_topic_trip_id(text) TO authenticated, service_role;

-- Fail loudly and legibly if this instance has no Realtime Authorization, rather
-- than with a bare "function realtime.topic() does not exist" from the policies below.
DO $$
BEGIN
  PERFORM 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'realtime' AND p.proname = 'topic';
  IF NOT FOUND THEN
    RAISE EXCEPTION
      'realtime.topic() not found: this Realtime version has no authorization support, so presence cannot be gated this way';
  END IF;
END $$;

-- Supabase normally ships realtime.messages with RLS already on, and the migration
-- role may not own the table. Only ALTER when it is actually needed, so the common
-- case needs no privilege we might not have — and a genuine miss still fails loudly
-- rather than leaving policies that silently do not enforce.
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'realtime.messages'::regclass) THEN
    ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DROP POLICY IF EXISTS "Trip members read trip presence" ON realtime.messages;
CREATE POLICY "Trip members read trip presence"
ON realtime.messages FOR SELECT TO authenticated
USING (
  public.is_trip_member(public.realtime_topic_trip_id(realtime.topic()), auth.uid())
);

DROP POLICY IF EXISTS "Trip members write trip presence" ON realtime.messages;
CREATE POLICY "Trip members write trip presence"
ON realtime.messages FOR INSERT TO authenticated
WITH CHECK (
  public.is_trip_member(public.realtime_topic_trip_id(realtime.topic()), auth.uid())
);
