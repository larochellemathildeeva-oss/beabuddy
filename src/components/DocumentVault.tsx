import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useVault, type DocSecret, type VaultDocRow } from "@/hooks/useVault";

const kinds = ["Passport", "Visa", "Flight", "Insurance", "Other"];

export function DocumentVault() {
  const v = useVault();
  const [passcode, setPasscode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [secret, setSecret] = useState<DocSecret | null>(null);
  const [form, setForm] = useState({ kind: "Passport", label: "", expires: "", number: "", notes: "" });
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setError("");
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (!v.signedIn) {
    return (
      <div className="card-soft p-4 text-center">
        <p className="font-display text-[20px]">Passports, visas, tickets</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Encrypted on your phone before it ever leaves it, then synced to your account.
        </p>
        <Link
          to="/auth"
          className="mt-4 block w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
        >
          Sign in to set up your vault
        </Link>
      </div>
    );
  }

  if (!v.unlocked) {
    return (
      <div className="card-soft p-4">
        <div className="text-center">
          <p className="font-display text-[20px]">
            {v.hasVault ? "Vault locked" : "Set a vault passcode"}
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            {v.hasVault
              ? "Your documents are unreadable until you unlock them."
              : "Choose a passcode. Only you know it — without it nobody, not even Béa, can read these documents."}
          </p>
        </div>
        <input
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          type="password"
          inputMode="numeric"
          placeholder="Passcode"
          className="mt-4 w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
        />
        {!v.hasVault && (
          <input
            value={confirmCode}
            onChange={(e) => setConfirmCode(e.target.value)}
            type="password"
            inputMode="numeric"
            placeholder="Repeat passcode"
            className="mt-2 w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
          />
        )}
        {error && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
        <button
          disabled={busy || passcode.length < 4}
          onClick={() =>
            run(async () => {
              if (v.hasVault) await v.unlock(passcode);
              else {
                if (passcode !== confirmCode) throw new Error("Those passcodes don't match");
                await v.createVault(passcode);
              }
              setPasscode("");
              setConfirmCode("");
            })
          }
          className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {v.hasVault ? "Unlock vault" : "Create vault"}
        </button>
        {v.hasVault && v.bioReady && (
          <button
            onClick={() => run(() => v.unlockBiometric())}
            className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-[13px] font-semibold"
          >
            Unlock with Face ID / fingerprint
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card-soft p-4">
      <div className="flex items-center justify-between">
        <p className="label-caps text-foreground">Unlocked</p>
        <button onClick={v.lock} className="text-[12px] text-muted-foreground underline">
          Lock now
        </button>
      </div>

      <div className="mt-3 divide-y divide-border">
        {v.rows.map((row: VaultDocRow) => (
          <div key={row.id} className="py-3">
            <button
              onClick={() =>
                run(async () => {
                  if (openId === row.id) {
                    setOpenId(null);
                    setSecret(null);
                    return;
                  }
                  setSecret(await v.reveal(row));
                  setOpenId(row.id);
                })
              }
              className="flex w-full items-center justify-between text-left"
            >
              <div>
                <p className="text-[14px] font-medium">{row.label}</p>
                <p className="text-[11px] text-muted-foreground">
                  {row.kind}
                  {row.expires_on ? ` · expires ${row.expires_on}` : ""}
                </p>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {openId === row.id ? "Hide" : "Reveal"}
              </span>
            </button>
            {openId === row.id && secret && (
              <div className="rise mt-2 rounded-xl border border-border bg-elevated p-3 text-[13px]">
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
                  onClick={() => run(() => v.removeDoc(row.id))}
                  className="mt-3 block text-[12px] text-destructive underline"
                >
                  Delete this document
                </button>
              </div>
            )}
          </div>
        ))}
        {v.rows.length === 0 && (
          <p className="py-4 text-center text-[12px] text-muted-foreground">
            Nothing stored yet. Add your passport to start.
          </p>
        )}
      </div>

      {adding ? (
        <div className="rise mt-3 space-y-2 rounded-xl border border-border p-3">
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <button
                key={k}
                onClick={() => setForm({ ...form, kind: k })}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${
                  form.kind === k ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder="Label (e.g. Canadian passport)"
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
          />
          <input
            value={form.number}
            onChange={(e) => setForm({ ...form, number: e.target.value })}
            placeholder="Number / reference"
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
          />
          <input
            value={form.expires}
            onChange={(e) => setForm({ ...form, expires: e.target.value })}
            type="date"
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
          />
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes"
            rows={2}
            className="w-full rounded-xl border border-border bg-elevated px-3 py-2.5 text-[14px]"
          />
          <label className="block text-[12px] text-muted-foreground">
            {file ? `Attached: ${file.name}` : "Attach a scan or photo (optional)"}
            <input
              type="file"
              accept="image/*,application/pdf"
              className="mt-1 block w-full text-[12px]"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const reader = new FileReader();
                reader.onload = () => setFile({ name: f.name, data: String(reader.result) });
                reader.readAsDataURL(f);
              }}
            />
          </label>
          {error && <p className="text-[12px] text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              disabled={busy || !form.label.trim()}
              onClick={() =>
                run(async () => {
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
              className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
            >
              Encrypt and save
            </button>
            <button
              onClick={() => setAdding(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-[13px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground"
        >
          Add a document
        </button>
      )}

      {v.bioSupported && (
        <button
          onClick={() => run(() => (v.bioReady ? v.disableBiometric() : v.enableBiometric()))}
          className="mt-2 w-full rounded-xl border border-border px-4 py-2.5 text-[13px]"
        >
          {v.bioReady ? "Turn off Face ID / fingerprint unlock" : "Unlock with Face ID / fingerprint"}
        </button>
      )}
      {error && !adding && <p className="mt-2 text-[12px] text-destructive">{error}</p>}
    </div>
  );
}
