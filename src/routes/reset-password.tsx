import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { supabase } from "@/integrations/supabase/client";
import { assertNewPasswordAllowed, MIN_NEW_PASSWORD_LENGTH } from "@/lib/pwned-password";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a new password — Béa" },
      {
        name: "description",
        content: "Set a new password for your Béa travel vault and get back to your trips.",
      },
      { property: "og:title", content: "Choose a new password — Béa" },
      {
        property: "og:description",
        content: "Set a new password for your Béa travel vault and get back to your trips.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // The reset link drops a recovery session in place; wait for it before
    // letting anyone set a new password.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await assertNewPasswordAllowed(password);
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        setError(err.message);
        return;
      }
      setDone(true);
      setTimeout(() => navigate({ to: "/", replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save that password.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col border-x border-border/70 px-6 py-10">
      <div className="flex flex-1 flex-col justify-center">
        <p className="label-caps">Béa</p>
        <h1 className="mt-2 text-[34px] leading-[1.05]">Choose a new password</h1>

        {done ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-4 text-[13px]">
            Password updated — taking you back into Béa.
          </p>
        ) : !ready ? (
          <p className="mt-6 text-[13px] text-muted-foreground">
            Open this page from the link in your reset email. If you got here another way, ask for a
            new link on the{" "}
            <Link to="/forgot-password" className="underline underline-offset-4">
              forgot password
            </Link>{" "}
            page.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              minLength={MIN_NEW_PASSWORD_LENGTH}
              placeholder={`New password (${MIN_NEW_PASSWORD_LENGTH}+ characters)`}
              autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
            />
            <input
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              type="password"
              required
              minLength={MIN_NEW_PASSWORD_LENGTH}
              placeholder="Repeat new password"
              autoComplete="new-password"
              className="w-full rounded-xl border border-border bg-card px-4 py-3 text-[14px] outline-none focus:border-primary"
            />
            <p className="text-[11px] text-muted-foreground">
              New passwords are checked against a public breach list. Your password itself is never
              sent — only a short hash prefix.
            </p>
            {error && <p className="text-[12px] text-destructive">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-primary px-4 py-3 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save new password"}
            </button>
          </form>
        )}
      </div>
        <CopyrightNotice />
      </div>
    </div>
  );
}
