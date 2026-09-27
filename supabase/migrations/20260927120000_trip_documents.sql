-- Trip documents: bookings, confirmations, tickets and trip files in one place.
--
-- One row is one document. It can be unassigned (trip_id null), belong to a
-- trip, and optionally be linked to one itinerary stop (itinerary_item_id).
-- The same row is what the library, the trip and the stop all show, so an
-- edit made in one place is seen in the others.
--
--   owner_id           who added it; only they can change or delete it
--   trip_id            the trip it belongs to, or null while unassigned
--   itinerary_item_id  the stop it is for, or null; must be in the same trip
--   kind               flight, train, car, accommodation, restaurant,
--                      activity, ticket or other
--   title, lines       the name and up to four short lines under it
--                      ("Air Canada · AC872", "Montreal → Lisbon")
--   reference          confirmation or ticket number
--   notes              free text
--   storage_path       the file in the photo-memories bucket, always under
--                      the owner's own folder ("<owner_id>/doc-….pdf"); null
--                      for a document entered without a file
--
-- Who can see it: the owner, and — once it belongs to a trip — every member
-- of that trip. Passports, payment cards and passwords do not belong here;
-- they go in Protected (vault_documents), which is encrypted on the device.
--
-- Applied by hand in the Supabase SQL editor; the deploy does not run it.
-- Safe to run more than once. Until it is run, Trip documents says it is not
-- set up yet and Protected still works.
--
-- To undo:
--   DROP POLICY IF EXISTS "Trip members read shared document files" ON storage.objects;
--   DROP TABLE IF EXISTS public.trip_documents;

CREATE TABLE IF NOT EXISTS public.trip_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE SET NULL,
  itinerary_item_id uuid REFERENCES public.itinerary_items(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  lines text[] NOT NULL DEFAULT '{}',
  reference text,
  notes text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_kind_check;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_kind_check
  CHECK (kind IN ('flight', 'train', 'car', 'accommodation', 'restaurant', 'activity', 'ticket', 'other'));

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_title_len;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_title_len
  CHECK (char_length(title) BETWEEN 1 AND 200);

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_lines_len;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_lines_len
  CHECK (cardinality(lines) <= 4 AND char_length(array_to_string(lines, '')) <= 400);

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_reference_len;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_reference_len
  CHECK (reference IS NULL OR char_length(reference) BETWEEN 1 AND 200);

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_notes_len;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_notes_len
  CHECK (notes IS NULL OR char_length(notes) <= 2000);

ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_file_name_len;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_file_name_len
  CHECK (file_name IS NULL OR char_length(file_name) <= 255);

-- A file is always in the owner's own folder. Without this, a row could
-- point at somebody else's photo and the storage policy below would hand it
-- to the members of the row's trip.
ALTER TABLE public.trip_documents DROP CONSTRAINT IF EXISTS trip_documents_path_owner;
ALTER TABLE public.trip_documents ADD CONSTRAINT trip_documents_path_owner
  CHECK (storage_path IS NULL OR storage_path LIKE owner_id::text || '/doc-%');

-- A stop link must be to a stop of the document's own trip. That is held by
-- the write policies below rather than a CHECK: deleting a trip sets trip_id
-- to null a moment before its stops go, and a CHECK would refuse that and
-- with it the trip's deletion.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trip_documents TO authenticated;
GRANT ALL ON public.trip_documents TO service_role;

ALTER TABLE public.trip_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners and trip members read trip documents" ON public.trip_documents;
CREATE POLICY "Owners and trip members read trip documents" ON public.trip_documents
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR (trip_id IS NOT NULL AND public.is_trip_member(trip_id, auth.uid()))
);

-- Writing: the owner only, into a trip they belong to, linked to a stop of
-- that same trip.
DROP POLICY IF EXISTS "Owners add trip documents" ON public.trip_documents;
CREATE POLICY "Owners add trip documents" ON public.trip_documents
FOR INSERT TO authenticated
WITH CHECK (
  owner_id = auth.uid()
  AND (trip_id IS NULL OR public.is_trip_member(trip_id, auth.uid()))
  AND (
    itinerary_item_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.itinerary_items i
      WHERE i.id = itinerary_item_id AND i.trip_id = trip_documents.trip_id
    )
  )
);

DROP POLICY IF EXISTS "Owners change trip documents" ON public.trip_documents;
CREATE POLICY "Owners change trip documents" ON public.trip_documents
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (
  owner_id = auth.uid()
  AND (trip_id IS NULL OR public.is_trip_member(trip_id, auth.uid()))
  AND (
    itinerary_item_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.itinerary_items i
      WHERE i.id = itinerary_item_id AND i.trip_id = trip_documents.trip_id
    )
  )
);

DROP POLICY IF EXISTS "Owners delete trip documents" ON public.trip_documents;
CREATE POLICY "Owners delete trip documents" ON public.trip_documents
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS trip_documents_owner_idx ON public.trip_documents (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS trip_documents_trip_idx ON public.trip_documents (trip_id);
CREATE INDEX IF NOT EXISTS trip_documents_item_idx ON public.trip_documents (itinerary_item_id);

DROP TRIGGER IF EXISTS trip_documents_updated_at ON public.trip_documents;
CREATE TRIGGER trip_documents_updated_at
BEFORE UPDATE ON public.trip_documents
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The files live in the existing private photo-memories bucket, in the
-- owner's folder, so the owner's existing read/upload/delete policies and the
-- account-deletion purge already cover them. This adds one thing: the members
-- of a document's trip may read that document's file.
DROP POLICY IF EXISTS "Trip members read shared document files" ON storage.objects;
CREATE POLICY "Trip members read shared document files" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'photo-memories'
  AND EXISTS (
    SELECT 1 FROM public.trip_documents d
    WHERE d.storage_path = objects.name
      AND d.trip_id IS NOT NULL
      AND public.is_trip_member(d.trip_id, auth.uid())
  )
);
