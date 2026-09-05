CREATE TABLE public.trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  city text,
  country text,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'upcoming',
  budget text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trips TO authenticated;
GRANT ALL ON public.trips TO service_role;

CREATE TABLE public.trip_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'editor',
  display_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_members TO authenticated;
GRANT ALL ON public.trip_members TO service_role;

CREATE TABLE public.trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  email text,
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_invites TO authenticated;
GRANT ALL ON public.trip_invites TO service_role;

CREATE TABLE public.itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  day_date date,
  time_label text,
  kind text NOT NULL DEFAULT 'Plan',
  title text NOT NULL,
  detail text,
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.itinerary_items TO authenticated;
GRANT ALL ON public.itinerary_items TO service_role;

CREATE TABLE public.vault_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'Document',
  label text NOT NULL,
  expires_on date,
  ciphertext text NOT NULL,
  iv text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_documents TO authenticated;
GRANT ALL ON public.vault_documents TO service_role;

CREATE TABLE public.vault_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  salt text NOT NULL,
  verifier text NOT NULL,
  verifier_iv text NOT NULL,
  biometric_credential_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vault_settings TO authenticated;
GRANT ALL ON public.vault_settings TO service_role;

CREATE OR REPLACE FUNCTION public.is_trip_member(_trip_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = _trip_id AND user_id = _user_id
  );
$$;
REVOKE EXECUTE ON FUNCTION public.is_trip_member(uuid, uuid) FROM PUBLIC, anon;

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read trips" ON public.trips FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR public.is_trip_member(id, auth.uid()));
CREATE POLICY "Owner creates trips" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Members update trips" ON public.trips FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR public.is_trip_member(id, auth.uid()))
  WITH CHECK (owner_id = auth.uid() OR public.is_trip_member(id, auth.uid()));
CREATE POLICY "Owner deletes trips" ON public.trips FOR DELETE TO authenticated
  USING (owner_id = auth.uid());

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read membership" ON public.trip_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members add membership" ON public.trip_members FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_trip_member(trip_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.owner_id = auth.uid())
  );
CREATE POLICY "Members update own membership" ON public.trip_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Leave or owner removes" ON public.trip_members FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.trips t WHERE t.id = trip_id AND t.owner_id = auth.uid())
  );

ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read invites" ON public.trip_invites FOR SELECT TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()) OR invited_by = auth.uid());
CREATE POLICY "Members create invites" ON public.trip_invites FOR INSERT TO authenticated
  WITH CHECK (invited_by = auth.uid() AND public.is_trip_member(trip_id, auth.uid()));
CREATE POLICY "Members delete invites" ON public.trip_invites FOR DELETE TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()));

ALTER TABLE public.itinerary_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage itinerary" ON public.itinerary_items FOR ALL TO authenticated
  USING (public.is_trip_member(trip_id, auth.uid()))
  WITH CHECK (public.is_trip_member(trip_id, auth.uid()));

ALTER TABLE public.vault_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own documents" ON public.vault_documents FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.vault_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own vault settings" ON public.vault_settings FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.accept_trip_invite(_code text, _display_name text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_trip uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in to join a trip';
  END IF;
  SELECT trip_id INTO v_trip FROM public.trip_invites WHERE code = upper(trim(_code));
  IF v_trip IS NULL THEN
    RAISE EXCEPTION 'That invite code does not exist';
  END IF;
  INSERT INTO public.trip_members (trip_id, user_id, role, display_name)
  VALUES (v_trip, auth.uid(), 'editor', _display_name)
  ON CONFLICT (trip_id, user_id) DO UPDATE SET display_name = COALESCE(EXCLUDED.display_name, public.trip_members.display_name);
  UPDATE public.trip_invites SET accepted_at = now() WHERE code = upper(trim(_code)) AND accepted_at IS NULL;
  RETURN v_trip;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.accept_trip_invite(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_trip_invite(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_owner_as_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.trip_members (trip_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'owner')
  ON CONFLICT (trip_id, user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.add_owner_as_member() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trips_owner_member AFTER INSERT ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.add_owner_as_member();

CREATE TRIGGER trips_updated_at BEFORE UPDATE ON public.trips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER itinerary_updated_at BEFORE UPDATE ON public.itinerary_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vault_documents_updated_at BEFORE UPDATE ON public.vault_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER vault_settings_updated_at BEFORE UPDATE ON public.vault_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER PUBLICATION supabase_realtime ADD TABLE public.itinerary_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;