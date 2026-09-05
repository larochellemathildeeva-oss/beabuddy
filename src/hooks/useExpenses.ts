import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ExpenseRow = {
  id: string;
  trip_id: string | null;
  merchant: string | null;
  category: string;
  amount: number;
  currency: string;
  spent_on: string;
  billable: boolean;
  notes: string | null;
  city: string | null;
  country: string | null;
  storage_path: string | null;
};

export const expenseCategories = [
  "Meals",
  "Transport",
  "Flights",
  "Lodging",
  "Client",
  "Supplies",
  "Other",
] as const;

export function useExpenses() {
  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [uid, setUid] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const id = auth.user?.id ?? null;
    setUid(id);
    if (!id) {
      setRows([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("expenses")
      .select(
        "id, trip_id, merchant, category, amount, currency, spent_on, billable, notes, city, country, storage_path",
      )
      .order("spent_on", { ascending: false });
    const list = ((data ?? []) as unknown as ExpenseRow[]).map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
    setRows(list);
    const next: Record<string, string> = {};
    for (const r of list) {
      if (!r.storage_path) continue;
      const { data: signed } = await supabase.storage
        .from("receipts")
        .createSignedUrl(r.storage_path, 3600);
      if (signed?.signedUrl) next[r.id] = signed.signedUrl;
    }
    setUrls(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addExpense = useCallback(
    async (input: Partial<ExpenseRow> & { file?: File | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id) throw new Error("Not signed in");

      let storage_path: string | null = null;
      if (input.file) {
        const ext = input.file.name.split(".").pop() ?? "jpg";
        storage_path = `${id}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("receipts")
          .upload(storage_path, input.file, {
            contentType: input.file.type || "image/jpeg",
          });
        if (error) throw error;
      }

      const { error } = await supabase.from("expenses").insert({
        user_id: id,
        trip_id: input.trip_id ?? null,
        merchant: input.merchant ?? null,
        category: input.category ?? "Other",
        amount: input.amount ?? 0,
        currency: input.currency ?? "CAD",
        spent_on: input.spent_on ?? new Date().toISOString().slice(0, 10),
        billable: input.billable ?? true,
        notes: input.notes ?? null,
        city: input.city ?? null,
        country: input.country ?? null,
        storage_path,
      });
      if (error) throw error;
      await load();
    },
    [load],
  );

  const removeExpense = useCallback(
    async (row: ExpenseRow) => {
      if (row.storage_path) {
        await supabase.storage.from("receipts").remove([row.storage_path]);
      }
      await supabase.from("expenses").delete().eq("id", row.id);
      await load();
    },
    [load],
  );

  return { rows, urls, loading, signedIn: !!uid, reload: load, addExpense, removeExpense };
}

export function toCsv(
  rows: ExpenseRow[],
  opts?: { home?: string; convert?: (amount: number, currency: string) => number | null },
) {
  const home = opts?.home;
  const head = [
    "Date",
    "Merchant",
    "Category",
    "Amount",
    "Currency",
    ...(home ? [`Amount in ${home}`] : []),
    "Billable",
    "City",
    "Country",
    "Notes",
  ];
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = rows.map((r) => {
    const converted = home && opts?.convert ? opts.convert(r.amount, r.currency) : null;
    return [
      r.spent_on,
      r.merchant ?? "",
      r.category,
      r.amount.toFixed(2),
      r.currency,
      ...(home ? [converted === null ? "" : converted.toFixed(2)] : []),
      r.billable ? "yes" : "no",
      r.city ?? "",
      r.country ?? "",
      r.notes ?? "",
    ]
      .map(esc)
      .join(",");
  });
  return [head.map(esc).join(","), ...lines].join("\n");
}

