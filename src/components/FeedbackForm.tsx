import { useState } from "react";
import { FEEDBACK_CATEGORIES, formatFeedbackMessage } from "@/lib/feedback";
import { fileReport } from "@/lib/report";
import { useAuth } from "@/hooks/useAuth";

/**
 * Writes a row to app_reports (kind = feedback). Shown under You → Feedback.
 */
export function FeedbackForm({ alreadySignedIn = false }: { alreadySignedIn?: boolean }) {
  const { user, loading } = useAuth();
  const [category, setCategory] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const signedIn = alreadySignedIn || !!user;
  const canSend = Boolean(category && message.trim());

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    setBusy(true);
    setFailed(false);
    const ok = await fileReport({
      kind: "feedback",
      message: formatFeedbackMessage(category, message),
      detail: category,
    });
    setBusy(false);
    if (ok) {
      setSent(true);
      setMessage("");
      setCategory("");
    } else {
      setFailed(true);
    }
  };

  if (!signedIn) {
    if (loading) return null;
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
      <label className="block">
        <span className="sr-only">What kind of something is this?</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          required
          className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
        >
          <option value="">What kind of something is this?</option>
          {FEEDBACK_CATEGORIES.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
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
        disabled={busy || !canSend}
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
