import { useState } from "react";
import { fileReport } from "@/lib/report";
import { useAuth } from "@/hooks/useAuth";

/**
 * The Terms have had a "Feedback" section since launch with no way to send any.
 * This is that way: short, on the Help page, and honest about needing an account
 * since a report is stored as a row the sender owns.
 */
export function FeedbackForm() {
  const { user } = useAuth();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    setFailed(false);
    const ok = await fileReport({ kind: "feedback", message });
    setBusy(false);
    if (ok) {
      setSent(true);
      setMessage("");
    } else {
      setFailed(true);
    }
  };

  if (!user) {
    return (
      <p className="text-[12px] text-muted-foreground">
        Sign in to send feedback — it is saved to your account so we can reply about it.
      </p>
    );
  }

  if (sent) {
    return (
      <div className="rounded-xl border border-border bg-elevated p-3">
        <p className="text-[13px]">Thank you — that reached us.</p>
        <button
          onClick={() => setSent(false)}
          className="mt-1 text-[11px] text-muted-foreground underline"
        >
          Send something else
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={send} className="space-y-2">
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        maxLength={4000}
        placeholder="What went wrong, or what would make Béa better?"
        className="w-full rounded-xl border border-border bg-card p-3 text-[13px] outline-none"
      />
      {failed && (
        <p className="text-[12px] text-destructive">
          That didn&rsquo;t send. Check your connection and try again.
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !message.trim()}
        className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
      >
        {busy ? "Sending…" : "Send feedback"}
      </button>
      <p className="text-[11px] text-muted-foreground">
        Béa attaches the page you were on and your app version. Please don&rsquo;t include
        passport numbers or other vault details.
      </p>
    </form>
  );
}
