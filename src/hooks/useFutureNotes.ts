import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type FutureNote = {
  id: string;
  city: string;
  country: string | null;
  note: string;
  created_at: string;
};

export function cityKey(city: string | null | undefined) {
  return (city ?? "").trim().toLowerCase();
}

export function useFutureNotes() {
  const [rows, setRows] = useState<FutureNote[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    if (!session.session) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("future_notes")
      .select("id, city, country, note, created_at")
      .order("created_at", { ascending: false });
    setRows((data ?? []) as FutureNote[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void reload());
    return () => sub.subscription.unsubscribe();
  }, [reload]);

  const add = useCallback(
    async (city: string, country: string | null, note: string) => {
      const { data: session } = await supabase.auth.getSession();
      const uid = session.session?.user.id;
      if (!uid) throw new Error("Sign in to leave a note");
      const { error } = await supabase
        .from("future_notes")
        .insert({ user_id: uid, city, country, note });
      if (error) throw error;
      await reload();
    },
    [reload],
  );

  const remove = useCallback(
    async (id: string) => {
      await supabase.from("future_notes").delete().eq("id", id);
      await reload();
    },
    [reload],
  );

  const forCity = useCallback(
    (city: string) => rows.filter((r) => cityKey(r.city) === cityKey(city)),
    [rows],
  );

  return { rows, loading, add, remove, forCity, reload };
}
