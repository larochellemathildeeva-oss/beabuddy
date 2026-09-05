REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) FROM anon, authenticated;