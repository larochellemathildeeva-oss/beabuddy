import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  clearStoredVaultKeys,
  decryptJson,
  deriveKey,
  encryptJson,
  randomB64,
  reencryptRows,
} from "@/lib/vaultCrypto";
import {
  VAULT_PASSCODE_RULE,
  deviceUnlockNeedsCheck,
  validateVaultPasscode,
} from "@/lib/vault-passcode";
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

/** Rows read per request when a passcode change fetches every document. */
const ROTATE_PAGE = 500;
/** Past this, a passcode change is refused up front rather than sent. */
const ROTATE_MAX_BYTES = 20_000_000;

export function useVault() {
  const [uid, setUid] = useState<string | null>(null);
  const [hasVault, setHasVault] = useState(false);
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [rows, setRows] = useState<VaultDocRow[]>([]);
  const [loading, setLoading] = useState(true);
  /** Face ID / fingerprint is set up for Protected on this device. */
  const [hasPasskey, setHasPasskey] = useState(false);
  /**
   * Unlocked with a passcode shorter than today's rule (vault-passcode.ts):
   * a vault made before it. Asked to choose a stronger one.
   */
  const [weakPasscode, setWeakPasscode] = useState<false | "short" | "older">(false);
  /**
   * The verifier this device unlocked with. A passcode change sends it, so a
   * change made meanwhile on another device is refused rather than
   * overwritten; a new document checks it after saving.
   */
  const unlockedVerifier = useRef<string | null>(null);

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

  /**
   * Which passcode rule the vault is known to meet (`passcode_rule`), or
   * undefined when it cannot be read: the column's migration may not be
   * applied, so this is read on its own and never breaks loading or
   * unlocking.
   */
  const readPasscodeRule = useCallback(async (): Promise<number | null | undefined> => {
    const { data, error } = await supabase
      .from("vault_settings")
      .select("passcode_rule")
      .maybeSingle();
    if (error || !data) return undefined;
    return data.passcode_rule ?? null;
  }, []);

  /** Record that the passcode meets today's rule. Best effort. */
  const markPasscodeRule = useCallback(async () => {
    if (!uid) return;
    const { error } = await supabase
      .from("vault_settings")
      .update({ passcode_rule: VAULT_PASSCODE_RULE })
      .eq("user_id", uid);
    if (error) console.warn("[vault] could not record the passcode rule:", error.message);
  }, [uid]);

  /** A typed passcode: prompt if it is short, else record that it meets the rule. */
  const judgeTypedPasscode = useCallback(
    async (passcode: string) => {
      if (!validateVaultPasscode(passcode).valid) {
        setWeakPasscode("short");
        return;
      }
      setWeakPasscode(false);
      const rule = await readPasscodeRule();
      if (rule !== undefined && deviceUnlockNeedsCheck(rule)) await markPasscodeRule();
    },
    [readPasscodeRule, markPasscodeRule],
  );

  const createVault = useCallback(
    async (passcode: string) => {
      if (!uid) throw new Error("Sign in first");
      const check = validateVaultPasscode(passcode);
      if (!check.valid) throw new Error(check.message);
      const salt = randomB64(16);
      const k = await deriveKey(passcode, salt);
      const { ciphertext, iv } = await encryptJson(k, VERIFIER);
      const { error } = await supabase
        .from("vault_settings")
        .upsert({ user_id: uid, salt, verifier: ciphertext, verifier_iv: iv });
      if (error) throw error;
      unlockedVerifier.current = ciphertext;
      setKey(k);
      setHasVault(true);
      await markPasscodeRule();
      await load();
    },
    [uid, load, markPasscodeRule],
  );

  const unlock = useCallback(
    async (passcode: string) => {
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
      unlockedVerifier.current = settings.verifier;
      setKey(k);
      void judgeTypedPasscode(passcode);
    },
    [judgeTypedPasscode],
  );

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
    unlockedVerifier.current = settings.verifier;
    setKey(k);
  }, []);

  /** Face ID / fingerprint, where set up on this device. */
  const unlockWithDevice = useCallback(async () => {
    if (!uid) throw new Error("Sign in first");
    const record = readPasskeyRecord(uid);
    if (!record) throw new Error("Face ID or fingerprint is not set up on this device");
    await acceptKey(await unlockWithPasskey(record));
    // Face ID never sees the passcode; ask if the vault may predate the rule.
    if (deviceUnlockNeedsCheck(await readPasscodeRule())) setWeakPasscode("older");
  }, [uid, acceptKey, readPasscodeRule]);

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
      // A Face ID unlock never sees the passcode, so this is the moment to
      // ask for a stronger one if it needs it, or record that it does not.
      await judgeTypedPasscode(passcode);
    },
    [uid, acceptKey, judgeTypedPasscode],
  );

  const forgetDevice = useCallback(() => {
    if (!uid) return;
    forgetPasskey(uid);
    setHasPasskey(false);
  }, [uid]);

  /**
   * After a Face ID unlock: the traveller types their current passcode once,
   * so Béa can tell whether it meets today's rule. Checked against the vault
   * first; then recorded as meeting the rule, or asked to be made longer.
   */
  const confirmPasscode = useCallback(
    async (passcode: string) => {
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
      // Changed on another device since this one unlocked: the key held here
      // is the old one, so ask for a fresh unlock rather than vouching for it.
      if (unlockedVerifier.current && settings.verifier !== unlockedVerifier.current) {
        unlockedVerifier.current = null;
        setKey(null);
        setWeakPasscode(false);
        throw new Error(
          "The Protected passcode was changed on another device. Unlock with the new one.",
        );
      }
      await judgeTypedPasscode(passcode);
    },
    [judgeTypedPasscode],
  );

  /**
   * A new passcode for an unlocked vault: every document is opened with the
   * current key and sealed with the new one in the browser, then written in
   * one transaction with the new salt and verifier (rotate_vault_passcode).
   * If anything fails, nothing is written and the old passcode still works.
   * Face ID / fingerprint on this device held the old key, so it is
   * forgotten and can be set up again.
   */
  const changePasscode = useCallback(
    async (passcode: string) => {
      if (!uid || !key) throw new Error("Unlock Protected first");
      const check = validateVaultPasscode(passcode);
      if (!check.valid) throw new Error(check.message);
      const oldVerifier = unlockedVerifier.current;
      if (!oldVerifier) throw new Error("Unlock Protected first");
      // Every document, a page at a time: the API returns at most a page per
      // request, and the change is refused unless it names them all.
      const docs: { id: string; ciphertext: string; iv: string }[] = [];
      for (let from = 0; ; from += ROTATE_PAGE) {
        const { data, error: docsError } = await supabase
          .from("vault_documents")
          .select("id, ciphertext, iv")
          .order("id")
          .range(from, from + ROTATE_PAGE - 1);
        if (docsError) throw docsError;
        docs.push(...(data ?? []));
        if (!data || data.length < ROTATE_PAGE) break;
      }
      const salt = randomB64(16);
      const k = await deriveKey(passcode, salt);
      let documents: { id: string; ciphertext: string; iv: string }[];
      try {
        documents = await reencryptRows(key, k, docs);
      } catch {
        throw new Error(
          "A document in Protected could not be opened, so nothing was changed. If the passcode was changed on another device, lock Protected and unlock it again.",
        );
      }
      const bytes = documents.reduce((n, d) => n + d.ciphertext.length + d.iv.length, 0);
      if (bytes > ROTATE_MAX_BYTES) {
        throw new Error(
          "Protected holds too many large files to change the passcode in one go. Remove a few scans, change it, then add them back.",
        );
      }
      const verifier = await encryptJson(k, VERIFIER);
      const { error } = await supabase.rpc("rotate_vault_passcode", {
        _old_verifier: oldVerifier,
        _salt: salt,
        _verifier: verifier.ciphertext,
        _verifier_iv: verifier.iv,
        _documents: documents,
      });
      if (error) {
        console.warn("[vault] passcode change failed:", error.message);
        throw new Error(
          error.code === "40001"
            ? "Protected changed on another device. Lock it, unlock again, then try once more."
            : error.code === "57014"
              ? "Protected is too large to change the passcode in one go. Remove a few scans and try again. Your current passcode still works."
              : "The passcode could not be changed just now. Your current passcode still works.",
        );
      }
      unlockedVerifier.current = verifier.ciphertext;
      forgetPasskey(uid);
      setHasPasskey(false);
      setKey(k);
      setWeakPasscode(false);
      await markPasscodeRule();
      await load();
    },
    [uid, key, load, markPasscodeRule],
  );

  const lock = useCallback(() => {
    unlockedVerifier.current = null;
    setKey(null);
    setWeakPasscode(false);
  }, []);

  const addDoc = useCallback(
    async (doc: NewDoc) => {
      if (!uid || !key) throw new Error("Unlock the vault first");
      const { ciphertext, iv } = await encryptJson(key, doc.secret);
      const { data: inserted, error } = await supabase
        .from("vault_documents")
        .insert({
          user_id: uid,
          kind: doc.kind,
          label: doc.label,
          expires_on: doc.expires_on || null,
          ciphertext,
          iv,
        })
        .select("id")
        .single();
      if (error) throw error;
      // If the passcode was changed on another device while this was being
      // saved, the row is sealed under a key nobody has any more. The insert
      // waits for such a change to finish (see rotate_vault_passcode), so
      // reading the verifier now tells.
      const { data: settings } = await supabase
        .from("vault_settings")
        .select("verifier")
        .maybeSingle();
      if (settings && unlockedVerifier.current && settings.verifier !== unlockedVerifier.current) {
        await supabase.from("vault_documents").delete().eq("id", inserted.id);
        unlockedVerifier.current = null;
        setKey(null);
        throw new Error(
          "The Protected passcode was changed on another device. Unlock with the new one, then add this again.",
        );
      }
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
    weakPasscode,
    rows,
    loading,
    createVault,
    unlock,
    unlockWithDevice,
    enrolDevice,
    forgetDevice,
    changePasscode,
    confirmPasscode,
    lock,
    addDoc,
    removeDoc,
    reveal,
    reload: load,
  };
}
