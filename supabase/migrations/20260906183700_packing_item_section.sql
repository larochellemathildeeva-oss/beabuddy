-- Optional heading so a packing list can be grouped (Clothes, Electronics, IDs, …).
-- Applied by hand; the app still works if this column has not been added yet.

ALTER TABLE public.packing_items
  ADD COLUMN IF NOT EXISTS section text;

ALTER TABLE public.packing_items
  DROP CONSTRAINT IF EXISTS packing_items_section_len;

ALTER TABLE public.packing_items
  ADD CONSTRAINT packing_items_section_len
  CHECK (section IS NULL OR char_length(section) BETWEEN 1 AND 40);

CREATE INDEX IF NOT EXISTS packing_items_list_section_idx
  ON public.packing_items (list_id, section);
