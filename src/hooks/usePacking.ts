import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  asDraftItems,
  encodeSectionLabel,
  hydratePackItem,
  isMissingSectionColumn,
  normalizeSection,
  type PackDraftItem,
} from "@/lib/packing-sections";

export type { PackDraftItem };

export type PackRow = {
  id: string;
  name: string;
  emoji: string;
  trip_id: string | null;
};

export type PackItemRow = {
  id: string;
  list_id: string;
  label: string;
  quantity: number;
  packed: boolean;
  position: number;
  section: string | null;
};

/** Cached after the first select/insert: the live DB may not have this column yet. */
let sectionColumnAvailable: boolean | null = null;

type ItemQueryRow = {
  id: string;
  list_id: string;
  label: string;
  quantity?: number | null;
  packed?: boolean | null;
  position: number;
  section?: string | null;
};

function markSectionUnavailable(error: { message?: string; code?: string } | null | undefined) {
  if (isMissingSectionColumn(error)) {
    sectionColumnAvailable = false;
    return true;
  }
  return false;
}

async function selectItems(listId?: string): Promise<ItemQueryRow[]> {
  if (sectionColumnAvailable !== false) {
    let q = supabase
      .from("packing_items")
      .select("id, list_id, label, quantity, packed, position, section")
      .order("position", { ascending: true });
    if (listId) q = q.eq("list_id", listId);
    const first = await q;
    if (!first.error) {
      sectionColumnAvailable = true;
      return first.data;
    }
    if (!markSectionUnavailable(first.error)) throw first.error;
  }
  let retryQ = supabase
    .from("packing_items")
    .select("id, list_id, label, quantity, packed, position")
    .order("position", { ascending: true });
  if (listId) retryQ = retryQ.eq("list_id", listId);
  const retry = await retryQ;
  if (retry.error) throw retry.error;
  return retry.data;
}

async function insertDrafts(
  uid: string,
  listId: string,
  drafts: PackDraftItem[],
  startPosition = 0,
): Promise<ItemQueryRow[]> {
  const rowsFor = (withSection: boolean) =>
    itemInsertRows(uid, listId, drafts, withSection).map((row, i) => ({
      ...row,
      position: startPosition + i,
    }));

  if (sectionColumnAvailable !== false) {
    const first = await supabase
      .from("packing_items")
      .insert(rowsFor(true))
      .select("id, list_id, label, quantity, packed, position, section");
    if (!first.error) {
      sectionColumnAvailable = true;
      return first.data;
    }
    if (!markSectionUnavailable(first.error)) throw first.error;
  }
  const retry = await supabase
    .from("packing_items")
    .insert(rowsFor(false))
    .select("id, list_id, label, quantity, packed, position");
  if (retry.error) throw retry.error;
  return retry.data;
}

function toItemRows(rows: ItemQueryRow[]): PackItemRow[] {
  return rows.map((row) =>
    hydratePackItem({
      id: row.id,
      list_id: row.list_id,
      label: row.label,
      quantity: row.quantity ?? 1,
      packed: row.packed ?? false,
      position: row.position,
      section: row.section ?? null,
    }),
  );
}

function itemInsertRows(
  uid: string,
  listId: string,
  drafts: PackDraftItem[],
  withSection: boolean,
) {
  return drafts.map((item, k) => {
    const section = normalizeSection(item.section);
    const label = item.label.trim();
    return {
      user_id: uid,
      list_id: listId,
      label: withSection ? label : encodeSectionLabel(section, label),
      quantity: item.quantity && item.quantity > 1 ? item.quantity : 1,
      position: k,
      ...(withSection ? { section } : {}),
    };
  });
}

export function usePacking(tripId?: string | null) {
  const [uid, setUid] = useState<string | null>(null);
  const [packs, setPacks] = useState<PackRow[]>([]);
  const [items, setItems] = useState<PackItemRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setUid(user?.id ?? null);
    if (!user) {
      setPacks([]);
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const { data: l } = await supabase
        .from("packing_lists")
        .select("id, name, emoji, trip_id")
        .order("created_at", { ascending: true });
      const itemRows = await selectItems();
      const all = (l ?? []) as PackRow[];
      setPacks(tripId ? all.filter((x) => x.trip_id === tripId) : all.filter((x) => !x.trip_id));
      setItems(toItemRows(itemRows));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const createPack = useCallback(
    async (name: string, emoji: string, starter: Array<string | PackDraftItem> = []) => {
      if (!uid) throw new Error("Sign in first");
      const { data, error } = await supabase
        .from("packing_lists")
        .insert({ user_id: uid, name: name.trim(), emoji, trip_id: tripId ?? null })
        .select("id, name, emoji, trip_id")
        .single();
      if (error) throw error;
      const pack = data as PackRow;
      setPacks((p) => [...p, pack]);
      const drafts = asDraftItems(starter).filter((item) => item.label.trim());
      if (drafts.length) {
        const made = await insertDrafts(uid, pack.id, drafts);
        setItems((s) => [...s, ...toItemRows(made)]);
      }
      return pack.id;
    },
    [uid, tripId],
  );

  const renamePack = useCallback(async (id: string, name: string) => {
    setPacks((p) => p.map((x) => (x.id === id ? { ...x, name } : x)));
    await supabase.from("packing_lists").update({ name }).eq("id", id);
  }, []);

  const deletePack = useCallback(async (id: string) => {
    setPacks((p) => p.filter((x) => x.id !== id));
    setItems((s) => s.filter((x) => x.list_id !== id));
    await supabase.from("packing_lists").delete().eq("id", id);
  }, []);

  const addItem = useCallback(
    async (listId: string, label: string, quantity = 1) => {
      if (!uid) throw new Error("Sign in first");
      const position = items.filter((i) => i.list_id === listId).length;
      const made = await insertDrafts(uid, listId, [{ label, quantity }], position);
      setItems((s) => [...s, ...toItemRows(made)]);
    },
    [uid, items],
  );

  const toggleItem = useCallback(async (id: string, packed: boolean) => {
    setItems((s) => s.map((x) => (x.id === id ? { ...x, packed } : x)));
    await supabase.from("packing_items").update({ packed }).eq("id", id);
  }, []);

  const updateItem = useCallback(async (id: string, patch: Partial<Pick<PackItemRow, "label" | "quantity">>) => {
    setItems((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    await supabase.from("packing_items").update(patch).eq("id", id);
  }, []);

  const removeItem = useCallback(async (id: string) => {
    setItems((s) => s.filter((x) => x.id !== id));
    await supabase.from("packing_items").delete().eq("id", id);
  }, []);

  const resetPack = useCallback(async (listId: string) => {
    setItems((s) => s.map((x) => (x.list_id === listId ? { ...x, packed: false } : x)));
    await supabase.from("packing_items").update({ packed: false }).eq("list_id", listId);
  }, []);

  const duplicatePack = useCallback(
    async (listId: string) => {
      if (!uid) throw new Error("Sign in first");
      const source = packs.find((p) => p.id === listId);
      if (!source) return;
      const drafts = items
        .filter((i) => i.list_id === listId)
        .sort((a, b) => a.position - b.position)
        .map((i) => ({ label: i.label, section: i.section, quantity: i.quantity }));
      await createPack(`${source.name} copy`, source.emoji, drafts);
    },
    [uid, packs, items, createPack],
  );

  const attachToTrip = useCallback(
    async (templateId: string, targetTripId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const me = session.session?.user?.id ?? uid;
      if (!me) throw new Error("Sign in first");
      const { data: src } = await supabase
        .from("packing_lists")
        .select("id, name, emoji")
        .eq("id", templateId)
        .single();
      if (!src) return null;
      const { data: made, error } = await supabase
        .from("packing_lists")
        .insert({ user_id: me, name: src.name, emoji: src.emoji, trip_id: targetTripId })
        .select("id")
        .single();
      if (error) throw error;
      const drafts = toItemRows(await selectItems(templateId)).map((i) => ({
        label: i.label,
        section: i.section,
        quantity: i.quantity,
      }));
      if (drafts.length) {
        await insertDrafts(me, made.id as string, drafts);
      }
      await load();
      return made.id as string;
    },
    [uid, load],
  );

  return {
    signedIn: !!uid,
    loading,
    packs,
    items,
    createPack,
    renamePack,
    deletePack,
    duplicatePack,
    addItem,
    toggleItem,
    updateItem,
    removeItem,
    resetPack,
    attachToTrip,
    reload: load,
  };
}
