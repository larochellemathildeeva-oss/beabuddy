CREATE TABLE public.packing_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text NOT NULL DEFAULT '🧳',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_lists TO authenticated;
GRANT ALL ON public.packing_lists TO service_role;
ALTER TABLE public.packing_lists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own packing lists" ON public.packing_lists FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.packing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.packing_lists(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  packed boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.packing_items TO authenticated;
GRANT ALL ON public.packing_items TO service_role;
ALTER TABLE public.packing_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own packing items" ON public.packing_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX packing_items_list_idx ON public.packing_items(list_id, position);

CREATE TRIGGER packing_lists_updated_at BEFORE UPDATE ON public.packing_lists FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER packing_items_updated_at BEFORE UPDATE ON public.packing_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();