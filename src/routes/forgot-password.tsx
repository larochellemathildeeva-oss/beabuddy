import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { BrandMark } from "@/components/PageHeader";
import { CopyrightNotice } from "@/components/CopyrightNotice";
import { AUTH_SUBMIT, AuthField } from "@/components/AuthField";
import { supabase } from "@/integrations/supabase/client";
import { friendlyAuthError } from "@/lib/auth-errors";

export const Route = createFileRoute("/forgot-password")({
  staticData: { plane: "detail" },
  head: () => ({
    meta: [
      { title: "Reset your password — Béa" },
      {
        name: "description",
        content: "Send yourself a reset link and choose a new password for your Béa account.",
      },
      { property: "og:title", content: "Reset your password — Béa" },
      {
        property: "og:description",
        content: "Send yourself a reset link and choose a new password for your Béa account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (err) {
      setError(friendlyAuthError(err));
      return;
    }
    setSent(true);
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[520px] flex-col gap-6 p-5">
        <header className="flex min-h-11 items-center justify-between gap-3">
          <BrandMark />
          <Link
            to="/auth"
            className="flex min-h-11 min-w-11 items-center justify-end px-1 text-[14px] text-foreground"
          >
            Back
          </Link>
        </header>
        <div className="flex flex-1 flex-col gap-6">
          <div className="space-y-2">
            <h1 className="text-[28px] font-bold leading-[1.4]">Forgot your password?</h1>
            <p className="text-[14px] leading-[1.4] text-muted-foreground">
              Enter your email to receive a reset link.
            </p>
          </div>

          {sent ? (
            <p className="rounded-[var(--r-card)] border border-border bg-card p-4 text-[14px] leading-[1.4]">
              If that email has a Béa account, a reset link is on its way. Check your inbox (and
              your spam folder) and tap the link within the hour.
            </p>
          ) : (
            <form onSubmit={submit} className="space-y-6">
              <AuthField
                label="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                enterKeyHint="send"
              />
              {error && (
                <p role="alert" className="text-[14px] text-destructive">
                  {error}
                </p>
              )}
              <button type="submit" disabled={busy} className={AUTH_SUBMIT}>
                {busy ? "Sending…" : "Send reset link"}
              </button>
            </form>
          )}
        </div>
        <CopyrightNotice />
      </div>
    </div>
  );
}
