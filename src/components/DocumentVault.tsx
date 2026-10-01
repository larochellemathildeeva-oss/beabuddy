import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Fingerprint, Lock, LockOpen, ShieldCheck } from "@/components/icons";
import { useVault, type DocSecret, type VaultDocRow } from "@/hooks/useVault";
import { passkeysPossible } from "@/lib/vault-passkey";
import { VAULT_PASSCODE_HINT, validateVaultPasscode } from "@/lib/vault-passcode";

/**
 * Protected: the encrypted part of Trip documents (it was "the vault").
 * Passports, ID, payment cards, insurance — anything that should not sit in
 * the easy-to-open booking list. The contents of each entry are encrypted in
 * the browser with a key from the traveller's passcode; the server only ever
 * holds ciphertext. Face ID / fingerprint, where the device supports it,
 * unlocks through a passkey (see lib/vault-passkey.ts); the passcode always
 * works.
 */

const kinds = ["Passport", "ID card", "Visa", "Insurance", "Payment card", "Other"];

type Vault = ReturnType<typeof useVault>;

type Keyboard = "numeric" | "text";

/** Switch between the number pad and a full keyboard. */
function KeyboardToggle({ keyboard, set }: { keyboard: Keyboard; set: (k: Keyboard) => void }) {
  return (
    <button
      type="button"
      onClick={() => set(keyboard === "numeric" ? "text" : "numeric")}
      className="mt-1.5 text-[12.5px] text-muted-foreground underline"
    >
      {keyboard === "numeric" ? "Use letters too" : "Use the number pad"}
    </button>
  );
}

async function attempt(
  setError: (s: string) => void,
  setBusy: (b: boolean) => void,
  fn: () => Promise<void>,
) {
  setError("");
  setBusy(true);
  try {
    await fn();
  } catch (e) {
    if (e instanceof DOMException && (e.name === "NotAllowedError" || e.name === "AbortError")) {
      setError("Face ID or fingerprint was cancelled. Try again or use your passcode.");
    } else {
      setError(e instanceof Error ? e.message : "Something went wrong");
    }
  } finally {
    setBusy(false);
  }
}

/**
 * Passcode (and Face ID / fingerprint, once set up) — to create the vault or
 * unlock it. Shared by Protected and the lock over the whole of Trip
 * documents, which uses the same passcode.
 */
export function VaultUnlock({
  v,
  title,
  body,
}: {
  v: Vault;
  title?: string | undefined;
  body?: string | undefined;
}) {
  const [passcode, setPasscode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Unlocking an existing vault starts on the number pad (most older ones
  // are PINs); a new passcode is a passphrase, so it starts on letters.
  const [keyboard, setKeyboard] = useState<Keyboard>(v.hasVault ? "numeric" : "text");
  // Unlocking takes any passcode a vault was made with; a new one must pass
  // today's rule (vault-passcode.ts).
  const check = validateVaultPasscode(passcode);
  const ready = v.hasVault ? passcode.length > 0 : check.valid && confirmCode.length > 0;

  return (
    <div className="plain-card p-4">
      <div className="text-center">
        <span className="tile-fill-1 mx-auto grid size-12 place-items-center rounded-2xl border border-border/60 text-primary">
          <Lock className="size-6" aria-hidden />
        </span>
        <p className="mt-2 font-display text-[24px] leading-none">
          {title ?? (v.hasVault ? "Protected is locked" : "Set a passcode")}
        </p>
        <p className="mt-1.5 text-[13.5px] text-muted-foreground">
          {body ??
            (v.hasVault
              ? "Unlock to see what is inside."
              : "Choose a passcode for Protected and for the lock on Trip documents. Designed so only someone with it can open your protected files.")}
        </p>
      </div>
      {v.hasVault && v.hasPasskey && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void attempt(setError, setBusy, () => v.unlockWithDevice())}
          className="btn-primary mt-4 flex w-full items-center justify-center gap-2 px-4 disabled:opacity-60"
        >
          <Fingerprint className="size-5" aria-hidden />
          Unlock with Face ID or fingerprint
        </button>
      )}
      <input
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        type="password"
        inputMode={keyboard}
        autoComplete={v.hasVault ? "current-password" : "new-password"}
        placeholder="Passcode"
        aria-label="Passcode"
        className="mt-4 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
      />
      <KeyboardToggle keyboard={keyboard} set={setKeyboard} />
      {!v.hasVault && (
        <input
          value={confirmCode}
          onChange={(e) => setConfirmCode(e.target.value)}
          type="password"
          inputMode={keyboard}
          autoComplete="new-password"
          placeholder="Repeat passcode"
          aria-label="Repeat passcode"
          className="mt-2 w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
        />
      )}
      {!v.hasVault && passcode.length > 0 && !check.valid && !error && (
        <p className="mt-2 text-[13px] text-muted-foreground">{check.message}</p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={busy || !ready}
        onClick={() =>
          void attempt(setError, setBusy, async () => {
            if (v.hasVault) await v.unlock(passcode);
            else {
              if (passcode !== confirmCode) throw new Error("Those passcodes don't match");
              await v.createVault(passcode);
            }
            setPasscode("");
            setConfirmCode("");
          })
        }
        className={`mt-3 w-full rounded-xl px-4 py-2.5 text-[14.5px] font-semibold disabled:opacity-50 ${
          v.hasPasskey
            ? "border border-border bg-card text-foreground"
            : "bg-primary text-primary-foreground"
        }`}
      >
        {v.hasVault ? "Unlock with passcode" : "Set passcode"}
      </button>
      {!v.hasVault && (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {VAULT_PASSCODE_HINT} Béa cannot recover a forgotten passcode: what is in Protected is
          encrypted with it.
        </p>
      )}
    </div>
  );
}

/** Offer Face ID / fingerprint once unlocked, confirming the passcode once. */
function DeviceUnlockSetting({ v }: { v: Vault }) {
  const [asking, setAsking] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!passkeysPossible()) return null;
  if (v.hasPasskey) {
    return (
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Fingerprint className="size-4" aria-hidden /> Face ID or fingerprint is on for this
          device
        </span>
        <button type="button" onClick={v.forgetDevice} className="text-muted-foreground underline">
          Turn off
        </button>
      </div>
    );
  }
  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[14px] font-semibold"
      >
        <Fingerprint className="size-5 text-primary" aria-hidden />
        Use Face ID or fingerprint on this device
      </button>
    );
  }
  return (
    <div className="space-y-2 rounded-xl border border-border bg-elevated p-3">
      <p className="text-[13px] text-muted-foreground">
        Enter your passcode once more to set it up. The passcode keeps working on every device.
      </p>
      <input
        value={passcode}
        onChange={(e) => setPasscode(e.target.value)}
        type="password"
        inputMode="numeric"
        autoComplete="current-password"
        placeholder="Passcode"
        aria-label="Passcode"
        className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
      />
      {error && (
        <p role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy || passcode.length < 4}
          onClick={() =>
            void attempt(setError, setBusy, async () => {
              await v.enrolDevice(passcode);
              setPasscode("");
              setAsking(false);
            })
          }
          className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          Set up
        </button>
        <button
          type="button"
          onClick={() => {
            setAsking(false);
            setPasscode("");
            setError("");
          }}
          className="rounded-xl border border-border px-4 py-2 text-[14.5px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/**
 * A vault made before today's passcode rule, unlocked with its short
 * passcode: ask for a stronger one. Changing it re-encrypts everything in
 * Protected on this device and writes it in one go (useVault's
 * `changePasscode`); until then the old passcode keeps working.
 */
function StrongerPasscode({ v }: { v: Vault }) {
  const [asking, setAsking] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [passcode, setPasscode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [keyboard, setKeyboard] = useState<Keyboard>("text");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!v.weakPasscode || dismissed) return null;
  const check = validateVaultPasscode(passcode);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-border bg-elevated p-3">
      <p className="flex items-start gap-1.5 text-[13px]">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <span>
          Your passcode was set under an older, shorter rule. A longer one is much harder to guess,
          and what is inside is re-encrypted on this device. {VAULT_PASSCODE_HINT}
        </span>
      </p>
      {!asking ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground"
          >
            Choose a stronger passcode
          </button>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="rounded-xl border border-border px-4 py-2 text-[14px]"
          >
            Not now
          </button>
        </div>
      ) : (
        <>
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            type="password"
            inputMode={keyboard}
            autoComplete="new-password"
            placeholder="New passcode"
            aria-label="New passcode"
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
          />
          <KeyboardToggle keyboard={keyboard} set={setKeyboard} />
          <input
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            type="password"
            inputMode={keyboard}
            autoComplete="new-password"
            placeholder="Repeat new passcode"
            aria-label="Repeat new passcode"
            className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
          />
          {passcode.length > 0 && !check.valid && !error && (
            <p className="text-[13px] text-muted-foreground">{check.message}</p>
          )}
          {error && (
            <p role="alert" className="text-[13px] text-destructive">
              {error}
            </p>
          )}
          <p className="text-[12px] text-muted-foreground">
            Everything in Protected is re-encrypted on this device with the new passcode.
            {v.hasPasskey && " Face ID or fingerprint will need setting up again here."}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || !check.valid || confirmCode.length === 0}
              onClick={() =>
                void attempt(setError, setBusy, async () => {
                  if (passcode !== confirmCode) throw new Error("Those passcodes don't match");
                  await v.changePasscode(passcode);
                  setPasscode("");
                  setConfirmCode("");
                  setAsking(false);
                })
              }
              className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "Changing…" : "Change passcode"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAsking(false);
                setPasscode("");
                setConfirmCode("");
                setError("");
              }}
              className="rounded-xl border border-border px-4 py-2 text-[14px]"
            >
              Cancel
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/** Protected, given the vault — so a page can share one unlock between parts. */
export function ProtectedPanel({ v }: { v: Vault }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [secret, setSecret] = useState<DocSecret | null>(null);
  const [form, setForm] = useState({
    kind: "Passport",
    label: "",
    expires: "",
    number: "",
    notes: "",
  });
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);

  const run = (fn: () => Promise<void>) => attempt(setError, setBusy, fn);

  if (!v.signedIn) {
    return (
      <div className="plain-card p-4 text-center">
        <p className="font-display text-[22px]">Protected</p>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Passports, cards and private files, encrypted on your device before they sync.
        </p>
        <Link
          to="/auth"
          className="mt-4 block w-full rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground"
        >
          Sign in to set up Protected
        </Link>
      </div>
    );
  }

  if (!v.unlocked) return <VaultUnlock v={v} />;

  return (
    <div className="space-y-3">
      <div className="plain-card p-4">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
            <LockOpen className="size-4" aria-hidden /> Unlocked
          </p>
          <button
            type="button"
            onClick={v.lock}
            className="flex items-center gap-1 text-[13px] text-muted-foreground underline"
          >
            Lock now
          </button>
        </div>
        <StrongerPasscode v={v} />

        <div className="mt-2 divide-y divide-border">
          {v.rows.map((row: VaultDocRow) => (
            <div key={row.id} className="py-3">
              <button
                type="button"
                onClick={() =>
                  void run(async () => {
                    if (openId === row.id) {
                      setOpenId(null);
                      setSecret(null);
                      return;
                    }
                    setSecret(await v.reveal(row));
                    setOpenId(row.id);
                  })
                }
                className="flex w-full items-center gap-3 text-left"
              >
                <span className="tile-fill-1 grid size-10 shrink-0 place-items-center rounded-xl border border-border/60 text-primary">
                  <ShieldCheck className="size-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{row.label}</span>
                  <span className="block text-[12.5px] text-muted-foreground">
                    {row.kind}
                    {row.expires_on ? ` · expires ${row.expires_on}` : ""}
                  </span>
                </span>
                <span className="text-[12.5px] font-semibold text-primary">
                  {openId === row.id ? "Hide" : "Reveal"}
                </span>
              </button>
              {openId === row.id && secret && (
                <div className="rise mt-2 rounded-xl border border-border bg-elevated p-3 text-[14.5px]">
                  {secret.number && <p>Number: {secret.number}</p>}
                  {secret.notes && <p className="mt-1 text-muted-foreground">{secret.notes}</p>}
                  {secret.fileData && (
                    <a
                      href={secret.fileData}
                      download={secret.fileName ?? "document"}
                      className="mt-2 inline-block underline"
                    >
                      Open {secret.fileName ?? "attachment"}
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => void run(() => v.removeDoc(row.id))}
                    className="mt-3 block text-[13px] text-destructive underline"
                  >
                    Delete this document
                  </button>
                </div>
              )}
            </div>
          ))}
          {v.rows.length === 0 && (
            <p className="py-4 text-center text-[13px] text-muted-foreground">
              Nothing in Protected yet. Add a passport, card or other private file.
            </p>
          )}
        </div>

        {adding ? (
          <div className="rise mt-3 space-y-2 rounded-xl bg-elevated p-3">
            <div className="flex flex-wrap gap-1.5">
              {kinds.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setForm({ ...form, kind: k })}
                  className={`rounded-full border px-3 py-1.5 text-[13px] ${
                    form.kind === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card"
                  }`}
                >
                  {k}
                </button>
              ))}
            </div>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="Label (e.g. My passport)"
              aria-label="Label"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
            />
            <input
              value={form.number}
              onChange={(e) => setForm({ ...form, number: e.target.value })}
              placeholder="Number"
              aria-label="Number"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
            />
            <input
              value={form.expires}
              onChange={(e) => setForm({ ...form, expires: e.target.value })}
              type="date"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
              aria-label="Expiry date"
            />
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes"
              aria-label="Notes"
              rows={2}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[15px]"
            />
            <label className="block text-[13px] text-muted-foreground">
              {file ? `Attached: ${file.name}` : "Attach a scan or photo (optional)"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="mt-1 block w-full text-[13px]"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  const reader = new FileReader();
                  reader.onload = () => setFile({ name: f.name, data: String(reader.result) });
                  reader.readAsDataURL(f);
                }}
              />
            </label>
            {error && <p className="text-[13px] text-destructive">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy || !form.label.trim()}
                onClick={() =>
                  void run(async () => {
                    await v.addDoc({
                      kind: form.kind,
                      label: form.label.trim(),
                      expires_on: form.expires || undefined,
                      secret: {
                        ...(form.number ? { number: form.number } : {}),
                        ...(form.notes ? { notes: form.notes } : {}),
                        ...(file ? { fileName: file.name, fileData: file.data } : {}),
                      },
                    });
                    setForm({ kind: "Passport", label: "", expires: "", number: "", notes: "" });
                    setFile(null);
                    setAdding(false);
                  })
                }
                className="flex-1 rounded-xl bg-primary px-4 py-2 text-[14.5px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                Encrypt and save
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="rounded-xl border border-border px-4 py-2.5 text-[14.5px]"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="btn-primary mt-3 w-full px-4"
          >
            Add to Protected
          </button>
        )}
        {error && !adding && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      </div>

      <DeviceUnlockSetting v={v} />

      <p className="text-[12px] text-muted-foreground">
        Labels and expiry dates stay readable when locked; numbers, notes and attachments are
        encrypted on this device with your passcode.
      </p>
    </div>
  );
}

/** Protected on its own, for screens that do not share an unlock. */
export function DocumentVault() {
  const v = useVault();
  return <ProtectedPanel v={v} />;
}
