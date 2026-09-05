CREATE TABLE public.future_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  city text NOT NULL,
  country text,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.future_notes TO authenticated;
GRANT ALL ON public.future_notes TO service_role;
ALTER TABLE public.future_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own future notes" ON public.future_notes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER future_notes_updated_at BEFORE UPDATE ON public.future_notes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();