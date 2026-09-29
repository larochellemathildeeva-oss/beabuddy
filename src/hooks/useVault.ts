import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearStoredVaultKeys,
  decryptJson,
  deriveKey,
  encryptJson,
  randomB64,
} from "@/lib/vaultCrypto";
import {
  deriveKeyBits,
  enrolPasskey as enrolDevicePasskey,
  forgetPasskey,
  importVaultKey,
  readPasskeyRecord,
  unlockWithPasskey,
} from "@/lib/vault-passkey";

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
  /** Face ID / fingerprint is set up for Protected on this device. */
  const [hasPasskey, setHasPasskey] = useState(false);

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
    // A device unlock for a vault that is gone would only ever fail.
    if (!settings) forgetPasskey(user.id);
    setHasPasskey(!!settings && !!readPasskeyRecord(user.id));
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

  /** Checks a key against the vault's verifier before accepting it. */
  const acceptKey = useCallback(async (k: CryptoKey) => {
    const { data: settings, error } = await supabase
      .from("vault_settings")
      .select("salt, verifier, verifier_iv")
      .maybeSingle();
    if (error || !settings) throw new Error("No vault yet");
    try {
      const check = await decryptJson<string>(k, settings.verifier, settings.verifier_iv);
      if (check !== VERIFIER) throw new Error("bad");
    } catch {
      throw new Error("That did not unlock Protected. Use your passcode.");
    }
    setKey(k);
  }, []);

  /** Face ID / fingerprint, where set up on this device. */
  const unlockWithDevice = useCallback(async () => {
    if (!uid) throw new Error("Sign in first");
    const record = readPasskeyRecord(uid);
    if (!record) throw new Error("Face ID or fingerprint is not set up on this device");
    await acceptKey(await unlockWithPasskey(record));
  }, [uid, acceptKey]);

  /** Sets up Face ID / fingerprint, after the passcode is checked once more. */
  const enrolDevice = useCallback(
    async (passcode: string) => {
      if (!uid) throw new Error("Sign in first");
      const { data: settings, error } = await supabase
        .from("vault_settings")
        .select("salt")
        .maybeSingle();
      if (error || !settings) throw new Error("Set a passcode first");
      const raw = await deriveKeyBits(passcode, settings.salt);
      try {
        await acceptKey(await importVaultKey(raw));
      } catch {
        throw new Error("That passcode doesn't match");
      }
      await enrolDevicePasskey(uid, raw);
      setHasPasskey(true);
    },
    [uid, acceptKey],
  );

  const forgetDevice = useCallback(() => {
    if (!uid) return;
    forgetPasskey(uid);
    setHasPasskey(false);
  }, [uid]);

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
    hasPasskey,
    unlocked: !!key,
    rows,
    loading,
    createVault,
    unlock,
    unlockWithDevice,
    enrolDevice,
    forgetDevice,
    lock,
    addDoc,
    removeDoc,
    reveal,
    reload: load,
  };
}
