import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DOCUMENT_COLUMNS,
  FILE_MAX_BYTES,
  isMissingDocumentsTable,
  storagePathFor,
  type TripDocument,
} from "@/lib/trip-documents";

/** The files sit beside the trip photos, in the owner's folder. */
export const DOCUMENTS_BUCKET = "photo-memories";

/**
 * `trip_documents` arrives with a migration applied by hand, so it is not in
 * the generated database types yet. One narrow, untyped handle to it rather
 * than casts scattered through the screen.
 */
type Result<T> = Promise<{ data: T | null; error: { message?: string; code?: string } | null }>;
type Query = {
  select: (cols: string) => Query;
  insert: (row: Record<string, unknown>) => Query;
  update: (row: Record<string, unknown>) => Query;
  delete: () => Query;
  eq: (col: string, value: string) => Query;
  order: (col: string, opts: { ascending: boolean }) => Query;
  limit: (n: number) => Query;
  range: (from: number, to: number) => Query;
  single: () => Result<unknown>;
  then: Result<unknown>["then"];
};
function documentsTable(): Query {
  return (supabase as unknown as { from: (t: string) => Query }).from("trip_documents");
}

export type DocumentPatch = Partial<
  Pick<
    TripDocument,
    "trip_id" | "itinerary_item_id" | "kind" | "title" | "lines" | "reference" | "notes"
  >
>;

export type NewDocument = {
  title: string;
  kind: string;
  lines?: string[];
  reference?: string | null;
  notes?: string | null;
  trip_id?: string | null;
  itinerary_item_id?: string | null;
  file?: File | null;
};

export type EventOption = {
  id: string;
  trip_id: string;
  day_date: string | null;
  time_label: string | null;
  kind: string;
  title: string;
  position: number;
};

/**
 * Every trip document this account can see: its own, and those on trips it
 * is a member of. `unavailable` is true while the migration is not applied.
 */
export function useTripDocuments(uid: string | null) {
  const [docs, setDocs] = useState<TripDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!uid) {
      setDocs([]);
      setLoading(false);
      return;
    }
    const { data, error } = (await documentsTable()
      .select(DOCUMENT_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(1000)) as {
      data: TripDocument[] | null;
      error: { message?: string; code?: string } | null;
    };
    if (error) {
      setUnavailable(isMissingDocumentsTable(error));
      setLoadError(!isMissingDocumentsTable(error));
      setDocs([]);
    } else {
      setUnavailable(false);
      setLoadError(false);
      setDocs((data ?? []).map((d) => ({ ...d, lines: d.lines ?? [] })));
    }
    setLoading(false);
  }, [uid]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const addDocument = useCallback(
    async (input: NewDocument): Promise<TripDocument> => {
      if (!uid) throw new Error("Sign in first");
      const id = crypto.randomUUID();
      let storage_path: string | null = null;
      const file = input.file ?? null;
      if (file) {
        if (file.size > FILE_MAX_BYTES) throw new Error("That file is over 20 MB.");
        storage_path = storagePathFor(uid, id, file.name);
        const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storage_path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (error) throw new Error(`The file did not upload: ${error.message}`);
      }
      const { data, error } = (await documentsTable()
        .insert({
          id,
          owner_id: uid,
          title: input.title,
          kind: input.kind,
          lines: input.lines ?? [],
          reference: input.reference ?? null,
          notes: input.notes ?? null,
          trip_id: input.trip_id ?? null,
          itinerary_item_id: input.itinerary_item_id ?? null,
          storage_path,
          file_name: file ? file.name.slice(0, 255) : null,
          mime_type: file ? file.type || null : null,
          size_bytes: file ? file.size : null,
        })
        .select(DOCUMENT_COLUMNS)
        .single()) as { data: TripDocument | null; error: { message?: string } | null };
      if (error || !data) {
        // Keep storage tidy: a file with no row would never be shown again.
        if (storage_path) await supabase.storage.from(DOCUMENTS_BUCKET).remove([storage_path]);
        throw new Error(error?.message ?? "That document did not save.");
      }
      await load();
      return data;
    },
    [uid, load],
  );

  const updateDocument = useCallback(
    async (id: string, patch: DocumentPatch) => {
      const { error } = (await documentsTable().update(patch).eq("id", id)) as {
        error: { message?: string } | null;
      };
      if (error) throw new Error(error.message ?? "That change did not save.");
      await load();
    },
    [load],
  );

  const removeDocument = useCallback(
    async (doc: TripDocument) => {
      const { error } = (await documentsTable().delete().eq("id", doc.id)) as {
        error: { message?: string } | null;
      };
      if (error) throw new Error(error.message ?? "That document was not deleted.");
      if (doc.storage_path) {
        await supabase.storage.from(DOCUMENTS_BUCKET).remove([doc.storage_path]);
      }
      await load();
    },
    [load],
  );

  return {
    docs,
    loading,
    unavailable,
    loadError,
    reload: load,
    addDocument,
    updateDocument,
    removeDocument,
  };
}

/** A short-lived link to a document's file, for View, Download and Share. */
export async function documentFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) throw new Error("That file could not be opened.");
  return data.signedUrl;
}

export async function documentFileBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(DOCUMENTS_BUCKET).download(path);
  if (error || !data) throw new Error("That file could not be downloaded.");
  return data;
}

/** A trip's stops, for "Link to specific event". */
export function useTripEvents(tripId: string | null) {
  const [events, setEvents] = useState<EventOption[]>([]);
  const [loading, setLoading] = useState(false);
  /** The trip `events` belong to: until it equals `tripId`, they are another trip's. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) {
      setEvents([]);
      setLoadedFor(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data } = await supabase
        .from("itinerary_items")
        .select("id, trip_id, day_date, time_label, kind, title, position")
        .eq("trip_id", tripId)
        .order("day_date", { ascending: true })
        .order("position", { ascending: true });
      if (cancelled) return;
      setEvents((data ?? []) as EventOption[]);
      setLoadedFor(tripId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { events, loading, loadedFor };
}

/**
 * How many documents are linked to one stop — for the stop's booking sheet.
 * Zero, quietly, while the migration is not applied.
 */
export function useStopDocumentCount(itemId: string | null, open: boolean) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!itemId || !open) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = (await documentsTable()
        .select("id")
        .eq("itinerary_item_id", itemId)
        .limit(50)) as { data: { id: string }[] | null; error: unknown };
      if (!cancelled) setCount(error ? 0 : (data?.length ?? 0));
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, open]);
  return count;
}

/**
 * The Trip documents filed to one trip, for its bookings: the Overview's
 * counts and the trip menu's Flights, Hotels, Transport and Activities.
 * Read again when Béa comes back to the front, so a booking added from
 * You → Trip documents shows up on the trip. Empty, quietly, while the
 * migration is not applied.
 */
const TRIP_DOCS_PAGE = 500;

export function useTripBookingDocuments(tripId: string | null) {
  const [docs, setDocs] = useState<TripDocument[]>([]);

  const load = useCallback(async () => {
    if (!tripId) {
      setDocs([]);
      return;
    }
    // Every document on the trip, a page at a time: the counts are totals,
    // so a first page read as the whole set would undercount.
    const all: TripDocument[] = [];
    for (let from = 0; ; from += TRIP_DOCS_PAGE) {
      const { data, error } = (await documentsTable()
        .select(DOCUMENT_COLUMNS)
        .eq("trip_id", tripId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: true })
        .range(from, from + TRIP_DOCS_PAGE - 1)) as {
        data: TripDocument[] | null;
        error: unknown;
      };
      if (error) return;
      all.push(...(data ?? []));
      if ((data ?? []).length < TRIP_DOCS_PAGE) break;
    }
    setDocs(all.map((d) => ({ ...d, lines: d.lines ?? [] })));
  }, [tripId]);

  useEffect(() => {
    void load();
    const onShow = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [load]);

  return { docs, reload: load };
}
