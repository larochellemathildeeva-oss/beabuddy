import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearStoredVaultKeys,
  decryptJson,
  deriveKey,
  encryptJson,
  randomB64,
} from "@/lib/vaultCrypto";

export type VaultDocRow = {
  id: string;
  kind: string;
  label: string;
  expires_on: string | null;
  ciphertext: string;
  iv: string;
  created_at: string;
};

export type DocSecret = {
  number?: string;
  notes?: string;
  fileName?: string;
  fileData?: string; // data URL
};

export type NewDoc = {
  kind: string;
  label: string;
  expires_on?: string | undefined;
  secret: DocSecret;
};

const VERIFIER = "bea-vault-ok";

export function useVault() {
  const [uid, setUid] = useState<string | null>(null);
  const [hasVault, setHasVault] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [rows, setRows] = useState<VaultDocRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user ?? null;
    setUid(user?.id ?? null);
    if (!user) {
      setLoading(false);
      setHasVault(false);
      setRows([]);
      return;
    }
    clearStoredVaultKeys(user.id);
    const { data: settings } = await supabase
      .from("vault_settings")
      .select("salt, verifier, verifier_iv")
      .maybeSingle();
    setHasVault(!!settings);
    const { data: docs } = await supabase
      .from("vault_documents")
      .select("id, kind, label, expires_on, ciphertext, iv, created_at")
      .order("created_at", { ascending: false });
    setRows((docs ?? []) as VaultDocRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => void load());
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const createVault = useCallback(
    async (passcode: string) => {
      if (!uid) throw new Error("Sign in first");
      const salt = randomB64(16);
      const k = await deriveKey(passcode, salt);
      const { ciphertext, iv } = await encryptJson(k, VERIFIER);
      const { error } = await supabase
        .from("vault_settings")
        .upsert({ user_id: uid, salt, verifier: ciphertext, verifier_iv: iv });
      if (error) throw error;
      setKey(k);
      setHasVault(true);
      await load();
    },
    [uid, load],
  );

  const unlock = useCallback(async (passcode: string) => {
    const { data: settings, error } = await supabase
      .from("vault_settings")
      .select("salt, verifier, verifier_iv")
      .maybeSingle();
    if (error || !settings) throw new Error("No vault yet");
    const k = await deriveKey(passcode, settings.salt);
    try {
      const check = await decryptJson<string>(k, settings.verifier, settings.verifier_iv);
      if (check !== VERIFIER) throw new Error("bad");
    } catch {
      throw new Error("That passcode doesn't match");
    }
    setKey(k);
  }, []);

  const lock = useCallback(() => setKey(null), []);

  const addDoc = useCallback(
    async (doc: NewDoc) => {
      if (!uid || !key) throw new Error("Unlock the vault first");
      const { ciphertext, iv } = await encryptJson(key, doc.secret);
      const { error } = await supabase.from("vault_documents").insert({
        user_id: uid,
        kind: doc.kind,
        label: doc.label,
        expires_on: doc.expires_on || null,
        ciphertext,
        iv,
      });
      if (error) throw error;
      await load();
    },
    [uid, key, load],
  );

  const removeDoc = useCallback(
    async (id: string) => {
      await supabase.from("vault_documents").delete().eq("id", id);
      await load();
    },
    [load],
  );

  const reveal = useCallback(
    async (row: VaultDocRow): Promise<DocSecret> => {
      if (!key) throw new Error("Unlock the vault first");
      return decryptJson<DocSecret>(key, row.ciphertext, row.iv);
    },
    [key],
  );

  return {
    uid,
    signedIn: !!uid,
    hasVault,
    unlocked: !!key,
    rows,
    loading,
    createVault,
    unlock,
    lock,
    addDoc,
    removeDoc,
    reveal,
    reload: load,
  };
}
