REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(text, text) TO authenticated, service_role;