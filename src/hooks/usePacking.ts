import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
};

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
    const { data: l } = await supabase
      .from("packing_lists")
      .select("id, name, emoji, trip_id")
      .order("created_at", { ascending: true });
    const { data: i } = await supabase
      .from("packing_items")
      .select("id, list_id, label, quantity, packed, position")
      .order("position", { ascending: true });
    const all = (l ?? []) as PackRow[];
    setPacks(tripId ? all.filter((x) => x.trip_id === tripId) : all.filter((x) => !x.trip_id));
    setItems((i ?? []) as PackItemRow[]);
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const createPack = useCallback(
    async (name: string, emoji: string, starter: string[] = []) => {
      if (!uid) throw new Error("Sign in first");
      const { data, error } = await supabase
        .from("packing_lists")
        .insert({ user_id: uid, name: name.trim(), emoji, trip_id: tripId ?? null })
        .select("id, name, emoji, trip_id")
        .single();
      if (error) throw error;
      const pack = data as PackRow;
      setPacks((p) => [...p, pack]);
      if (starter.length) {
        const rows = starter.map((label, k) => ({
          user_id: uid,
          list_id: pack.id,
          label,
          position: k,
        }));
        const { data: made } = await supabase
          .from("packing_items")
          .insert(rows)
          .select("id, list_id, label, quantity, packed, position");
        setItems((s) => [...s, ...((made ?? []) as PackItemRow[])]);
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
      const { data, error } = await supabase
        .from("packing_items")
        .insert({ user_id: uid, list_id: listId, label: label.trim(), quantity, position })
        .select("id, list_id, label, quantity, packed, position")
        .single();
      if (error) throw error;
      setItems((s) => [...s, data as PackItemRow]);
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
      const labels = items
        .filter((i) => i.list_id === listId)
        .sort((a, b) => a.position - b.position)
        .map((i) => i.label);
      await createPack(`${source.name} copy`, source.emoji, labels);
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
      const { data: srcItems } = await supabase
        .from("packing_items")
        .select("label, quantity, position")
        .eq("list_id", templateId)
        .order("position", { ascending: true });
      if (srcItems?.length) {
        await supabase.from("packing_items").insert(
          srcItems.map((i, k) => ({
            user_id: me,
            list_id: made.id as string,
            label: i.label,
            quantity: i.quantity,
            position: k,
          })),
        );
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
