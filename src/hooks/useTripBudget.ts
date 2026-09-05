import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRates } from "@/hooks/useRates";
import type { ExpenseRow } from "@/hooks/useExpenses";

export type BudgetItem = {
  id: string;
  trip_id: string;
  label: string;
  category: string;
  amount: number;
  currency: string;
};

export function useTripBudget(tripId: string | null) {
  const channelId = useId();
  const [items, setItems] = useState<BudgetItem[]>([]);
  const [spent, setSpent] = useState<ExpenseRow[]>([]);
  const [budget, setBudget] = useState<{ amount: number; currency: string }>({
    amount: 0,
    currency: "CAD",
  });
  const [loading, setLoading] = useState(false);
  const rates = useRates();

  const load = useCallback(async () => {
    if (!tripId) {
      setItems([]);
      setSpent([]);
      return;
    }
    setLoading(true);
    const [{ data: plan }, { data: exp }, { data: trip }] = await Promise.all([
      supabase
        .from("trip_budget_items")
        .select("id, trip_id, label, category, amount, currency")
        .eq("trip_id", tripId)
        .order("created_at", { ascending: true }),
      supabase
        .from("expenses")
        .select(
          "id, trip_id, merchant, category, amount, currency, spent_on, billable, notes, city, country, storage_path",
        )
        .eq("trip_id", tripId)
        .order("spent_on", { ascending: false }),
      supabase.from("trips").select("budget_amount, budget_currency").eq("id", tripId).single(),
    ]);
    setItems(
      ((plan ?? []) as unknown as BudgetItem[]).map((r) => ({ ...r, amount: Number(r.amount) })),
    );
    setSpent(
      ((exp ?? []) as unknown as ExpenseRow[]).map((r) => ({ ...r, amount: Number(r.amount) })),
    );
    if (trip) {
      setBudget({
        amount: Number((trip as { budget_amount: number }).budget_amount ?? 0),
        currency: (trip as { budget_currency: string }).budget_currency ?? "CAD",
      });
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live: totals move the moment a receipt is claimed or a plan changes.
  useEffect(() => {
    if (!tripId) return;
    const channel = supabase
      .channel(`trip-budget:${tripId}:${channelId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses", filter: `trip_id=eq.${tripId}` },
        () => void load(),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trip_budget_items",
          filter: `trip_id=eq.${tripId}`,
        },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips", filter: `id=eq.${tripId}` },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [tripId, channelId, load]);

  const addItem = useCallback(
    async (item: { label: string; category: string; amount: number; currency: string }) => {
      if (!tripId) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("trip_budget_items").insert({
        trip_id: tripId,
        label: item.label,
        category: item.category,
        amount: item.amount,
        currency: item.currency,
        created_by: auth.user?.id ?? null,
      });
      if (error) throw error;
      await load();
    },
    [tripId, load],
  );

  const addItems = useCallback(
    async (
      additions: Array<{ label: string; category: string; amount: number; currency: string }>,
    ) => {
      if (!tripId || additions.length === 0) return;
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from("trip_budget_items").insert(
        additions.map((item) => ({
          trip_id: tripId,
          label: item.label,
          category: item.category,
          amount: item.amount,
          currency: item.currency,
          created_by: auth.user?.id ?? null,
        })),
      );
      if (error) throw error;
      await load();
    },
    [tripId, load],
  );

  const removeItem = useCallback(
    async (id: string) => {
      await supabase.from("trip_budget_items").delete().eq("id", id);
      await load();
    },
    [load],
  );

  const setTripBudget = useCallback(
    async (amount: number, currency: string) => {
      if (!tripId) return;
      const { error } = await supabase
        .from("trips")
        .update({ budget_amount: amount, budget_currency: currency })
        .eq("id", tripId);
      if (error) throw error;
      setBudget({ amount, currency });
      await load();
    },
    [tripId, load],
  );

  const totals = useMemo(() => {
    const cur = budget.currency || "CAD";
    const toBudget = (amount: number, from: string) =>
      rates.convertTo(amount, from || cur, cur) ?? amount;
    const planned = items.reduce((s, i) => s + toBudget(i.amount, i.currency), 0);
    const spentTotal = spent.reduce((s, e) => s + toBudget(e.amount, e.currency), 0);
    const claimable = spent
      .filter((e) => e.billable)
      .reduce((s, e) => s + toBudget(e.amount, e.currency), 0);
    const target = budget.amount > 0 ? budget.amount : planned;
    const remaining = target - spentTotal;
    const pct = target > 0 ? Math.min(100, Math.round((spentTotal / target) * 100)) : 0;
    const byCategory = new Map<string, { planned: number; spent: number }>();
    for (const i of items) {
      const row = byCategory.get(i.category) ?? { planned: 0, spent: 0 };
      row.planned += toBudget(i.amount, i.currency);
      byCategory.set(i.category, row);
    }
    for (const e of spent) {
      const row = byCategory.get(e.category) ?? { planned: 0, spent: 0 };
      row.spent += toBudget(e.amount, e.currency);
      byCategory.set(e.category, row);
    }
    return {
      planned,
      spent: spentTotal,
      claimable,
      target,
      remaining,
      pct,
      over: target > 0 && spentTotal > target,
      byCategory: Array.from(byCategory.entries()),
      receipts: spent.length,
    };
  }, [items, spent, budget, rates]);

  return {
    items,
    spent,
    budget,
    totals,
    loading,
    addItem,
    addItems,
    removeItem,
    setTripBudget,
    reload: load,
  };
}
