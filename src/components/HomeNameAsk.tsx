import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dismissNameAsk } from "@/lib/name-ask";
import { rememberProfileName } from "@/lib/profile-name";
import { safeStorage } from "@/lib/tour-state";

export function HomeNameAsk({
  userId,
  onSaved,
}: {
  userId: string;
  onSaved: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (hidden) return null;

  const dismiss = () => {
    dismissNameAsk(safeStorage(), userId);
    setHidden(true);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: trimmed });
    setBusy(false);
    if (err) {
      setError("That didn't save. Please try again.");
      return;
    }
    rememberProfileName(safeStorage(), userId, trimmed);
    onSaved(trimmed);
    dismiss();
  };

  return (
    <section className="rise plain-card p-5">
      <p className="font-display text-[20px] leading-snug">What should Béa call you?</p>
      <p className="mt-1 text-[14.5px] text-muted-foreground">
        It's how she greets you, and what friends see on a shared trip.
      </p>
      <label htmlFor="name-ask" className="mt-3 block text-[13.5px] font-semibold">
        Your name
      </label>
      <form onSubmit={save} className="mt-1.5 flex gap-2">
        <input
          id="name-ask"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="given-name"
          className="min-w-0 flex-1 rounded-[var(--r-button)] border border-border bg-card px-3 text-[16px] outline-none focus:border-primary"
        />
        <button
          type="submit"
          disabled={busy || !name.trim()}
          className="btn-primary px-4 text-[14.5px] disabled:opacity-60"
        >
          Save
        </button>
      </form>
      {error && <p className="mt-2 text-[13px] text-destructive">{error}</p>}
      <button
        type="button"
        onClick={dismiss}
        className="mt-1 inline-flex min-h-11 min-w-11 items-center text-[13px] text-muted-foreground underline underline-offset-4"
      >
        Not now
      </button>
    </section>
  );
}
