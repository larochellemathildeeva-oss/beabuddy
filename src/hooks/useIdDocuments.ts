import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { CheckupIdDocument } from "@/lib/trip-checkup";

/**
 * Passports and visas in Protected, for Trip checkup: kind, name and expiry
 * only — the three columns that are never encrypted — so it works with the
 * vault locked and never asks for the passcode. Read only while `enabled`
 * (the trip menu is open), and at most once per trip page.
 */
export function useIdDocuments(enabled: boolean): CheckupIdDocument[] {
  const [docs, setDocs] = useState<CheckupIdDocument[] | null>(null);
  const wanted = enabled && docs === null;
  useEffect(() => {
    if (!wanted) return;
    let active = true;
    void supabase
      .from("vault_documents")
      .select("kind, label, expires_on")
      .in("kind", ["Passport", "Visa"])
      .then(({ data, error }) => {
        if (active) setDocs(error ? [] : ((data ?? []) as CheckupIdDocument[]));
      });
    return () => {
      active = false;
    };
  }, [wanted]);
  return docs ?? [];
}
